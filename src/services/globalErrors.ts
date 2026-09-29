// Release-mode uncaught error handler.
//
// React error boundaries do NOT catch errors thrown outside render — e.g.
// inside a setTimeout, a Promise .then, or an event handler on the initial
// screen. Without this, those errors kill the app silently with no UI.
//
// Dev mode is left alone: the RedBox gives a far better debugging experience.
import { Alert } from "react-native";

let lastReport: { message: string; stack?: string } | null = null;

/** Install handlers. Idempotent — safe to call more than once. */
export function installGlobalErrorHandlers() {
  const defaultHandler = ErrorUtils.getGlobalHandler?.();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    // Always log so the message lands in the device console / crash log.
    console.error("[globalError]", error?.message, error?.stack ?? "");

    if (__DEV__) {
      // Preserve the standard dev behavior (RedBox / logbox).
      defaultHandler?.(error, isFatal);
      return;
    }

    lastReport = { message: error?.message ?? String(error), stack: error?.stack };
    Alert.alert(
      "Unexpected error",
      `${error?.message ?? "Something went wrong."}\n\nThe app will reload. Your data is safe on this device.`,
      [{ text: "Reload", onPress: () => defaultHandler?.(error, isFatal) }],
      { cancelable: false },
    );
  });
}

/** Last error captured by the global handler (useful for support/debug screens). */
export function getLastGlobalError() {
  return lastReport;
}
