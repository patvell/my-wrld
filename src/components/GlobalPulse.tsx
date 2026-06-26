import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PersonaMode } from "@/types";
import { Plane, Home } from "lucide-react";
import { getAirportTimezone, AIRPORTS } from "@/data/airports";
import { getReadableTextColors } from "@/lib/colors";
import { CountryTheme } from "@/types/countryTheme";
import { usePlaceTransition } from "@/components/PlaceTransitionProvider";

interface GlobalPulseProps {
    partnerCity?: string;
    partnerCode?: string;
    faCity?: string;
    faCode?: string;
    onTogglePersona: () => void;
    isLoading?: boolean;
}

interface PersonaContentProps {
    persona: PersonaMode;
    partnerCity: string;
    partnerCode: string;
    faCity: string;
    faCode: string;
    isLoading: boolean;
    mounted: boolean;
    now: Date | null;
    countryTheme: CountryTheme;
    partnerTimezone: string;
    faTimezone: string;
}

function PersonaContent({
    persona,
    partnerCity,
    partnerCode,
    faCity,
    faCode,
    isLoading,
    mounted,
    now,
    countryTheme,
    partnerTimezone,
    faTimezone,
}: PersonaContentProps) {
    const readable = getReadableTextColors(countryTheme.effectiveBg);
    const { primary: textColor, secondary: subTextColor, muted: iconColor } = readable;
    const useFrostedChrome = readable.primary === "#171717";

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
        })
            .format(now)
            .toUpperCase();
    };

    const getTimeDiffText = (tzBig: string, tzSmall: string) => {
        if (!now) return "";
        const dtBig = new Date(now.toLocaleString("en-US", { timeZone: tzBig }));
        const dtSmall = new Date(now.toLocaleString("en-US", { timeZone: tzSmall }));
        const diffMs = dtBig.getTime() - dtSmall.getTime();
        const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2;
        if (diffHours === 0) return "SAME TIME";
        const sign = diffHours > 0 ? "+" : "";
        return `${sign}${diffHours}HR`;
    };

    const bigTz = persona === "plane" ? faTimezone : partnerTimezone;
    const smallTz = persona === "plane" ? partnerTimezone : faTimezone;

    return (
        <div className="flex flex-col items-center">
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
                    {isLoading ? (
                        <div className="h-[10px] w-24 bg-white/10 rounded animate-shimmer" />
                    ) : persona === "plane" ? (
                        "CURRENTLY EXPLORING"
                    ) : (
                        "AT HOME"
                    )}
                </span>
            </div>

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
                            style={{ color: textColor }}
                        >
                            {persona === "plane" ? faCode : partnerCode}
                        </span>
                        <span
                            className="text-lg font-medium tracking-wide"
                            style={{ color: subTextColor }}
                        >
                            {persona === "plane"
                                ? AIRPORTS[faCode]?.countryIso
                                    ? `${faCity.toUpperCase()}, ${AIRPORTS[faCode].countryIso}`
                                    : faCity.toUpperCase()
                                : AIRPORTS[partnerCode]?.countryIso
                                  ? `${partnerCity.toUpperCase()}, ${AIRPORTS[partnerCode].countryIso}`
                                  : partnerCity.toUpperCase()}
                        </span>
                    </>
                )}
            </div>

            <h1
                className="text-8xl font-medium tracking-tighter leading-none"
                style={{
                    color: textColor,
                    textShadow: useFrostedChrome
                        ? "0 1px 2px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.5)"
                        : "0 2px 12px rgba(0,0,0,0.25)",
                }}
            >
                {mounted
                    ? persona === "plane"
                        ? formatTime(faTimezone)
                        : formatTime(partnerTimezone)
                    : "--:--"}
            </h1>

            <span
                className="text-xs font-bold uppercase tracking-widest mt-4 flex items-center gap-2"
                style={{ color: subTextColor }}
            >
                {mounted ? (
                    <>
                        {persona === "plane"
                            ? formatDate(faTimezone)
                            : formatDate(partnerTimezone)}
                        <span className="opacity-50">•</span>
                        <span>{getTimeDiffText(bigTz, smallTz)}</span>
                    </>
                ) : (
                    "..."
                )}
            </span>
        </div>
    );
}

