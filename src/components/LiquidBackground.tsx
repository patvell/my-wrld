"use client";

import React from "react";
import { CountryTheme } from "@/types/countryTheme";

interface LiquidBackgroundProps {
    theme: CountryTheme;
}

const BLOB_POSITIONS = [
    { top: "8%", left: "5%", size: "55vw" },
    { top: "18%", left: "62%", size: "48vw" },
    { top: "58%", left: "28%", size: "52vw" },
] as const;

export default function LiquidBackground({ theme }: LiquidBackgroundProps) {
    const [c0, c1] = theme.washColors;

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {/* Luminous base */}
            <div
                className="absolute inset-0 transition-colors duration-[3000ms]"
                style={{ backgroundColor: "#FAFAF8" }}
            />

            {/* Soft diagonal wash — kept subtle so foreground text stays readable */}
            <div
                className="absolute inset-0 opacity-25 transition-opacity duration-[3000ms]"
                style={{
                    background: `linear-gradient(135deg, ${c0}66 0%, ${c1}44 45%, #FAFAF8 100%)`,
                }}
            />

            {/* Liquid color blooms */}
            {theme.washColors.map((color, index) => {
                const pos = BLOB_POSITIONS[index] ?? BLOB_POSITIONS[2];
                return (
                    <div
                        key={`${theme.countryIso}-${index}`}
                        className="absolute rounded-full liquid-blob transition-all duration-[3000ms]"
                        style={{
                            top: pos.top,
                            left: pos.left,
                            width: pos.size,
                            height: pos.size,
                            backgroundColor: color,
                            opacity: 0.18,
                            filter: "blur(100px)",
                            animationDelay: `${index * 4}s`,
                        }}
                    />
                );
            })}

            {/* Center lift — keeps the main content zone closer to neutral white */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_35%,rgba(255,255,255,0.85)_0%,transparent_70%)] pointer-events-none" />

            {/* Liquid sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent opacity-60 pointer-events-none" />
        </div>
    );
}
