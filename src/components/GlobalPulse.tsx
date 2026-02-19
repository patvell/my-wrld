import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PersonaMode } from "@/types";
import { Plane, Home } from "lucide-react";
import { getAirportColor, getAirportTimezone } from "@/data/airports";
import { getContrastHex } from "@/lib/colors";

interface GlobalPulseProps {
    partnerCity?: string;
    partnerCode?: string;
    faCity?: string;
    faCode?: string;
    persona: PersonaMode;
    onTogglePersona: () => void;
}

export default function GlobalPulse({
    partnerCity = "Montreal",
    partnerCode = "YUL",
    faCity = "Dubai",
    faCode = "DXB",
    persona,
    onTogglePersona,
}: GlobalPulseProps) {
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState<Date | null>(null);

    // Determine background color based on current location
    const currentLocationCode = persona === "home" ? partnerCode : faCode;
    const primaryColor = getAirportColor(currentLocationCode);

    // Get Timezones
    // Partner is always Montreal (YUL) as per request for now, or derived from code
    const partnerTimezone = getAirportTimezone(partnerCode);
    const faTimezone = getAirportTimezone(faCode);

    // Dynamic Text Color based on background luminance
    // We assume the top part is dominated by primaryColor or a mix. 
    // Let's use primary color as the main determinant for now, or an average.
    // For a "mosaic", it's safer to check contrast against the dominant color behind the text.
    const textColor = getContrastHex(primaryColor);
    const subTextColor = textColor === "#000000" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)";
    const iconColor = textColor === "#000000" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";


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

    const togglePersona = () => {
        onTogglePersona();
    };

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
                                <Plane size={14} style={{ color: iconColor }} />
                            ) : (
                                <Home size={14} style={{ color: iconColor }} />
                            )}
                            <span
                                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                                style={{ color: iconColor }}
                            >
                                {persona === "plane" ? "CURRENTLY EXPLORING" : "AT HOME"}
                            </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-baseline gap-3 mb-1">
                            <span
                                className="text-2xl font-bold tracking-tight"
                                style={{ color: textColor }}
                            >
                                {persona === "plane" ? faCode : partnerCode}
                            </span>
                            <span
                                className="text-lg font-medium tracking-wide"
                                style={{ color: subTextColor }}
                            >
                                {persona === "plane" ? faCity.toUpperCase() : partnerCity.toUpperCase()}
                            </span>
                        </div>


                        {/* Main Time (Prominent) */}
                        <h1
                            className="text-8xl font-medium tracking-tighter leading-none"
                            style={{ color: textColor }}
                        >
                            {mounted ? (persona === "plane" ? formatTime(faTimezone) : formatTime(partnerTimezone)) : "--:--"}
                        </h1>

                        {/* Date */}
                        <span
                            className="text-xs font-bold uppercase tracking-widest mt-4"
                            style={{ color: subTextColor }}
                        >
                            {mounted ? (persona === "plane" ? formatDate(faTimezone) : formatDate(partnerTimezone)) : "..."}
                        </span>

                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Secondary Clock (Toggle Trigger) */}
            <motion.div
                whileTap={{ scale: 0.95 }}
                onClick={togglePersona}
                className="cursor-pointer group relative overflow-hidden rounded-full glass border border-white/10 px-6 py-3 flex items-center gap-4 transition-all hover:bg-white/10 pointer-events-auto"
                style={{ borderColor: subTextColor }}
            >
                <div className="flex flex-col items-end">
                    <span
                        className="text-xs font-bold"
                        style={{ color: textColor }}
                    >
                        {mounted ? (persona === "plane" ? formatTime(partnerTimezone) : formatTime(faTimezone)) : "--:--"}
                    </span>
                    <span
                        className="text-[9px] font-bold tracking-wider"
                        style={{ color: subTextColor }}
                    >
                        {persona === "plane" ? partnerCode : faCode}
                    </span>
                </div>

                <div className="h-6 w-[1px]" style={{ backgroundColor: subTextColor }} />

                <div
                    className="flex items-center justify-center transition-colors"
                    style={{ color: iconColor }}
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
