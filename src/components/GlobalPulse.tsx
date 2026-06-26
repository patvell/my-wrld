import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaMode } from "@/types";
import { Plane, Home } from "lucide-react";
import { getAirportTimezone, AIRPORTS } from "@/data/airports";
import { getReadableTextColors } from "@/lib/colors";
import { CountryTheme } from "@/types/countryTheme";
import { THEME_TRANSITION_STYLE } from "@/lib/themeTransition";

interface GlobalPulseProps {
    partnerCity?: string;
    partnerCode?: string;
    faCity?: string;
    faCode?: string;
    persona: PersonaMode;
    onTogglePersona: () => void;
    isLoading?: boolean;
    countryTheme: CountryTheme;
}

export default function GlobalPulse({
    partnerCity = "Montreal",
    partnerCode = "YUL",
    faCity = "Dubai",
    faCode = "DXB",
    persona,
    onTogglePersona,
    isLoading = false,
    countryTheme,
}: GlobalPulseProps) {
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState<Date | null>(null);

    const readable = getReadableTextColors(countryTheme.effectiveBg);
    const { primary: textColor, secondary: subTextColor, muted: iconColor, onFrosted } = readable;
    const useFrostedChrome = readable.primary === "#171717";
    const colorTransition = { transition: `color ${THEME_TRANSITION_STYLE}` };

    const partnerTimezone = getAirportTimezone(partnerCode);
    const faTimezone = getAirportTimezone(faCode);


    // Update clocks every second for better precision, though minute is fine
    // Use effect to handle mounting state
    useEffect(() => {
        setMounted(true);
        setNow(new Date());
    }, []);

    // Update clocks every second
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (timezone: string) => {
        if (!now) return "--:--";
        return new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timezone,
        }).format(now);
    };

    const formatDate = (timezone: string) => {
        if (!now) return "...";
        return new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            day: "numeric",
            month: "short",
            timeZone: timezone,
        }).format(now).toUpperCase();
    };

    const getTimeDiffText = (tzBig: string, tzSmall: string) => {
        if (!now) return "";
        // Use a fixed date to calculate offset to avoid DST edge cases during the transition itself
        // but for a simple live clock, this approach is usually acceptable
        const dtBig = new Date(now.toLocaleString("en-US", { timeZone: tzBig }));
        const dtSmall = new Date(now.toLocaleString("en-US", { timeZone: tzSmall }));
        
        // We round to handle half-hour timezones (like India +5:30)
        const diffMs = dtBig.getTime() - dtSmall.getTime();
        const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2;
        
        if (diffHours === 0) return "SAME TIME";
        const sign = diffHours > 0 ? "+" : "";
        return `${sign}${diffHours}HR`;
    };

    const togglePersona = () => {
        onTogglePersona();
    };

    // Determine big and small timezones for the difference calculation
    const bigTz = persona === "plane" ? faTimezone : partnerTimezone;
    const smallTz = persona === "plane" ? partnerTimezone : faTimezone;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 p-6 pt-16 pb-12 flex flex-col items-center gap-8 transition-colors duration-1000 overflow-hidden pointer-events-none">
            {/* Background handled by parent now */}

            {/* Main Display Area */}
            <div className="flex flex-col items-center justify-center w-full max-w-lg gap-2 pointer-events-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={persona}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="flex flex-col items-center"
                    >
                        {/* Status Label */}
                        <div className="flex items-center gap-2 mb-2">
                            {persona === "plane" ? (
                                <Plane size={14} style={{ color: iconColor, ...colorTransition }} />
                            ) : (
                                <Home size={14} style={{ color: iconColor, ...colorTransition }} />
                            )}
                            <span
                                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                                style={{ color: iconColor, ...colorTransition }}
                            >
                                {isLoading ? (
                                    <div className="h-[10px] w-24 bg-white/10 rounded animate-shimmer" />
                                ) : (
                                    persona === "plane" ? "CURRENTLY EXPLORING" : "AT HOME"
                                )}
                            </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-baseline gap-3 mb-1">
                            {isLoading ? (
                                <>
                                    <div className="h-8 w-16 bg-white/10 rounded animate-shimmer" />
                                    <div className="h-4 w-32 bg-white/5 rounded animate-shimmer" />
                                </>
                            ) : (
                                <>
                                    <span
                                        className="text-2xl font-bold tracking-tight"
                                        style={{ color: textColor, ...colorTransition }}
                                    >
                                        {persona === "plane" ? faCode : partnerCode}
                                    </span>
                                    <span
                                        className="text-lg font-medium tracking-wide"
                                        style={{ color: subTextColor, ...colorTransition }}
                                    >
                                        {persona === "plane"
                                            ? (AIRPORTS[faCode]?.countryIso ? `${faCity.toUpperCase()}, ${AIRPORTS[faCode].countryIso}` : faCity.toUpperCase())
                                            : (AIRPORTS[partnerCode]?.countryIso ? `${partnerCity.toUpperCase()}, ${AIRPORTS[partnerCode].countryIso}` : partnerCity.toUpperCase())
                                        }
                                    </span>
                                </>
                            )}
                        </div>


                        {/* Main Time (Prominent) */}
                        <h1
                            className="text-8xl font-medium tracking-tighter leading-none"
                            style={{
                                color: textColor,
                                ...colorTransition,
                                textShadow: useFrostedChrome
                                    ? "0 1px 2px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.5)"
                                    : "0 2px 12px rgba(0,0,0,0.25)",
                            }}
                        >
                            {mounted ? (persona === "plane" ? formatTime(faTimezone) : formatTime(partnerTimezone)) : "--:--"}
                        </h1>

                        {/* Date */}
                        <span
                            className="text-xs font-bold uppercase tracking-widest mt-4 flex items-center gap-2"
                            style={{ color: subTextColor, ...colorTransition }}
                        >
                            {mounted ? (
                                <>
                                    {persona === "plane" ? formatDate(faTimezone) : formatDate(partnerTimezone)}
                                    <span className="opacity-50">•</span>
                                    <span>{getTimeDiffText(bigTz, smallTz)}</span>
                                </>
                            ) : "..."}
                        </span>

                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Secondary Clock (Toggle Trigger) */}
            <motion.div
                animate={{
                    scale: [1, 1.03, 1],
                }}
                transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePersona}
                className="cursor-pointer group relative overflow-hidden rounded-full glass-dark border px-6 py-3 flex items-center gap-4 transition-all hover:bg-black/40 pointer-events-auto shadow-lg shadow-black/10"
                style={{ borderColor: useFrostedChrome ? "rgba(255,255,255,0.15)" : subTextColor }}
            >
                <div className="flex flex-col items-end">
                    <span
                        className="text-xs font-bold"
                        style={{ color: useFrostedChrome ? onFrosted : textColor, ...colorTransition }}
                    >
                        {mounted ? (persona === "plane" ? formatTime(partnerTimezone) : formatTime(faTimezone)) : "--:--"}
                    </span>
                    <span
                        className="text-[9px] font-bold tracking-wider"
                        style={{ color: useFrostedChrome ? "rgba(255,255,255,0.65)" : subTextColor, ...colorTransition }}
                    >
                        {persona === "plane" ? partnerCode : faCode}
                    </span>
                </div>

                <div className="h-6 w-[1px] bg-white/20" />

                <div
                    className="flex items-center justify-center transition-colors"
                    style={{ color: useFrostedChrome ? onFrosted : iconColor, ...colorTransition }}
                >
                    {persona === "plane" ? (
                        <Home size={18} />
                    ) : (
                        <Plane size={18} />
                    )}
                </div>
            </motion.div>
        </div>
    );
}
