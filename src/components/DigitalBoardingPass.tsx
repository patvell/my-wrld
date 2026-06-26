import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flight } from "@/types";
import { Plane, Trash2, Edit, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDate, formatLocalTime, isImminent, isPast } from "@/lib/time";
import { AIRLINE_CODE, FLIGHTAWARE_CARRIER } from "@/lib/config";
import type { LiveStatus } from "@/lib/aeroMapper";

interface BoardingPassProps {
    flight: Flight;
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void;
    isShifted?: boolean;
    onToggleShift?: () => void;
    isActive?: boolean;
}

export default function DigitalBoardingPass({ flight, onDelete, onEdit, isShifted = false, onToggleShift, isActive = false }: BoardingPassProps) {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [live, setLive] = useState<LiveStatus | null>(null);
    const flightNumber = flight.flight_number ? flight.flight_number.replace(/^\D+/g, '') : "---";

    const imminent = isImminent(flight);
    const past = isPast(flight);

    // While the flight is in its live window, pull real status from AeroAPI
    // (server-cached). Fetch on activation, then refresh slowly; setState only
    // happens inside the async callback. No-op gracefully if not configured.
    useEffect(() => {
        if (!isActive) return;
        let active = true;
        const load = async () => {
            try {
                const res = await fetch(`/api/flights/${flight.id}/status`);
                if (!res.ok) return;
                const data = await res.json();
                if (active && data?.configured && data?.found) setLive(data.status as LiveStatus);
            } catch {
                /* ignore: keep static UI */
            }
        };
        load();
        const timer = setInterval(load, 5 * 60 * 1000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [isActive, flight.id]);

    // Live active state gets a brighter, glowing treatment.
    const statusColor = isActive
        ? "shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)] border-white/60 bg-white/10"
        : (imminent ? "shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)] border-white/40 bg-white/5" : "border-white/5");

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isConfirmingDelete) {
            onDelete?.(flight.id);
            setIsConfirmingDelete(false);
        } else {
            setIsConfirmingDelete(true);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isConfirmingDelete) {
            setIsConfirmingDelete(false);
        } else {
            onEdit?.(flight.id);
        }
    };

    const activate = () => {
        if (isActive) {
            window.open(`https://www.flightaware.com/live/flight/${FLIGHTAWARE_CARRIER}${flightNumber}`, '_blank');
            return;
        }
        if (isShifted) {
            setIsConfirmingDelete(false);
        }
        onToggleShift?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
        }
    };

    const actionLabel = isActive
        ? `Open live tracking for flight ${AIRLINE_CODE}${flightNumber}`
        : `${isShifted ? "Hide" : "Show"} actions for ${flight.origin_code} to ${flight.destination_code}`;

    return (
        <div className="relative w-full max-w-sm group h-44">
            {/* Action Buttons Layer (Behind) */}
            <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-2 z-0">
                <motion.button
                    initial={{ scale: 0.8, opacity: 0, x: 20 }}
                    animate={{
                        scale: isShifted ? 1 : 0.8,
                        opacity: isShifted ? 1 : 0,
                        x: isShifted ? 0 : 20
                    }}
                    transition={{
                        delay: isShifted ? 0.6 : 0,
                        type: "spring", stiffness: 400, damping: 35
                    }}
                    onClick={handleEdit}
                    aria-label={`Edit flight ${flight.origin_code} to ${flight.destination_code}`}
                    tabIndex={isShifted ? 0 : -1}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                    {isConfirmingDelete ? <X size={18} /> : <Edit size={18} />}
                </motion.button>
                <motion.button
                    initial={{ scale: 0.8, opacity: 0, x: 20 }}
                    animate={{
                        scale: isShifted ? 1 : 0.8,
                        opacity: isShifted ? 1 : 0,
                        x: isShifted ? 0 : 20,
                        backgroundColor: isConfirmingDelete ? "rgba(239, 68, 68, 0.8)" : "rgba(0, 0, 0, 0.4)"
                    }}
                    transition={{
                        delay: isShifted ? 0.65 : 0,
                        type: "spring", stiffness: 400, damping: 35
                    }}
                    onClick={handleDelete}
                    aria-label={isConfirmingDelete ? "Confirm delete flight" : `Delete flight ${flight.origin_code} to ${flight.destination_code}`}
                    tabIndex={isShifted ? 0 : -1}
                    className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                        !isConfirmingDelete && "hover:bg-white/10",
                        isConfirmingDelete && "hover:bg-red-600/90 border-red-400/50"
                    )}
                >
                    {isConfirmingDelete ? <Check size={18} /> : <Trash2 size={18} />}
                </motion.button>
            </div>

            {/* Main Card Layer */}
            <motion.div
                role="button"
                tabIndex={0}
                aria-label={actionLabel}
                animate={{ x: isShifted ? -140 : 0 }}
                transition={{
                    type: "spring", stiffness: 500, damping: 40,
                    delay: isShifted ? 0 : 0.1
                }}
                onClick={activate}
                onKeyDown={handleKeyDown}
                className={cn(
                    "relative w-full h-full glass rounded-3xl overflow-hidden cursor-pointer selection:bg-transparent border transition-all duration-500 z-10 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    statusColor,
                    imminent && "animate-pulse-slow",
                    isShifted && "shadow-none"
                )}
                whileTap={{ scale: 0.98 }}
            >
                <div className="flex-1 p-5 flex flex-row items-center justify-between bg-black/40 backdrop-blur-md relative">

                    {/* LEFT: Origin */}
                    <div className="flex flex-col items-start justify-between h-full z-10 w-1/3 py-1">
                        <div>
                            <span className="text-4xl font-black tracking-tighter text-white drop-shadow-xl block leading-none">{flight.origin_code}</span>
                            <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-bold block mt-1 leading-tight break-words">{flight.origin_city}</span>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-0.5">{formatLocalDate(flight.departure_time)}</span>
                            <span className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{formatLocalTime(flight.departure_time)}</span>
                        </div>
                    </div>

                    {/* CENTER: Flight Info */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
                        <div className="flex flex-col items-center justify-center">
                            <AnimatePresence>
                                {isActive && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="flex items-center gap-1.5 mb-1"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
                                        <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase drop-shadow-sm">
                                            {live?.status ? live.status : "Live"}
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex items-center gap-1.5 mb-2">
                                <Plane size={14} className="text-white fill-white rotate-45" />
                                <span className="text-lg font-black text-white tracking-tight">{AIRLINE_CODE}{flightNumber}</span>
                            </div>

                            <div className="w-24 h-[1px] bg-white/10 overflow-hidden relative">
                                {isActive && live && live.progress_percent != null ? (
                                    <motion.div
                                        className="absolute inset-y-0 left-0 bg-white"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.max(0, Math.min(100, live.progress_percent))}%` }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                    />
                                ) : !past ? (
                                    <motion.div
                                        className="absolute inset-y-0 left-0 w-1/3 bg-white/60 blur-[1px]"
                                        animate={{ x: ["-100%", "300%"] }}
                                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                    />
                                ) : (
                                    <div className="absolute inset-y-0 left-0 w-full bg-white/20" />
                                )}
                            </div>

                            {isActive && live && (live.arrival_delay_min || live.gate_destination) && (
                                <span className="mt-1.5 text-[8px] font-bold uppercase tracking-widest text-white/70">
                                    {live.arrival_delay_min && live.arrival_delay_min > 0
                                        ? `Delayed ${live.arrival_delay_min}m`
                                        : live.arrival_delay_min && live.arrival_delay_min < 0
                                            ? `Early ${Math.abs(live.arrival_delay_min)}m`
                                            : null}
                                    {live.arrival_delay_min && live.gate_destination ? " | " : null}
                                    {live.gate_destination ? `Gate ${live.gate_destination}` : null}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Destination */}
                    <div className="flex flex-col items-end justify-between h-full z-10 w-1/3 text-right py-1">
                        <div>
                            <span className="text-4xl font-black tracking-tighter text-white drop-shadow-xl block leading-none">{flight.destination_code}</span>
                            <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-bold block mt-1 leading-tight break-words">{flight.destination_city}</span>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-0.5">{formatLocalDate(flight.arrival_time)}</span>
                            <span className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{formatLocalTime(flight.arrival_time)}</span>
                        </div>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}
