"use client";

import React from "react";
import { CountryTheme } from "@/types/countryTheme";

interface LiquidBackgroundProps {
    theme: CountryTheme;
}

const BASE_BLOB_POSITIONS = [
    { top: 6, left: 4, size: 58 },
    { top: 20, left: 64, size: 50 },
    { top: 62, left: 22, size: 54 },
] as const;

export default function LiquidBackground({ theme }: LiquidBackgroundProps) {
    const [c0, c1, c2] = theme.washColors;

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div
                className="absolute inset-0 transition-colors duration-[3000ms]"
                style={{ backgroundColor: "#FAFAF8" }}
            />

            {/* Country-specific diagonal blend */}
            <div
                className="absolute inset-0 transition-all duration-[3000ms]"
                style={{
                    opacity: 0.72,
                    background: `linear-gradient(${theme.gradientAngle}deg, ${c0} 0%, ${c1} 38%, ${c2} 72%, #FAFAF8 100%)`,
                }}
            />

            {/* Liquid blooms — position shifts per country */}
            {theme.washColors.map((color, index) => {
                const base = BASE_BLOB_POSITIONS[index] ?? BASE_BLOB_POSITIONS[2];
                const offset = theme.blobOffsets[index] ?? { top: 0, left: 0 };
                return (
                    <div
                        key={`${theme.countryIso}-${index}`}
                        className="absolute rounded-full liquid-blob transition-all duration-[3000ms]"
                        style={{
                            top: `calc(${base.top + offset.top}%)`,
                            left: `calc(${base.left + offset.left}%)`,
                            width: `${base.size}vw`,
                            height: `${base.size}vw`,
                            backgroundColor: color,
                            opacity: index === 0 ? 0.42 : 0.34,
                            filter: "blur(88px)",
                            animationDelay: `${index * 4}s`,
                        }}
                    />
                );
            })}

            {/* Light veil over content zone — readable text without erasing country color */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_32%,rgba(255,255,255,0.42)_0%,transparent_68%)] pointer-events-none" />

            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-50 pointer-events-none" />
        </div>
    );
}
