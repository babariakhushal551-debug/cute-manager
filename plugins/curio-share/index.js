// Curio share extension — entitlement-free iOS share handoff.
//
// WHY THIS EXISTS: expo-share-intent passes share payloads through an
// iOS App Group. Free Apple-ID profiles (Sideloadly) cannot create App
// Groups, so its extension crashes on the force-unwrapped group container
// (the "flash and close" bug) and the host app never receives the payload.
//
// HOW THIS ONE WORKS (no entitlements needed):
//   • Links/text → JSON payload embedded directly in the deep-link URL.
//   • Images/files → copied to Pasteboard as data, then the deep link says
//     "there is something on the pasteboard for you" (auto-expires in 15 min).
//   • The extension always completes its request so the share sheet closes
//     cleanly; the host app opens via `curio://` and ingests from app/[missing].
"use strict";

const { withXcodeProject } = require("@expo/config-plugins");
const plist = require("@expo/plist").default; // CJS/ESM interop: @expo/plist exports only `default`
const fs = require("node:fs");
const path = require("node:path");

const EXT_NAME = "CurioShare";
const SCHEME = "curio";

// ─────────────────────────────────────────────────────────────────────────
// Swift source
// ─────────────────────────────────────────────────────────────────────────
const SWIFT_SOURCE = `import UIKit
import UniformTypeIdentifiers
import MobileCoreServices

// Curio share extension — entitlement-free (no App Group required).
// Links/text: JSON payload embedded in the curio:// deep link.
// Images/files: copied to the system Pasteboard, deep link references them.
class ShareViewController: UIViewController {

  struct Payload: Codable {
    var text: String?
    var webUrl: String?
    var meta: [String: String]?
    var pasteboard: Bool?
    var kind: String?
    var nonce: String?
  }

  private func isImageType(_ type: String) -> Bool {
    if #available(iOS 14.0, *) {
      return type == UTType.image.identifier
    }
    return type == (kUTTypeImage as String)
  }

  private func isVideoType(_ type: String) -> Bool {
    if #available(iOS 14.0, *) {
      return type == UTType.movie.identifier || type == UTType.video.identifier
    }
    return type == (kUTTypeMovie as String) || type == (kUTTypeVideo as String)
  }

  private func isFileURLType(_ type: String) -> Bool {
    if #available(iOS 14.0, *) {
      return type == UTType.fileURL.identifier
    }
    return type == (kUTTypeFileURL as String)
  }

  private func isURLType(_ type: String) -> Bool {
    if #available(iOS 14.0, *) {
      return type == UTType.url.identifier
    }
    return type == (kUTTypeURL as String)
  }

  private func isTextType(_ type: String) -> Bool {
    if #available(iOS 14.0, *) {
      return type == UTType.plainText.identifier
    }
    return type == (kUTTypePlainText as String)
  }

  override func viewDidLoad() {
    super.viewDidLoad()
    let attachments = (extensionContext?.inputItems.first as? NSExtensionItem)?.attachments ?? []
    guard !attachments.isEmpty else {
      finish(withPayload: nil, errorMessage: "Nothing shareable found")
      return
    }

    // 1) Highest-priority: a URL or web page the user is sharing.
    if let item = attachments.first(where: { self.isURLType($0.registeredTypeIdentifiers.first ?? "") || self.isFileURLType($0.registeredTypeIdentifiers.first ?? "") }) {
      handleURLItem(item)
      return
    }
    // 2) Then: images / videos → Pasteboard.
    if let item = attachments.first(where: { self.isImageType($0.registeredTypeIdentifiers.first ?? "") || self.isVideoType($0.registeredTypeIdentifiers.first ?? "") }) {
      handleMediaItem(item)
      return
    }
    // 3) Fallback: plain text.
    if let item = attachments.first(where: { self.isTextType($0.registeredTypeIdentifiers.first ?? "") }) {
      handleTextItem(item)
      return
    }
    finish(withPayload: nil, errorMessage: "Content type not supported")
  }

  // MARK: - URL / text handlers

  private func handleURLItem(_ item: NSItemProvider) {
    let type = item.registeredTypeIdentifiers.first ?? ""
    item.loadItem(forTypeIdentifier: type, options: nil) { [weak self] (data, error) in
      guard let self = self else { return }
      if let err = error {
        self.finish(withPayload: nil, errorMessage: "Could not read shared link: \\(err.localizedDescription)")
        return
      }
      var urlString: String?
      var meta: [String: String] = [:]
      switch data {
      case let url as URL:
        urlString = url.absoluteString
      case let str as String:
        if str.hasPrefix("file://") {
          urlString = str
        } else if str.contains("<html") || str.contains("<HTML") {
          // Safari shares web pages as HTML — pull the real URL/title out.
          urlString = self.extractOGURL(from: str) ?? nil
          if let t = self.extractOGTitle(from: str) { meta["title"] = t }
        } else {
          urlString = str
        }
      default:
        urlString = nil
      }
      guard let finalURL = urlString, !finalURL.isEmpty else {
        // HTML page without og:url — degrade to a text capture of the title.
        if let t = meta["title"], !t.isEmpty {
          let payload = Payload(text: t, webUrl: nil, meta: nil, pasteboard: nil, kind: "text", nonce: UUID().uuidString)
          self.finish(withPayload: payload, errorMessage: nil)
        } else {
          self.finish(withPayload: nil, errorMessage: "Could not read shared link")
        }
        return
      }
      let payload = Payload(text: nil, webUrl: finalURL, meta: meta, pasteboard: nil, kind: self.isFileURLType(type) ? "file" : "link", nonce: UUID().uuidString)
      self.finish(withPayload: payload, errorMessage: nil)
    }
  }

  private func handleTextItem(_ item: NSItemProvider) {
    item.loadItem(forTypeIdentifier: (item.registeredTypeIdentifiers.first ?? ""), options: nil) { [weak self] (data, error) in
      guard let self = self else { return }
      if let err = error {
        self.finish(withPayload: nil, errorMessage: "Could not read shared text: \\(err.localizedDescription)")
        return
      }
      let text: String?
      switch data {
      case let s as String: text = s
      case let u as URL: text = u.absoluteString
      default: text = nil
      }
      guard let finalText = text, !finalText.isEmpty else {
        self.finish(withPayload: nil, errorMessage: "Could not read shared text")
        return
      }
      self.finish(withPayload: Payload(text: finalText, webUrl: nil, meta: nil, pasteboard: nil, kind: "text", nonce: UUID().uuidString), errorMessage: nil)
    }
  }

  // MARK: - Media handler (Pasteboard)

  private func handleMediaItem(_ item: NSItemProvider) {
    let types = item.registeredTypeIdentifiers
    let type = types.first ?? ""
    let isImage = self.isImageType(type)

    // Show lightweight progress; sharing a photo can take a moment.
    DispatchQueue.main.async {
      let alert = UIAlertController(title: nil, message: "Saving to Curio…", preferredStyle: .alert)
      let loading = UIActivityIndicatorView(style: .medium)
      loading.translatesAutoresizingMaskIntoConstraints = false
      loading.startAnimating()
      alert.view.addSubview(loading)
      NSLayoutConstraint.activate([
        loading.leadingAnchor.constraint(equalTo: alert.view.leadingAnchor, constant: 20),
        loading.centerYAnchor.constraint(equalTo: alert.view.centerYAnchor),
      ])
      self.present(alert, animated: true, completion: nil)
    }

    let load: (@escaping (Any?, Error?) -> Void) -> Void = { cb in
      item.loadItem(forTypeIdentifier: type, options: nil, completionHandler: cb)
    }

    load { [weak self] (data, error) in
      guard let self = self else { return }
      if let err = error {
        self.finish(withPayload: nil, errorMessage: "Could not read shared media: \\(err.localizedDescription)")
        return
      }
      var fileData: Data?
      var uti = type
      switch data {
      case let url as URL:
        fileData = try? Data(contentsOf: url)
        if #available(iOS 14.0, *) {
          uti = UTType(filenameExtension: url.pathExtension)?.identifier ?? uti
        }
      case let image as UIImage:
        fileData = image.pngData()
        uti = UTType.png.identifier
      case let d as Data:
        fileData = d
      default:
        fileData = nil
      }
      guard let payloadData = fileData, !payloadData.isEmpty else {
        self.finish(withPayload: nil, errorMessage: "Could not read shared media")
        return
      }

      // Give the data to the system Pasteboard (no App Group needed).
      let pb = UIPasteboard.general
      pb.setItems([[uti: payloadData]], options: [UIPasteboard.OptionsKey.expirationDate: Date().addingTimeInterval(900)])

      let payload = Payload(
        text: nil, webUrl: nil, meta: nil, pasteboard: true,
        kind: isImage ? "image" : self.isVideoType(type) ? "video" : "file", nonce: UUID().uuidString)
      self.finish(withPayload: payload, errorMessage: nil)
    }
  }

  // MARK: - Extractors

  private func extractOGURL(from html: String) -> String? {
    let pattern = "<meta[^>]*(?:property=|name=)\\"og:url\\"[^>]*content=\\"([^\\"]*)\\""
    if let re = try? NSRegularExpression(pattern: pattern),
       let m = re.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
       let r = Range(m.range(at: 1), in: html) {
      return String(html[r])
    }
    return nil
  }

  private func extractOGTitle(from html: String) -> String? {
    let pattern = "<meta[^>]*(?:property=|name=)\\"og:title\\"[^>]*content=\\"([^\\"]*)\\""
    if let re = try? NSRegularExpression(pattern: pattern),
       let m = re.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
       let r = Range(m.range(at: 1), in: html) {
      return String(html[r])
    }
    if let start = html.range(of: "<title>"), let end = html.range(of: "</title>") {
      return String(html[start.upperBound..<end.lowerBound])
    }
    return nil
  }

  // MARK: - Completion

  /// Write the payload into the deep link and hand off to the host app.
  private func finish(withPayload payload: Payload?, errorMessage: String?) {
    DispatchQueue.main.async {
      let alertController = (self.presentedViewController as? UIAlertController)
      alertController?.dismiss(animated: false) {
        guard let payload = payload else {
          NSLog("[CurioShare] error: \\(errorMessage ?? "unknown")")
          self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
          return
        }
        guard let json = try? JSONEncoder().encode(payload) else {
          self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
          return
        }
        // Percent-encode the base64 (contains + / = which URL parsers mangle).
        var encoded = json.base64EncodedString()
        encoded = encoded.addingPercentEncoding(withAllowedCharacters: CharacterSet.alphanumerics) ?? encoded
        var components = URLComponents()
        components.scheme = "curio"
        components.host = "curio-data"
        components.queryItems = [URLQueryItem(name: "payload", value: encoded)]
        guard let url = components.url else {
          self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
          return
        }
        // UIApplication.shared is unavailable in extension contexts — walk the
        // responder chain (same proven mechanism expo-share-intent uses).
        var opened = false
        var responder: UIResponder? = self
        while responder != nil {
          if let application = responder as? UIApplication {
            application.open(url, options: [:]) { success in
              if !success { NSLog("[CurioShare] host app did not open") }
            }
            opened = true
            break
          }
          responder = responder?.next
        }
        if !opened { NSLog("[CurioShare] could not find UIApplication in responder chain") }
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
      }
    }
  }
}
`;

