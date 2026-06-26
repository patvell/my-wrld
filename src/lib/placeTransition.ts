/** Shared duration for place/country visual changes */
export const PLACE_TRANSITION_MS = 1600;

export const PLACE_TRANSITION_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export const PLACE_TRANSITION_CSS = `${PLACE_TRANSITION_MS}ms ${PLACE_TRANSITION_EASE}`;

/** Slightly softer than 300/30 — still springy, ~500ms settle */
export const PERSONA_SPRING = {
    type: "spring" as const,
    stiffness: 240,
    damping: 28,
};
