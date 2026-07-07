/**
 * Motion design tokens — the app's shared animation vocabulary.
 *
 * Every interactive animation should pick from these named presets instead of
 * declaring inline spring numbers, so the whole app shares one physical feel.
 * (Slow ambient/theme transitions live in `placeTransition.ts`, which drives
 * CSS transitions rather than framer-motion springs.)
 */

/** Springs, ordered from most to least energetic. */
export const spring = {
  /** Direct-manipulation feedback: card slides, drags settling, presses. */
  snappy: { type: "spring", stiffness: 500, damping: 40 } as const,
  /** Structural movement: reveals, tab indicator, digit rolls, sheet travel. */
  smooth: { type: "spring", stiffness: 300, damping: 30 } as const,
  /** Entrances and ambient settling: cards appearing, empty states. */
  gentle: { type: "spring", stiffness: 150, damping: 20, mass: 0.8 } as const,
};

/** Tween durations (seconds) for fades where a spring would feel wrong. */
export const duration = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
};

export const easing = {
  out: "easeOut",
  in: "easeIn",
  inOut: "easeInOut",
} as const;

/** Standard fade used by tab panels and chrome that follows the active tab. */
export const TAB_FADE = { duration: duration.base, ease: easing.inOut };

/** Horizontal offset (px) panels rest at when inactive — shared-axis motion. */
export const TAB_SHIFT_PX = 24;

/** Entrance/exit variants for boarding-pass cards (full experience). */
export const cardVariantsFull = {
  hidden: { y: 20, opacity: 0, scale: 0.95 },
  show: { y: 0, opacity: 1, scale: 1, transition: spring.gentle },
  exit: { y: -20, opacity: 0, scale: 0.95, transition: { duration: duration.fast, ease: easing.in } },
};

/** Lighter variants for the mobile/reduced tier (no scale, shorter travel). */
export const cardVariantsLite = {
  hidden: { y: 12, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.2, ease: easing.out } },
  exit: { y: -12, opacity: 0, transition: { duration: 0.12, ease: easing.in } },
};

/** Tiny tap-confirm haptic on supporting devices. No-op elsewhere. */
export function hapticTap() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(10);
  }
}
