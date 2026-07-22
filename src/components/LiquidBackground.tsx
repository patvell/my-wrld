"use client";

import React, { useEffect, useRef, useState } from "react";
import { CountryTheme } from "@/types/countryTheme";
import { hexToRgba } from "@/lib/colors";
import { PLACE_TRANSITION_CSS } from "@/lib/placeTransition";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";

interface LiquidBackgroundProps {
    theme: CountryTheme;
}

function BackgroundLayer({
    theme,
    showBlobs,
    blobBlurPx,
}: {
    theme: CountryTheme;
    showBlobs: boolean;
    blobBlurPx: number;
}) {
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

            {showBlobs &&
                theme.blobConfigs.map((blob, index) => (
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
                        filter: `blur(${blobBlurPx}px)`,
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
    const { isFullExperience, isMobile } = usePerformanceTier();
    // Blobs stay visible; keep blur lighter on narrow viewports so the first
    // paint stays snappy even though product UX is otherwise full experience.
    const showBlobs = true;
    const blobBlurPx = isFullExperience && !isMobile ? 96 : 56;
    const enableCrossfade = isFullExperience;

    const [settledTheme, setSettledTheme] = useState(theme);
    const [incomingTheme, setIncomingTheme] = useState(theme);
    const [overlayOpacity, setOverlayOpacity] = useState(0);
    const [isCrossfading, setIsCrossfading] = useState(false);
    const [overlayTransitionEnabled, setOverlayTransitionEnabled] = useState(true);

    const settledIsoRef = useRef(theme.countryIso);
    const settledThemeRef = useRef(theme);
    const incomingThemeRef = useRef(theme);
    const isCrossfadingRef = useRef(false);
    const overlayOpacityRef = useRef(0);
    const transitionGenRef = useRef(0);
    const completingGenRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    const cancelPendingRaf = () => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    const commitSettled = (next: CountryTheme) => {
        settledIsoRef.current = next.countryIso;
        settledThemeRef.current = next;
        incomingThemeRef.current = next;
        setSettledTheme(next);
        setIncomingTheme(next);
        setIsCrossfading(false);
        isCrossfadingRef.current = false;
        setOverlayOpacity(0);
        overlayOpacityRef.current = 0;
        setOverlayTransitionEnabled(true);
    };

    const startCrossfade = (target: CountryTheme) => {
        if (target.countryIso === incomingThemeRef.current.countryIso && isCrossfadingRef.current) {
            return;
        }

        transitionGenRef.current += 1;
        const gen = transitionGenRef.current;

        const fromTheme =
            isCrossfadingRef.current && overlayOpacityRef.current > 0
                ? incomingThemeRef.current
                : settledThemeRef.current;

        settledThemeRef.current = fromTheme;
        incomingThemeRef.current = target;
        setSettledTheme(fromTheme);
        setIncomingTheme(target);
        setIsCrossfading(true);
        isCrossfadingRef.current = true;

        cancelPendingRaf();

        // Snap overlay to 0 without animating backward (avoids jank on rapid toggles)
        setOverlayTransitionEnabled(false);
        setOverlayOpacity(0);
        overlayOpacityRef.current = 0;

        rafRef.current = requestAnimationFrame(() => {
            setOverlayTransitionEnabled(true);
            rafRef.current = requestAnimationFrame(() => {
                if (gen !== transitionGenRef.current) return;
                setOverlayOpacity(1);
                overlayOpacityRef.current = 1;
                completingGenRef.current = gen;
                rafRef.current = null;
            });
        });
    };

    useEffect(() => {
        const idleSameCountry =
            theme.countryIso === settledIsoRef.current && !isCrossfadingRef.current;

        if (idleSameCountry) {
            if (settledThemeRef.current !== theme) {
                commitSettled(theme);
            }
            return;
        }

        if (!enableCrossfade) {
            commitSettled(theme);
            return;
        }

        if (theme.countryIso === settledIsoRef.current && isCrossfadingRef.current) {
            // Toggled back before prior crossfade finished — must crossfade, not snap
            startCrossfade(theme);
            return;
        }

        if (theme.countryIso !== settledIsoRef.current) {
            startCrossfade(theme);
        }

        return cancelPendingRaf;
    }, [theme, enableCrossfade]);

    const handleOverlayTransitionEnd = (
        event: React.TransitionEvent<HTMLDivElement>
    ) => {
        if (event.target !== event.currentTarget) return;
        if (event.propertyName !== "opacity") return;
        if (!overlayTransitionEnabled) return;
        if (overlayOpacityRef.current !== 1) return;
        if (completingGenRef.current !== transitionGenRef.current) return;

        commitSettled(incomingThemeRef.current);
    };

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0">
                <BackgroundLayer theme={settledTheme} showBlobs={showBlobs} blobBlurPx={blobBlurPx} />
            </div>

            {enableCrossfade && isCrossfading && (
                <div
                    className="absolute inset-0"
                    style={{
                        opacity: overlayOpacity,
                        transition: overlayTransitionEnabled
                            ? `opacity ${PLACE_TRANSITION_CSS}`
                            : "none",
                    }}
                    onTransitionEnd={handleOverlayTransitionEnd}
                >
                    <BackgroundLayer theme={incomingTheme} showBlobs={showBlobs} blobBlurPx={blobBlurPx} />
                </div>
            )}
        </div>
    );
}
