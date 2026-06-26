"use client";

import React, { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { getCountryTheme } from "@/lib/countryTheme";
import { lerpCountryTheme } from "@/lib/lerpCountryTheme";
import { hexToRgba } from "@/lib/colors";
import {
    THEME_TRANSITION_MS,
    THEME_TRANSITION_MOTION_EASE,
} from "@/lib/themeTransition";
import { CountryTheme } from "@/types/countryTheme";

interface LiquidBackgroundProps {
    airportCode: string;
}

function BackgroundLayer({ theme }: { theme: CountryTheme }) {
    const [c0, c1, c2] = theme.washColors;
    const veil = theme.contentVeil;

    return (
        <>
            <div className="absolute inset-0" style={{ backgroundColor: theme.baseTint }} />

            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: [
                        `radial-gradient(ellipse 90% 70% at 18% 22%, ${hexToRgba(c0, 0.55)} 0%, transparent 62%)`,
                        `radial-gradient(ellipse 80% 65% at 82% 18%, ${hexToRgba(c1, 0.48)} 0%, transparent 60%)`,
                        `radial-gradient(ellipse 85% 75% at 55% 88%, ${hexToRgba(c2, 0.5)} 0%, transparent 64%)`,
                    ].join(", "),
                }}
            />

            <div
                className="absolute inset-0"
                style={{
                    opacity: 0.55,
                    background: `linear-gradient(${theme.gradientAngle}deg, ${hexToRgba(c0, 0.35)} 0%, transparent 42%, ${hexToRgba(c1, 0.28)} 68%, transparent 100%)`,
                }}
            />
            <div
                className="absolute inset-0"
                style={{
                    opacity: 0.45,
                    background: `linear-gradient(${theme.secondaryAngle}deg, transparent 0%, ${hexToRgba(c2, 0.3)} 50%, transparent 100%)`,
                }}
            />

            {theme.blobConfigs.map((blob, index) => (
                <div
                    key={`${theme.countryIso}-blob-${index}`}
                    className="absolute rounded-full liquid-blob"
                    style={{
                        top: `${blob.top}%`,
                        left: `${blob.left}%`,
                        width: `${blob.size}vw`,
                        height: `${blob.size}vw`,
                        backgroundColor: blob.color,
                        opacity: blob.opacity,
                        filter: "blur(96px)",
                        animationDuration: `${blob.duration}s`,
                        animationDelay: `${blob.delay}s`,
                    }}
                />
            ))}

            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse 75% 58% at 50% 30%, rgba(255,255,255,${veil}) 0%, rgba(255,255,255,${veil * 0.35}) 45%, transparent 72%)`,
                }}
            />

            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-40 pointer-events-none" />
        </>
    );
}

export default function LiquidBackground({ airportCode }: LiquidBackgroundProps) {
    const targetTheme = getCountryTheme(airportCode);
    const [fromTheme, setFromTheme] = useState(targetTheme);
    const [toTheme, setToTheme] = useState(targetTheme);
    const [progress, setProgress] = useState(1);

    const settledCodeRef = useRef(airportCode);
    const displayRef = useRef({
        from: targetTheme,
        to: targetTheme,
        progress: 1,
    });

    useEffect(() => {
        if (airportCode === settledCodeRef.current) {
            return;
        }

        const nextTheme = getCountryTheme(airportCode);
        const prevTheme = getCountryTheme(settledCodeRef.current);

        if (prevTheme.countryIso === nextTheme.countryIso) {
            settledCodeRef.current = airportCode;
            displayRef.current = { from: nextTheme, to: nextTheme, progress: 1 };
            setFromTheme(nextTheme);
            setToTheme(nextTheme);
            setProgress(1);
            return;
        }

        const { from, to, progress: currentProgress } = displayRef.current;
        const startFrom =
            currentProgress < 1
                ? lerpCountryTheme(from, to, currentProgress)
                : prevTheme;

        displayRef.current = { from: startFrom, to: nextTheme, progress: 0 };
        setFromTheme(startFrom);
        setToTheme(nextTheme);
        setProgress(0);

        const controls = animate(0, 1, {
            duration: THEME_TRANSITION_MS / 1000,
            ease: [...THEME_TRANSITION_MOTION_EASE],
            onUpdate: (value) => {
                displayRef.current.progress = value;
                setProgress(value);
            },
            onComplete: () => {
                settledCodeRef.current = airportCode;
                displayRef.current = {
                    from: nextTheme,
                    to: nextTheme,
                    progress: 1,
                };
                setFromTheme(nextTheme);
                setToTheme(nextTheme);
                setProgress(1);
            },
        });

        return () => controls.stop();
    }, [airportCode]);

    const isCrossfading = fromTheme.countryIso !== toTheme.countryIso;
    const overlayOpacity = isCrossfading ? progress : 0;

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0">
                <BackgroundLayer theme={fromTheme} />
            </div>

            {isCrossfading && (
                <div
                    className="absolute inset-0"
                    style={{ opacity: overlayOpacity }}
                >
                    <BackgroundLayer theme={toTheme} />
                </div>
            )}
        </div>
    );
}
