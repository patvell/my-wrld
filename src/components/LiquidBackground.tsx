import React from "react";


interface LiquidBackgroundProps {
    primaryColor: string;
}

export default function LiquidBackground({ primaryColor }: LiquidBackgroundProps) {
    return (
        <div
            className="fixed inset-0 overflow-hidden pointer-events-none transition-colors duration-[3000ms]"
            style={{ backgroundColor: primaryColor }}
        >
            {/* Subtle Light Shade (Top Left) */}
            <div
                className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent opacity-50 pointer-events-none"
            />

            {/* Subtle Dark Shade (Bottom Right) */}
            <div
                className="absolute bottom-0 right-0 w-full h-full bg-gradient-to-tl from-black/20 to-transparent opacity-50 pointer-events-none"
            />
        </div>
    );
}
