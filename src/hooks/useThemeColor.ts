"use client";

import { useEffect } from "react";
import { THEME_TRANSITION_STYLE } from "@/lib/themeTransition";

/** One-time setup for CSS transition helpers; colors are driven by LiquidBackground. */
export function useCountryThemeStyles() {
    useEffect(() => {
        if (typeof document === "undefined") return;

        document.documentElement.style.setProperty(
            "--theme-transition",
            THEME_TRANSITION_STYLE
        );
        document.body.style.transition = `background-color ${THEME_TRANSITION_STYLE}`;
    }, []);
}
