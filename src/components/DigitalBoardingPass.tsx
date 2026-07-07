import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { Flight } from "@/types";
import { Plane, Trash2, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocalDate, formatLocalTime, isImminent, isPast } from "@/lib/time";
import { AIRLINE_CODE, FLIGHTAWARE_CARRIER, formatFlightDisplay } from "@/lib/config";
import type { LiveStatus } from "@/lib/aeroMapper";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { spring } from "@/lib/motion";

/** How far the card slides left to reveal the action tray. */
const SHIFT_PX = 140;
/** Drag distance/velocity beyond which a release commits the reveal. */
const DRAG_COMMIT_PX = 60;
const DRAG_COMMIT_VELOCITY = 400;

interface BoardingPassProps {
    flight: Flight;
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void;
    isShifted?: boolean;
    onToggleShift?: () => void;
    isActive?: boolean;
}

export default function DigitalBoardingPass({ flight, onDelete, onEdit, isShifted = false, onToggleShift, isActive = false }: BoardingPassProps) {
    const { isFullExperience } = usePerformanceTier();
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [live, setLive] = useState<LiveStatus | null>(null);
    // Timestamp of the last real horizontal drag. The browser fires click
    // BEFORE framer's onDragEnd, so a boolean set in onDragEnd is too late —
    // instead onDrag stamps this live and the click handler ignores anything
    // within its window.
    const lastDragAtRef = useRef(0);
    const flightNumber = formatFlightDisplay(flight.flight_number);

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
        const timer = setInterval(load, 90 * 1000);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [isActive, flight.id]);

    // Closing the tray always exits the confirm state too. Adjusted during
    // render (not in an effect) per the derived-state pattern, since the tray
    // can be closed externally by the parent opening another card.
    const [prevShifted, setPrevShifted] = useState(isShifted);
    if (prevShifted !== isShifted) {
        setPrevShifted(isShifted);
        if (!isShifted) setIsConfirmingDelete(false);
    }

    const cancelled = Boolean(live?.cancelled);

    // Live active state gets a brighter, glowing treatment.
    const statusColor = isConfirmingDelete
        ? "shadow-[0_0_30px_-5px_rgba(239,68,68,0.5)] border-red-500/60"
        : cancelled
        ? "shadow-[0_0_30px_-5px_rgba(239,68,68,0.5)] border-red-500/60 bg-red-950/30"
        : isActive
        ? "shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)] border-white/60 bg-white/10"
        : (imminent ? "shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)] border-white/40 bg-white/5" : "border-white/5");

    const confirmDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.(flight.id);
        setIsConfirmingDelete(false);
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit?.(flight.id);
    };

    const requestDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsConfirmingDelete(true);
    };

    const activate = () => {
        // A swipe's release also fires a click; swallow it so the drag intent
        // (handled in onDragEnd) is the only toggle.
        if (Date.now() - lastDragAtRef.current < 400) return;
        if (isActive && flightNumber !== "---") {
            window.open(`https://www.flightaware.com/live/flight/${FLIGHTAWARE_CARRIER}${flightNumber}`, '_blank');
            return;
        }
        onToggleShift?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape" && isConfirmingDelete) {
            e.preventDefault();
            setIsConfirmingDelete(false);
            return;
        }
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
        }
    };

    const handleDrag = (_: unknown, info: PanInfo) => {
        if (Math.abs(info.offset.x) > 10) lastDragAtRef.current = Date.now();
    };

    const handleDragEnd = (_: unknown, info: PanInfo) => {
        const openIntent = info.offset.x < -DRAG_COMMIT_PX || info.velocity.x < -DRAG_COMMIT_VELOCITY;
        const closeIntent = info.offset.x > DRAG_COMMIT_PX / 2 || info.velocity.x > DRAG_COMMIT_VELOCITY;

        if (!isShifted && openIntent) onToggleShift?.();
        else if (isShifted && closeIntent) onToggleShift?.();
    };

    const actionLabel = isActive
        ? `Open live tracking for flight ${AIRLINE_CODE}${flightNumber}`
        : `${isShifted ? "Hide" : "Show"} actions for ${flight.origin_code} to ${flight.destination_code}`;

    return (
        <div className="relative w-full max-w-sm group h-44">
            {/* Action Buttons Layer (Behind) */}
            <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-2 z-0">
                <motion.button
                    initial={false}
                    animate={{
                        scale: isShifted ? 1 : 0.8,
                        opacity: isShifted ? 1 : 0,
                        x: isShifted ? 0 : 20,
                    }}
                    transition={{ ...spring.smooth, delay: isShifted ? 0.04 : 0 }}
                    onClick={handleEdit}
                    aria-label={`Edit flight ${flight.origin_code} to ${flight.destination_code}`}
                    tabIndex={isShifted ? 0 : -1}
                    className="w-12 h-12 rounded-full flex items-center justify-center glass-solid text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                    <Edit size={18} />
                </motion.button>
                <motion.button
                    initial={false}
                    animate={{
                        scale: isShifted ? 1 : 0.8,
                        opacity: isShifted ? 1 : 0,
                        x: isShifted ? 0 : 20,
                    }}
                    transition={{ ...spring.smooth, delay: isShifted ? 0.08 : 0 }}
                    onClick={requestDelete}
                    aria-label={`Delete flight ${flight.origin_code} to ${flight.destination_code}`}
                    tabIndex={isShifted ? 0 : -1}
                    className="w-12 h-12 rounded-full flex items-center justify-center glass-solid text-white hover:bg-red-600/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                    <Trash2 size={18} />
                </motion.button>
            </div>

            {/* Main Card Layer */}
            <motion.div
                role="button"
                tabIndex={0}
                aria-label={actionLabel}
                // Confirming slides the card back over the tray so the full
                // confirm prompt is visible; Cancel returns it to the tray.
                animate={{ x: isShifted && !isConfirmingDelete ? -SHIFT_PX : 0 }}
                transition={spring.snappy}
                drag="x"
                dragConstraints={{ left: -SHIFT_PX, right: 0 }}
                dragElastic={{ left: 0.08, right: 0.05 }}
                dragMomentum={false}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onClick={activate}
                onKeyDown={handleKeyDown}
                className={cn(
                    "relative w-full h-full rounded-3xl overflow-hidden cursor-pointer selection:bg-transparent border transition-colors duration-500 z-10 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    isFullExperience ? "glass-dark" : "bg-neutral-950/90 border-white/10",
                    statusColor,
                    imminent && "animate-pulse-slow",
                    isShifted && "shadow-none"
                )}
                whileTap={{ scale: 0.98 }}
            >
                <div className={cn("flex-1 p-5 flex flex-row items-center justify-between relative", isFullExperience ? "bg-black/55" : "bg-black/75")}>

                    {/* LEFT: Origin */}
                    <div className="flex flex-col items-start justify-between h-full z-10 w-1/3 py-1">
                        <div>
                            <span className="text-4xl font-black tracking-tighter text-white drop-shadow-xl block leading-none">{flight.origin_code}</span>
                            <span className="text-[10px] text-white/50 uppercase tracking-[0.15em] font-bold block mt-1 leading-tight break-words">{flight.origin_city}</span>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-0.5">{formatLocalDate(flight.departure_time)}</span>
                            <span className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{formatLocalTime(flight.departure_time)}</span>
                            {isActive && live && (live.gate_origin || live.terminal_origin || live.departure_delay_min) && (
                                <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-white/60 block">
                                    {live.terminal_origin ? `T${live.terminal_origin}` : null}
                                    {live.terminal_origin && live.gate_origin ? " " : null}
                                    {live.gate_origin ? `Gate ${live.gate_origin}` : null}
                                    {(live.terminal_origin || live.gate_origin) && live.departure_delay_min ? " | " : null}
                                    {live.departure_delay_min && live.departure_delay_min > 0
                                        ? `Delayed ${live.departure_delay_min}m`
                                        : live.departure_delay_min && live.departure_delay_min < 0
                                            ? `Early ${Math.abs(live.departure_delay_min)}m`
                                            : null}
                                </span>
                            )}
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
                                        <span className={cn(
                                            "text-[10px] font-black tracking-[0.2em] uppercase drop-shadow-sm",
                                            cancelled ? "text-red-400" : "text-white",
                                        )}>
                                            {cancelled ? "Cancelled" : live?.status ? live.status : "Live"}
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
                                ) : !past && (isActive || imminent) && isFullExperience ? (
                                    <motion.div
                                        className="absolute inset-y-0 left-0 w-1/3 bg-white/60 blur-[1px]"
                                        animate={{ x: ["-100%", "300%"] }}
                                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                    />
                                ) : !past ? (
                                    <div className="absolute inset-y-0 left-0 w-1/3 bg-white/30" />
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

                {/* Delete confirmation takes over the card itself, which reads far
                    clearer than swapping icon meanings on the tray buttons. */}
                <AnimatePresence>
                    {isConfirmingDelete && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={spring.smooth}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsConfirmingDelete(false);
                            }}
                            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-red-950/85 backdrop-blur-sm rounded-3xl"
                        >
                            <span className="text-xs font-black tracking-[0.2em] uppercase text-white">Delete this journey?</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsConfirmingDelete(false);
                                    }}
                                    className="px-5 py-2.5 rounded-full border border-white/25 text-white/85 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    className="px-5 py-2.5 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
