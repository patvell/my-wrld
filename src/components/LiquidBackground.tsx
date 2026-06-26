"use client";

import React from "react";
import { CountryTheme } from "@/types/countryTheme";
import { hexToRgba } from "@/lib/colors";

interface LiquidBackgroundProps {
    theme: CountryTheme;
}

export default function LiquidBackground({ theme }: LiquidBackgroundProps) {
    const [c0, c1, c2] = theme.washColors;
    const veil = theme.contentVeil;

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {/* Country-tinted base */}
            <div
                className="absolute inset-0 transition-colors duration-[3000ms]"
                style={{ backgroundColor: theme.baseTint }}
            />

            {/* Primary liquid mesh */}
            <div
                className="absolute inset-0 transition-all duration-[3000ms]"
                style={{
                    backgroundImage: [
                        `radial-gradient(ellipse 90% 70% at 18% 22%, ${hexToRgba(c0, 0.55)} 0%, transparent 62%)`,
                        `radial-gradient(ellipse 80% 65% at 82% 18%, ${hexToRgba(c1, 0.48)} 0%, transparent 60%)`,
                        `radial-gradient(ellipse 85% 75% at 55% 88%, ${hexToRgba(c2, 0.5)} 0%, transparent 64%)`,
                    ].join(", "),
                }}
            />

            {/* Cross-wash for depth — unique angle per country */}
            <div
                className="absolute inset-0 transition-all duration-[3000ms]"
                style={{
                    opacity: 0.55,
                    background: `linear-gradient(${theme.gradientAngle}deg, ${hexToRgba(c0, 0.35)} 0%, transparent 42%, ${hexToRgba(c1, 0.28)} 68%, transparent 100%)`,
                }}
            />
            <div
                className="absolute inset-0 transition-all duration-[3000ms]"
                style={{
                    opacity: 0.45,
                    background: `linear-gradient(${theme.secondaryAngle}deg, transparent 0%, ${hexToRgba(c2, 0.3)} 50%, transparent 100%)`,
                }}
            />

            {/* Drifting liquid blobs — per-country size, speed, position */}
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
                        transition:
                            "top 3s ease, left 3s ease, background-color 3s ease, opacity 3s ease",
                    }}
                />
            ))}

            {/* Adaptive legibility veil — stronger only where color is more intense */}
            <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-[3000ms]"
                style={{
                    background: `radial-gradient(ellipse 75% 58% at 50% 30%, rgba(255,255,255,${veil}) 0%, rgba(255,255,255,${veil * 0.35}) 45%, transparent 72%)`,
                }}
            />

            {/* Soft highlight */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-40 pointer-events-none" />
        </div>
    );
}
