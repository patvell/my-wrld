"use client";

import React, { useEffect, useRef, useState } from "react";
import { CountryTheme } from "@/types/countryTheme";
import { hexToRgba } from "@/lib/colors";
import { PLACE_TRANSITION_CSS } from "@/lib/placeTransition";

interface LiquidBackgroundProps {
    theme: CountryTheme;
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

export default function LiquidBackground({ theme }: LiquidBackgroundProps) {
    const [settledTheme, setSettledTheme] = useState(theme);
    const [incomingTheme, setIncomingTheme] = useState(theme);
    const [overlayOpacity, setOverlayOpacity] = useState(0);
    const [isCrossfading, setIsCrossfading] = useState(false);

    const settledIsoRef = useRef(theme.countryIso);
    const settledThemeRef = useRef(theme);
    const incomingThemeRef = useRef(theme);
    const isCrossfadingRef = useRef(false);
    const overlayOpacityRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (theme.countryIso === settledIsoRef.current) {
            settledThemeRef.current = theme;
            incomingThemeRef.current = theme;
            setSettledTheme(theme);
            setIncomingTheme(theme);
            setIsCrossfading(false);
            isCrossfadingRef.current = false;
            setOverlayOpacity(0);
            overlayOpacityRef.current = 0;
            return;
        }

        const baseTheme =
            isCrossfadingRef.current && overlayOpacityRef.current > 0
                ? incomingThemeRef.current
                : settledThemeRef.current;

        settledThemeRef.current = baseTheme;
        incomingThemeRef.current = theme;
        setSettledTheme(baseTheme);
        setIncomingTheme(theme);
        setIsCrossfading(true);
        isCrossfadingRef.current = true;
        setOverlayOpacity(0);
        overlayOpacityRef.current = 0;

        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = requestAnimationFrame(() => {
                setOverlayOpacity(1);
                overlayOpacityRef.current = 1;
                rafRef.current = null;
            });
        });

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [theme]);

    const handleOverlayTransitionEnd = (
        event: React.TransitionEvent<HTMLDivElement>
    ) => {
        if (event.propertyName !== "opacity" || overlayOpacityRef.current !== 1) {
            return;
        }

        settledIsoRef.current = incomingThemeRef.current.countryIso;
        settledThemeRef.current = incomingThemeRef.current;
        setSettledTheme(incomingThemeRef.current);
        setIsCrossfading(false);
        isCrossfadingRef.current = false;
        setOverlayOpacity(0);
        overlayOpacityRef.current = 0;
    };

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0">
                <BackgroundLayer theme={settledTheme} />
            </div>

            {isCrossfading && (
                <div
                    className="absolute inset-0"
                    style={{
                        opacity: overlayOpacity,
                        transition: `opacity ${PLACE_TRANSITION_CSS}`,
                    }}
                    onTransitionEnd={handleOverlayTransitionEnd}
                >
                    <BackgroundLayer theme={incomingTheme} />
                </div>
            )}
        </div>
    );
}
