"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useMemo,
} from "react";
import { animate } from "framer-motion";
import { PersonaMode } from "@/types";
import { getCountryTheme } from "@/lib/countryTheme";
import { lerpCountryTheme } from "@/lib/lerpCountryTheme";
import { applyThemeChrome } from "@/lib/applyThemeChrome";
import {
    THEME_TRANSITION_MS,
    THEME_TRANSITION_MOTION_EASE,
} from "@/lib/themeTransition";
import { CountryTheme } from "@/types/countryTheme";

interface PlaceTransitionState {
    progress: number;
    isTransitioning: boolean;
    fromTheme: CountryTheme;
    toTheme: CountryTheme;
    displayTheme: CountryTheme;
    fromPersona: PersonaMode;
    toPersona: PersonaMode;
}

const defaultTheme = getCountryTheme("YUL");

const PlaceTransitionContext = createContext<PlaceTransitionState>({
    progress: 1,
    isTransitioning: false,
    fromTheme: defaultTheme,
    toTheme: defaultTheme,
    displayTheme: defaultTheme,
    fromPersona: "plane",
    toPersona: "plane",
});

export function usePlaceTransition() {
    return useContext(PlaceTransitionContext);
}

interface PlaceTransitionProviderProps {
    airportCode: string;
    persona: PersonaMode;
    children: React.ReactNode;
}

export function PlaceTransitionProvider({
    airportCode,
    persona,
    children,
}: PlaceTransitionProviderProps) {
    const targetTheme = getCountryTheme(airportCode);

    const [fromTheme, setFromTheme] = useState(targetTheme);
    const [toTheme, setToTheme] = useState(targetTheme);
    const [fromPersona, setFromPersona] = useState(persona);
    const [toPersona, setToPersona] = useState(persona);
    const [progress, setProgress] = useState(1);
    const [displayTheme, setDisplayTheme] = useState(targetTheme);

    const settledAirportRef = useRef(airportCode);
    const settledPersonaRef = useRef(persona);
    const displayRef = useRef({
        fromTheme: targetTheme,
        toTheme: targetTheme,
        fromPersona: persona,
        toPersona: persona,
        progress: 1,
    });

    useEffect(() => {
        const airportChanged = airportCode !== settledAirportRef.current;
        const personaChanged = persona !== settledPersonaRef.current;

        if (!airportChanged && !personaChanged) {
            applyThemeChrome(targetTheme);
            return;
        }

        const nextTheme = getCountryTheme(airportCode);
        const prevTheme = getCountryTheme(settledAirportRef.current);
        const prevPersona = settledPersonaRef.current;

        const countryChanged = prevTheme.countryIso !== nextTheme.countryIso;

        if (!countryChanged) {
            settledAirportRef.current = airportCode;
            settledPersonaRef.current = persona;
            displayRef.current = {
                fromTheme: nextTheme,
                toTheme: nextTheme,
                fromPersona: persona,
                toPersona: persona,
                progress: 1,
            };
            setFromTheme(nextTheme);
            setToTheme(nextTheme);
            setFromPersona(persona);
            setToPersona(persona);
            setProgress(1);
            setDisplayTheme(nextTheme);
            applyThemeChrome(nextTheme);
            return;
        }

        const { progress: currentProgress, fromTheme: animFrom, toTheme: animTo } =
            displayRef.current;

        const startFromTheme =
            currentProgress < 1
                ? lerpCountryTheme(animFrom, animTo, currentProgress)
                : prevTheme;

        const startFromPersona = currentProgress < 1 ? displayRef.current.fromPersona : prevPersona;

        displayRef.current = {
            fromTheme: startFromTheme,
            toTheme: nextTheme,
            fromPersona: startFromPersona,
            toPersona: persona,
            progress: 0,
        };

        setFromTheme(startFromTheme);
        setToTheme(nextTheme);
        setFromPersona(startFromPersona);
        setToPersona(persona);
        setProgress(0);
        setDisplayTheme(startFromTheme);
        applyThemeChrome(startFromTheme);

        const controls = animate(0, 1, {
            duration: THEME_TRANSITION_MS / 1000,
            ease: [...THEME_TRANSITION_MOTION_EASE],
            onUpdate: (value) => {
                displayRef.current.progress = value;
                const blended = lerpCountryTheme(startFromTheme, nextTheme, value);
                setProgress(value);
                setDisplayTheme(blended);
                applyThemeChrome(blended);
            },
            onComplete: () => {
                settledAirportRef.current = airportCode;
                settledPersonaRef.current = persona;
                displayRef.current = {
                    fromTheme: nextTheme,
                    toTheme: nextTheme,
                    fromPersona: persona,
                    toPersona: persona,
                    progress: 1,
                };
                setFromTheme(nextTheme);
                setToTheme(nextTheme);
                setFromPersona(persona);
                setToPersona(persona);
                setProgress(1);
                setDisplayTheme(nextTheme);
                applyThemeChrome(nextTheme);
            },
        });

        return () => controls.stop();
    }, [airportCode, persona]);

    const isTransitioning =
        progress < 1 && fromTheme.countryIso !== toTheme.countryIso;

    const value = useMemo(
        () => ({
            progress,
            isTransitioning,
            fromTheme,
            toTheme,
            displayTheme,
            fromPersona,
            toPersona,
        }),
        [progress, isTransitioning, fromTheme, toTheme, displayTheme, fromPersona, toPersona]
    );

    return (
        <PlaceTransitionContext.Provider value={value}>
            {children}
        </PlaceTransitionContext.Provider>
    );
}
