/**
 * Universal Haptic Feedback utility for mobile web.
 * Uses native Navigator.vibrate API where supported (Android Chrome, Samsung Internet, Edge, Firefox).
 * Gracefully no-ops on unsupported devices (iOS WebKit / Safari) without errors or performance overhead.
 */

export type HapticType =
  | "selection" // ultra subtle tap (10ms) - for variants, pills, radio buttons
  | "light" // crisp light tap (15ms) - for quantity + / -
  | "medium" // confirmatory tap (25ms) - for CTA Order Now / Add to Cart
  | "success" // celebratory double pulse ([25, 45, 25]ms) - order placed
  | "error"; // warning buzz ([45, 60, 45]ms) - validation error

export function triggerHaptic(type: HapticType = "light"): void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    switch (type) {
      case "selection":
        // 35ms ensures standard Android ERM motors overcome inertia and produce a subtle click
        navigator.vibrate(35);
        break;
      case "light":
        // 45ms for quantity and option toggles
        navigator.vibrate(45);
        break;
      case "medium":
        // 65ms confirmatory feel for Order Now and CTA
        navigator.vibrate(65);
        break;
      case "success":
        // Celebratory double buzz
        navigator.vibrate([50, 75, 50]);
        break;
      case "error":
        // Warning buzz
        navigator.vibrate([60, 80, 60]);
        break;
      default:
        navigator.vibrate(45);
    }
  } catch {
    // Ignore any browser permission restrictions
  }
}
