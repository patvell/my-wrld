"use client";

import { useEffect, useRef, useState } from "react";
import { CountryTheme } from "@/types/countryTheme";
import { hexToRgba } from "@/lib/colors";
import {
    THEME_TRANSITION_MS,
    THEME_TRANSITION_STYLE,
} from "@/lib/themeTransition";

interface LiquidBackgroundProps {
    theme: CountryTheme;
}

function BackgroundLayer({ theme }: { theme: CountryTheme }) {
    const [c0, c1, c2] = theme.washColors;
    const veil = theme.contentVeil;

    return (
        <>
            <div
                className="absolute inset-0"
                style={{ backgroundColor: theme.baseTint }}
            />

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
    const [baseTheme, setBaseTheme] = useState(theme);
    const [overlayTheme, setOverlayTheme] = useState<CountryTheme | null>(null);
    const [overlayVisible, setOverlayVisible] = useState(false);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (theme.countryIso === baseTheme.countryIso) {
            return;
        }

        setOverlayTheme(theme);
        setOverlayVisible(false);

        const startFade = requestAnimationFrame(() => {
            requestAnimationFrame(() => setOverlayVisible(true));
        });

        const complete = window.setTimeout(() => {
            setBaseTheme(theme);
            setOverlayTheme(null);
            setOverlayVisible(false);
        }, THEME_TRANSITION_MS);

        return () => {
            cancelAnimationFrame(startFade);
            window.clearTimeout(complete);
        };
    }, [theme, baseTheme.countryIso]);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0">
                <BackgroundLayer theme={baseTheme} />
            </div>

            {overlayTheme && (
                <div
                    className="absolute inset-0"
                    style={{
                        opacity: overlayVisible ? 1 : 0,
                        transition: `opacity ${THEME_TRANSITION_STYLE}`,
                    }}
                >
                    <BackgroundLayer theme={overlayTheme} />
                </div>
            )}
        </div>
    );
}