export default function GlobalPulse({
    partnerCity = "Montreal",
    partnerCode = "YUL",
    faCity = "Dubai",
    faCode = "DXB",
    onTogglePersona,
    isLoading = false,
}: GlobalPulseProps) {
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState<Date | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [lockedHeight, setLockedHeight] = useState<number | undefined>();

    const {
        progress,
        isTransitioning,
        displayTheme,
        fromTheme,
        toTheme,
        fromPersona,
        toPersona,
    } = usePlaceTransition();

    const readable = getReadableTextColors(displayTheme.effectiveBg);
    const { primary: textColor, secondary: subTextColor, muted: iconColor, onFrosted } = readable;
    const useFrostedChrome = readable.primary === "#171717";

    const partnerTimezone = getAirportTimezone(partnerCode);
    const faTimezone = getAirportTimezone(faCode);

    useEffect(() => {
        setMounted(true);
        setNow(new Date());
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (isTransitioning && contentRef.current) {
            setLockedHeight(contentRef.current.offsetHeight);
        } else {
            setLockedHeight(undefined);
        }
    }, [isTransitioning]);

    const formatTime = (timezone: string) => {
        if (!now) return "--:--";
        return new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timezone,
        }).format(now);
    };

    const activePersona = toPersona;
    const outgoingOpacity = 1 - progress;
    const incomingOpacity = progress;
    const outgoingY = progress * -6;
    const incomingY = (1 - progress) * 6;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 p-6 pt-16 pb-12 flex flex-col items-center gap-8 transition-colors duration-1000 overflow-hidden pointer-events-none">
            <div
                ref={contentRef}
                className="flex flex-col items-center justify-center w-full max-w-lg gap-2 pointer-events-auto"
                style={lockedHeight ? { minHeight: lockedHeight } : undefined}
            >
                {isTransitioning ? (
                    <div className="relative w-full flex flex-col items-center">
                        <div
                            className="absolute inset-x-0 top-0 flex flex-col items-center"
                            style={{
                                opacity: outgoingOpacity,
                                transform: `translateY(${outgoingY}px)`,
                                pointerEvents: "none",
                            }}
                        >
                            <PersonaContent
                                persona={fromPersona}
                                partnerCity={partnerCity}
                                partnerCode={partnerCode}
                                faCity={faCity}
                                faCode={faCode}
                                isLoading={isLoading}
                                mounted={mounted}
                                now={now}
                                countryTheme={fromTheme}
                                partnerTimezone={partnerTimezone}
                                faTimezone={faTimezone}
                            />
                        </div>
                        <div
                            className="flex flex-col items-center"
                            style={{
                                opacity: incomingOpacity,
                                transform: `translateY(${incomingY}px)`,
                            }}
                        >
                            <PersonaContent
                                persona={toPersona}
                                partnerCity={partnerCity}
                                partnerCode={partnerCode}
                                faCity={faCity}
                                faCode={faCode}
                                isLoading={isLoading}
                                mounted={mounted}
                                now={now}
                                countryTheme={toTheme}
                                partnerTimezone={partnerTimezone}
                                faTimezone={faTimezone}
                            />
                        </div>
                    </div>
                ) : (
                    <PersonaContent
                        persona={activePersona}
                        partnerCity={partnerCity}
                        partnerCode={partnerCode}
                        faCity={faCity}
                        faCode={faCode}
                        isLoading={isLoading}
                        mounted={mounted}
                        now={now}
                        countryTheme={displayTheme}
                        partnerTimezone={partnerTimezone}
                        faTimezone={faTimezone}
                    />
                )}
            </div>

            <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                whileTap={{ scale: 0.95 }}
                onClick={onTogglePersona}
                className="cursor-pointer group relative overflow-hidden rounded-full glass-dark border px-6 py-3 flex items-center gap-4 transition-all hover:bg-black/40 pointer-events-auto shadow-lg shadow-black/10"
                style={{
                    borderColor: useFrostedChrome ? "rgba(255,255,255,0.15)" : subTextColor,
                }}
            >
                <div className="relative flex flex-col items-end min-w-[3rem]">
                    {isTransitioning ? (
                        <>
                            <span
                                className="absolute right-0 text-xs font-bold"
                                style={{
                                    color: useFrostedChrome ? onFrosted : textColor,
                                    opacity: outgoingOpacity,
                                }}
                            >
                                {mounted
                                    ? fromPersona === "plane"
                                        ? formatTime(partnerTimezone)
                                        : formatTime(faTimezone)
                                    : "--:--"}
                            </span>
                            <span
                                className="text-xs font-bold"
                                style={{
                                    color: useFrostedChrome ? onFrosted : textColor,
                                    opacity: incomingOpacity,
                                }}
                            >
                                {mounted
                                    ? toPersona === "plane"
                                        ? formatTime(partnerTimezone)
                                        : formatTime(faTimezone)
                                    : "--:--"}
                            </span>
                        </>
                    ) : (
                        <span
                            className="text-xs font-bold"
                            style={{ color: useFrostedChrome ? onFrosted : textColor }}
                        >
                            {mounted
                                ? activePersona === "plane"
                                    ? formatTime(partnerTimezone)
                                    : formatTime(faTimezone)
                                : "--:--"}
                        </span>
                    )}
                    <span
                        className="text-[9px] font-bold tracking-wider"
                        style={{
                            color: useFrostedChrome
                                ? "rgba(255,255,255,0.65)"
                                : subTextColor,
                        }}
                    >
                        {activePersona === "plane" ? partnerCode : faCode}
                    </span>
                </div>

                <div className="h-6 w-[1px] bg-white/20" />

                <div
                    className="flex items-center justify-center"
                    style={{ color: useFrostedChrome ? onFrosted : iconColor }}
                >
                    {activePersona === "plane" ? <Home size={18} /> : <Plane size={18} />}
                </div>
            </motion.div>
        </div>
    );
}
