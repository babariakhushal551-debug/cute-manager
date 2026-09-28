// Generates assets/icon.png (1024 opaque), assets/adaptive-icon.png (1024, transparent),
// assets/splash-icon.png (512, transparent) — a cute heart + sparkle mark.
// Pure Node (zlib + manual PNG chunks). No deps.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");
mkdirSync(assets, { recursive: true });

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter none
    rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : null;
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- drawing ----------
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

// Heart parametric polygon (normalized to roughly [-1,1] box, y up -> flipped later)
function heartPath(n = 90) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 17, -y / 17]); // flip y for image coords
  }
  return pts;
}
function pip(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function sparklePath(n = 64) {
  // 4-point star
  const pts = [];
  const R = 1, r = 0.28;
  for (let i = 0; i < 8; i++) {
    const ang = (Math.PI / 2) * Math.floor(i / 2) + (i % 2 === 0 ? 0 : Math.PI / 4) * 0 + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? R : r;
    // rotate so points are up/down/left/right: start at -90deg
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    pts.push([rad * Math.cos(a), rad * Math.sin(a)]);
  }
  void n;
  return pts;
}

function heartCanvas(size, opts) {
  const { bg, fg, glyphScale, sparkle } = opts;
  const buf = Buffer.alloc(size * size * 4);
  const SS = 2; // supersample
  const heart = heartPath(90);
  const spark = sparklePath();
  // normalize heart to unit box centered at 0
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of heart) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const hc = (minY + maxY) / 2;
  const hScale = 2 / (maxY - minY); // fits [-1,1]
  const heartN = heart.map(([x, y]) => [x * hScale, (y - hc) * hScale]);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size; // 0..1
          const py = (y + (sy + 0.5) / SS) / size;
          let cr, cg, cb, ca;
          if (bg) {
            const t = Math.min(1, Math.max(0, px * 0.55 + py * 0.45));
            const rad = Math.hypot(px - 0.28, py - 0.25);
            const base = mix(bg[0], bg[1], t);
            const glow = Math.max(0, 1 - rad * 1.9);
            const c2 = mix(base, [255, 214, 235], glow * 0.35);
            cr = c2[0]; cg = c2[1]; cb = c2[2]; ca = 255;
          } else { cr = 0; cg = 0; cb = 0; ca = 0; }
          // glyph: heart centered slightly above middle
          const cx = (px - 0.5) * 2;
          const cy = (py - 0.46) * 2;
          const hx = cx / glyphScale;
          const hy = cy / glyphScale;
          if (pip(hx, hy, heartN)) {
            const ft = Math.min(1, Math.max(0, (hx + 1) / 2 * 0.5 + (hy + 1) / 2 * 0.5));
            const col = mix(fg[1], fg[0], ft);
            cr = col[0]; cg = col[1]; cb = col[2]; ca = 255;
          }
          if (sparkle) {
            const sxp = ((px - sparkle.x) * 2) / sparkle.s;
            const syp = ((py - sparkle.y) * 2) / sparkle.s;
            if (pip(sxp, syp, spark)) { cr = sparkle.color[0]; cg = sparkle.color[1]; cb = sparkle.color[2]; ca = 255; }
          }
          // accumulate (straight alpha over)
          const sa = ca / 255;
          r += cr * sa; g += cg * sa; b += cb * sa; a += sa;
        }
      }
      const n = SS * SS;
      const cov = a / n;
      const i = (y * size + x) * 4;
      if (cov > 0) {
        buf[i] = Math.round(r / a);
        buf[i + 1] = Math.round(g / a);
        buf[i + 2] = Math.round(b / a);
        buf[i + 3] = Math.round(cov * 255);
      }
    }
  }
  return encodePNG(size, size, buf);
}

const PINK = [255, 118, 176];
const VIOLET = [124, 92, 255];
const WHITE = [255, 255, 255];

// 1) App icon (opaque, glyph 62%)
writeFileSync(join(assets, "icon.png"), heartCanvas(1024, {
  bg: [PINK, VIOLET],
  fg: [[255, 214, 236], WHITE],
  glyphScale: 0.62,
  sparkle: { x: 0.74, y: 0.24, s: 0.11, color: [255, 244, 214] },
}));

// 2) Adaptive foreground (transparent, glyph 55%)
writeFileSync(join(assets, "adaptive-icon.png"), heartCanvas(1024, {
  bg: null,
  fg: [[255, 214, 236], WHITE],
  glyphScale: 0.55,
  sparkle: { x: 0.72, y: 0.26, s: 0.1, color: [255, 244, 214] },
}));

// 3) Splash icon (transparent, glyph 70%)
writeFileSync(join(assets, "splash-icon.png"), heartCanvas(512, {
  bg: null,
  fg: [[255, 150, 200], VIOLET],
  glyphScale: 0.7,
  sparkle: { x: 0.74, y: 0.24, s: 0.12, color: [255, 193, 77] },
}));

console.log("icons written to", assets);
