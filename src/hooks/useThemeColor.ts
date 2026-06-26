"use client";

import { useEffect } from "react";
import { CountryTheme } from "@/types/countryTheme";
import { THEME_TRANSITION_STYLE } from "@/lib/themeTransition";

/**
 * Syncs country theme colors to CSS variables and browser chrome,
 * using the same transition timing as the background crossfade.
 */
export function useCountryThemeStyles(theme: CountryTheme) {
    useEffect(() => {
        if (typeof document === "undefined") return;

        const root = document.documentElement;
        root.style.setProperty("--country-chrome", theme.chromeColor);
        root.style.setProperty("--dynamic-background", theme.themeColor);
        root.style.setProperty("--theme-transition", THEME_TRANSITION_STYLE);

        document.body.style.transition = `background-color ${THEME_TRANSITION_STYLE}`;

        let metaThemeColor = document.querySelector(
            'meta[name="theme-color"]'
        ) as HTMLMetaElement | null;

        if (!metaThemeColor) {
            metaThemeColor = document.createElement("meta");
            metaThemeColor.name = "theme-color";
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = theme.themeColor;

        document.body.style.backgroundColor = theme.themeColor;
        root.style.backgroundColor = theme.themeColor;
    }, [theme.countryIso, theme.chromeColor, theme.themeColor]);
}

/** @deprecated Use useCountryThemeStyles */
export function useThemeColor(color: string) {
    useEffect(() => {
        if (typeof document === "undefined") return;

        let metaThemeColor = document.querySelector(
            'meta[name="theme-color"]'
        ) as HTMLMetaElement | null;

        if (!metaThemeColor) {
            metaThemeColor = document.createElement("meta");
            metaThemeColor.name = "theme-color";
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = color;

        document.documentElement.style.setProperty("--dynamic-background", color);
        document.body.style.backgroundColor = color;
        document.documentElement.style.backgroundColor = color;
    }, [color]);
}
