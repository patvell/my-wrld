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
                style={{ backgroundColor: "#F8F6F3" }}
            />

            {/* Soft diagonal wash */}
            <div
                className="absolute inset-0 opacity-45 transition-opacity duration-[3000ms]"
                style={{
                    background: `linear-gradient(135deg, ${c0}88 0%, ${c1}66 45%, #F8F6F3 100%)`,
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
                            opacity: 0.34,
                            filter: "blur(90px)",
                            animationDelay: `${index * 4}s`,
                        }}
                    />
                );
            })}

            {/* Liquid sheen */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/45 via-transparent to-transparent opacity-70 pointer-events-none" />

            {/* Gentle depth */}
            <div className="absolute inset-0 bg-gradient-to-tl from-black/[0.03] via-transparent to-transparent pointer-events-none" />
        </div>
    );
}
