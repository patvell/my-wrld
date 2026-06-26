/** Shared timing for country theme transitions (background, chrome, body). */
export const THEME_TRANSITION_MS = 3000;

export const THEME_TRANSITION_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export const THEME_TRANSITION_STYLE = `${THEME_TRANSITION_MS}ms ${THEME_TRANSITION_EASE}`;

/** Framer Motion cubic-bezier tuple */
export const THEME_TRANSITION_MOTION_EASE = [0.16, 1, 0.3, 1] as const;
