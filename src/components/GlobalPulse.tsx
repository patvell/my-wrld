import React, { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getTimezoneOffset } from "date-fns-tz";
import { PersonaMode } from "@/types";
import { Plane, Home } from "lucide-react";
import { getAirportTimezone, AIRPORTS } from "@/data/airports";
import { getCountryTheme } from "@/lib/countryTheme";
import { getReadableTextColors } from "@/lib/colors";
import { PERSONA_SPRING, PLACE_TRANSITION_CSS } from "@/lib/placeTransition";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";

interface GlobalPulseProps {
    partnerCity?: string;
    partnerCode?: string;
    faCity?: string;
    faCode?: string;
    persona: PersonaMode;
    onTogglePersona: () => void;
    isLoading?: boolean;
}

function msUntilNextMinute() {
    const now = new Date();
    return (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
}

function useMinuteClock() {
    const [now, setNow] = useState<Date | null>(null);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;

        const tick = () => {
            setNow(new Date());
            timer = setTimeout(tick, msUntilNextMinute());
        };

        tick();
        return () => clearTimeout(timer);
    }, []);

    return now;
}

interface ClockDisplayProps {
    now: Date | null;
    timezone: string;
    textColor: string;
    useFrostedChrome: boolean;
}

const ClockDisplay = memo(function ClockDisplay({ now, timezone, textColor, useFrostedChrome }: ClockDisplayProps) {
    const time = now
        ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: timezone,
          }).format(now)
        : "--:--";

    return (
        <h1
            className="text-8xl font-medium tracking-tighter leading-none"
            style={{
                color: textColor,
                transition: `color ${PLACE_TRANSITION_CSS}`,
                textShadow: useFrostedChrome
                    ? "0 1px 2px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.5)"
                    : "0 2px 12px rgba(0,0,0,0.25)",
            }}
        >
            {time}
        </h1>
    );
});

interface SmallClockProps {
    now: Date | null;
    timezone: string;
    textColor: string;
}

const SmallClock = memo(function SmallClock({ now, timezone, textColor }: SmallClockProps) {
    const time = now
        ? new Intl.DateTimeFormat("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: timezone,
          }).format(now)
        : "--:--";

    return (
        <span className="text-xs font-bold" style={{ color: textColor, transition: `color ${PLACE_TRANSITION_CSS}` }}>
            {time}
        </span>
    );
});

export default function GlobalPulse({
    partnerCity = "Montreal",
    partnerCode = "YUL",
    faCity = "Dubai",
    faCode = "DXB",
    persona,
    onTogglePersona,
    isLoading = false,
}: GlobalPulseProps) {
    const { isFullExperience } = usePerformanceTier();
    const now = useMinuteClock();

    const currentLocationCode = persona === "home" ? partnerCode : faCode;
    const countryTheme = getCountryTheme(currentLocationCode);
    const readable = getReadableTextColors(countryTheme.effectiveBg);
    const { primary: textColor, secondary: subTextColor, muted: iconColor, onFrosted } = readable;
    const useFrostedChrome = readable.primary === "#171717";

    const partnerTimezone = getAirportTimezone(partnerCode);
    const faTimezone = getAirportTimezone(faCode);

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
        const diffMs = getTimezoneOffset(tzBig, now) - getTimezoneOffset(tzSmall, now);
        const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 2) / 2;
        if (diffHours === 0) return "SAME TIME";
        const sign = diffHours > 0 ? "+" : "";
        return `${sign}${diffHours}HR`;
    };

    const colorTransition = { transition: `color ${PLACE_TRANSITION_CSS}` };

    const bigTz = persona === "plane" ? faTimezone : partnerTimezone;
    const smallTz = persona === "plane" ? partnerTimezone : faTimezone;
    const mainTimezone = persona === "plane" ? faTimezone : partnerTimezone;
    const altTimezone = persona === "plane" ? partnerTimezone : faTimezone;

    const PersonaToggle = isFullExperience ? motion.button : "button";

    return (
        <div
            className="fixed top-0 left-0 right-0 z-50 p-6 pt-16 pb-12 flex flex-col items-center gap-8 overflow-hidden pointer-events-none"
            style={{ transition: `color ${PLACE_TRANSITION_CSS}` }}
        >
            <div className="flex flex-col items-center justify-center w-full max-w-lg gap-2 pointer-events-auto">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={persona}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={PERSONA_SPRING}
                        className="flex flex-col items-center"
                    >
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
                                        style={{ color: textColor, ...colorTransition }}
                                    >
                                        {persona === "plane" ? faCode : partnerCode}
                                    </span>
                                    <span
                                        className="text-lg font-medium tracking-wide"
                                        style={{ color: subTextColor, ...colorTransition }}
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

                        <ClockDisplay
                            now={now}
                            timezone={mainTimezone}
                            textColor={textColor}
                            useFrostedChrome={useFrostedChrome}
                        />

                        <span
                            className="text-xs font-bold uppercase tracking-widest mt-4 flex items-center gap-2"
                            style={{ color: subTextColor, ...colorTransition }}
                        >
                            {now ? (
                                <>
                                    {formatDate(mainTimezone)}
                                    <span className="opacity-50">•</span>
                                    <span>{getTimeDiffText(bigTz, smallTz)}</span>
                                </>
                            ) : (
                                "..."
                            )}
                        </span>
                    </motion.div>
                </AnimatePresence>
            </div>

            <PersonaToggle
                {...(isFullExperience
                    ? {
                          animate: { scale: [1, 1.03, 1] },
                          transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                          whileTap: { scale: 0.95 },
                      }
                    : {})}
                type="button"
                onClick={onTogglePersona}
                aria-pressed={persona === "home"}
                aria-label={
                    persona === "plane"
                        ? `Switch to home view (${partnerCity})`
                        : `Switch to traveler view (${faCity})`
                }
                className="cursor-pointer group relative overflow-hidden rounded-full glass-dark border px-6 py-3 flex items-center gap-4 transition-all hover:bg-black/40 pointer-events-auto shadow-lg shadow-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{
                    borderColor: useFrostedChrome ? "rgba(255,255,255,0.15)" : subTextColor,
                    transition: `color ${PLACE_TRANSITION_CSS}, border-color ${PLACE_TRANSITION_CSS}`,
                }}
            >
                <div className="flex flex-col items-end">
                    <SmallClock
                        now={now}
                        timezone={altTimezone}
                        textColor={useFrostedChrome ? onFrosted : textColor}
                    />
                    <span
                        className="text-[9px] font-bold tracking-wider"
                        style={{
                            color: useFrostedChrome ? "rgba(255,255,255,0.65)" : subTextColor,
                            ...colorTransition,
                        }}
                    >
                        {persona === "plane" ? partnerCode : faCode}
                    </span>
                </div>

                <div className="h-6 w-[1px] bg-white/20" />

                <div
                    className="flex items-center justify-center transition-colors"
                    style={{ color: useFrostedChrome ? onFrosted : iconColor, ...colorTransition }}
                >
                    {persona === "plane" ? <Home size={18} /> : <Plane size={18} />}
                </div>
            </PersonaToggle>
        </div>
    );
}