// ─────────────────────────────────────────────────────────────────────────
// File contents
// ─────────────────────────────────────────────────────────────────────────
const storyboard = `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="13122.16" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="j1y-V4-xli">
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="13104.12"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <!--Share View Controller-->
        <scene sceneID="ceB-am-kn3">
            <objects>
                <viewController id="j1y-V4-xli" customClass="ShareViewController" customModuleProvider="target" sceneMemberID="viewController">
                    <view key="view" opaque="NO" contentMode="scaleToFill" id="wbc-yd-nQP">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <color key="backgroundColor" red="0.0" green="0.0" blue="0.0" alpha="0.0" colorSpace="custom" customColorSpace="sRGB"/>
                        <viewLayoutGuide key="safeArea" id="1Xd-am-t49"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="CEy-Cv-SGf" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
</document>
`;

const privacyInfo = plist.build({
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
      NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
    },
  ],
  NSPrivacyCollectedDataTypes: [],
  NSPrivacyTracking: false,
});

function extensionInfoPlist(displayName) {
  return plist.build({
    CFBundleName: "$(PRODUCT_NAME)",
    CFBundleDisplayName: displayName,
    CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
    CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
    CFBundleExecutable: "$(EXECUTABLE_NAME)",
    CFBundleInfoDictionaryVersion: "6.0",
    CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
    NSExtension: {
      NSExtensionAttributes: {
        NSExtensionActivationRule: {
          // Reels/shorts/links/photos/files — kept permissive but capped so the
          // share sheet does not advertise Curio for huge multi-selections.
          NSExtensionActivationSupportsWebURLWithMaxCount: 1,
          NSExtensionActivationSupportsWebPageWithMaxCount: 1,
          NSExtensionActivationSupportsText: true,
          NSExtensionActivationSupportsImageWithMaxCount: 3,
          NSExtensionActivationSupportsMovieWithMaxCount: 1,
          NSExtensionActivationSupportsFileWithMaxCount: 1,
        },
      },
      NSExtensionMainStoryboard: "MainInterface",
      NSExtensionPointIdentifier: "com.apple.share-services",
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Xcode target creation (adapted from expo-share-intent's MIT-licensed plugin)
// ─────────────────────────────────────────────────────────────────────────
function getMainAppDevelopmentTeam(pbx) {
  const configs = pbx.pbxXCBuildConfigurationSection();
  for (const key in configs) {
    const cfg = configs[key];
    const bs = cfg.buildSettings;
    if (!bs || !bs.PRODUCT_NAME) continue;
    const productName = String(bs.PRODUCT_NAME).replace(/"/g, "");
    if (productName.includes("Extension") || productName.includes("Widget")) continue;
    const team = bs.DEVELOPMENT_TEAM && String(bs.DEVELOPMENT_TEAM).replace(/"/g, "");
    if (team) return team;
  }
  return null;
}

/** Writes the extension sources (Swift, storyboard, plists). Exposed for testing. */
function writeExtensionSources(platformProjectRoot, displayName) {
  const dir = path.join(platformProjectRoot, EXT_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ShareViewController.swift"), SWIFT_SOURCE);
  fs.writeFileSync(path.join(dir, "MainInterface.storyboard"), storyboard);
  fs.writeFileSync(path.join(dir, "PrivacyInfo.xcprivacy"), privacyInfo);
  fs.writeFileSync(path.join(dir, `${EXT_NAME}-Info.plist`), extensionInfoPlist(displayName || "Curio"));
  return dir;
}

const withCurioShareExtension = (config) =>
  withXcodeProject(config, (cfg) => {
    const root = cfg.modRequest.platformProjectRoot;
    writeExtensionSources(root, cfg.name);

    // NO .entitlements file — the whole point of this plugin.

    // 2) Wire the Xcode target
    const pbx = cfg.modResults;
    if (pbx.pbxTargetByName(EXT_NAME)) {
      console.log(`[curio-share] ${EXT_NAME} target already exists — skipping`);
      return cfg;
    }

    const appIdentifier = cfg.ios?.bundleIdentifier;
    const extIdentifier = `${appIdentifier}.share`;
    const currentProjectVersion = cfg.ios?.buildNumber || "1";
    const marketingVersion = cfg.version || "1.0.0";
    const devTeam = getMainAppDevelopmentTeam(pbx);

    const sourceFiles = ["ShareViewController.swift"];
    const resourceFiles = ["MainInterface.storyboard", "PrivacyInfo.xcprivacy"];
    const configFiles = [`${EXT_NAME}-Info.plist`];

    // Group
    const extGroup = pbx.addPbxGroup(
      [...sourceFiles, ...resourceFiles, ...configFiles],
      EXT_NAME,
      EXT_NAME
    );
    const groups = pbx.hash.project.objects.PBXGroup;
    Object.keys(groups).forEach((key) => {
      if (typeof groups[key] === "object" && groups[key].name === undefined && groups[key].path === undefined) {
        pbx.addToPbxGroup(extGroup.uuid, key);
      }
    });

    // Work around addTarget bug when the project has a single target
    const projObjects = pbx.hash.project.objects;
    projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {};
    projObjects.PBXContainerItemProxy = projObjects.PBXContainerItemProxy || {};

    // Target + build phases
    const target = pbx.addTarget(EXT_NAME, "app_extension", EXT_NAME);
    pbx.addBuildPhase(sourceFiles, "PBXSourcesBuildPhase", "Sources", target.uuid);
    pbx.addBuildPhase(resourceFiles, "PBXResourcesBuildPhase", "Resources", target.uuid);
    pbx.addBuildPhase([], "PBXFrameworksBuildPhase", "Frameworks", target.uuid);

    // Build settings
    const configurations = pbx.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const buildConfig = configurations[key];
      const bs = buildConfig.buildSettings;
      if (!bs) continue;
      if (bs.PRODUCT_NAME === `"${EXT_NAME}"` || bs.PRODUCT_NAME === EXT_NAME) {
        bs.CLANG_ENABLE_MODULES = "YES";
        bs.INFOPLIST_FILE = `"${EXT_NAME}/${EXT_NAME}-Info.plist"`;
        bs.CODE_SIGN_STYLE = "Automatic";
        bs.CURRENT_PROJECT_VERSION = `"${currentProjectVersion}"`;
        bs.GENERATE_INFOPLIST_FILE = "YES";
        bs.MARKETING_VERSION = `"${marketingVersion}"`;
        bs.PRODUCT_BUNDLE_IDENTIFIER = `"${extIdentifier}"`;
        bs.SWIFT_EMIT_LOC_STRINGS = "YES";
        bs.SWIFT_VERSION = "5.0";
        bs.TARGETED_DEVICE_FAMILY = '"1,2"';
        // Deliberately NO CODE_SIGN_ENTITLEMENTS and NO app group.
        if (devTeam) bs.DEVELOPMENT_TEAM = devTeam;
      }
    }
    if (devTeam) {
      pbx.addTargetAttribute("DevelopmentTeam", devTeam);
      pbx.addTargetAttribute("DevelopmentTeam", devTeam, target);
    }

    console.log(`[curio-share] Created ${EXT_NAME} target (${extIdentifier}), scheme ${SCHEME}://, no entitlements`);
    return cfg;
  });

// Expo resolves a plugin file by calling its default export.
module.exports = withCurioShareExtension;
module.exports.default = withCurioShareExtension;
module.exports.withCurioShareExtension = withCurioShareExtension;
module.exports.writeExtensionSources = writeExtensionSources;
module.exports.EXT_NAME = EXT_NAME;
