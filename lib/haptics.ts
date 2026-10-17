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

export function triggerHaptic(_type: HapticType = "light"): void {
  // Vibration turned off per user request
  return;
}
