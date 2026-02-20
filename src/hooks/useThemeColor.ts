"use client";

import { useEffect } from "react";

/**
 * Hook to sync a color with the browser's theme-color meta tag
 * and a CSS variable for global background styling.
 */
export function useThemeColor(color: string) {
    useEffect(() => {
        if (typeof document === "undefined") return;

        // 1. Update/Create the <meta name="theme-color"> tag
        let metaThemeColor = document.querySelector(
            'meta[name="theme-color"]'
        ) as HTMLMetaElement | null;

        if (!metaThemeColor) {
            metaThemeColor = document.createElement("meta");
            metaThemeColor.name = "theme-color";
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = color;

        // 2. Set dynamic background CSS variable on documentElement
        // This allows CSS to react to the color change
        document.documentElement.style.setProperty("--dynamic-background", color);

        // 3. Redundantly set body background color for immediate effect/fallbacks
        document.body.style.backgroundColor = color;
        document.documentElement.style.backgroundColor = color;

    }, [color]);
}
