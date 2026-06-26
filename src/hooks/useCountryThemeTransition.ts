"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { getCountryTheme } from "@/lib/countryTheme";
import { lerpCountryTheme } from "@/lib/lerpCountryTheme";
import {
    THEME_TRANSITION_MS,
    THEME_TRANSITION_MOTION_EASE,
} from "@/lib/themeTransition";
import { CountryTheme } from "@/types/countryTheme";

interface ThemeTransitionState {
    settledTheme: CountryTheme;
    targetTheme: CountryTheme;
    blendedTheme: CountryTheme;
    progress: number;
    isTransitioning: boolean;
}

export function useCountryThemeTransition(
    airportCode: string
): ThemeTransitionState {
    const targetTheme = getCountryTheme(airportCode);
    const [settledTheme, setSettledTheme] = useState(targetTheme);
    const [blendedTheme, setBlendedTheme] = useState(targetTheme);
    const [progress, setProgress] = useState(1);

    const settledRef = useRef(settledTheme);
    const progressRef = useRef(1);
    const animFromRef = useRef(targetTheme);
    const animToRef = useRef(targetTheme);

    useEffect(() => {
        settledRef.current = settledTheme;
    }, [settledTheme]);

    useEffect(() => {
        if (targetTheme.countryIso === settledRef.current.countryIso) {
            setBlendedTheme(targetTheme);
            setProgress(1);
            progressRef.current = 1;
            return;
        }

        const fromTheme =
            progressRef.current < 1
                ? lerpCountryTheme(
                      animFromRef.current,
                      animToRef.current,
                      progressRef.current
                  )
                : settledRef.current;

        animFromRef.current = fromTheme;
        animToRef.current = targetTheme;

        const controls = animate(0, 1, {
            duration: THEME_TRANSITION_MS / 1000,
            ease: [...THEME_TRANSITION_MOTION_EASE],
            onUpdate: (value) => {
                progressRef.current = value;
                setProgress(value);
                setBlendedTheme(
                    lerpCountryTheme(
                        animFromRef.current,
                        animToRef.current,
                        value
                    )
                );
            },
            onComplete: () => {
                settledRef.current = targetTheme;
                setSettledTheme(targetTheme);
                setBlendedTheme(targetTheme);
                progressRef.current = 1;
                setProgress(1);
            },
        });

        return () => controls.stop();
    }, [targetTheme.countryIso, targetTheme]);

    const isTransitioning =
        progress < 1 && settledTheme.countryIso !== targetTheme.countryIso;

    return {
        settledTheme,
        targetTheme,
        blendedTheme,
        progress,
        isTransitioning,
    };
}
