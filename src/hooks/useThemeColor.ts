"use client";

import { useEffect } from "react";
import { PLACE_TRANSITION_CSS } from "@/lib/placeTransition";

/** Syncs theme color with browser chrome and CSS variables. */
export function useThemeColor(color: string) {
    useEffect(() => {
        if (typeof document === "undefined") return;

        document.documentElement.style.setProperty(
            "--theme-transition",
            PLACE_TRANSITION_CSS
        );

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
