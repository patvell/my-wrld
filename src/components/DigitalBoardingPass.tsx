import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Flight } from "@/types";
import { Plane, Clock, MapPin, ChevronRight, Share2, Trash2, Edit, X, Check } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BoardingPassProps {
    flight: Flight;
    onDelete?: (id: string) => void;
    onEdit?: (id: string) => void;
    isShifted?: boolean;
    onToggleShift?: () => void;
    isActive?: boolean;
}

export default function DigitalBoardingPass({ flight, onDelete, onEdit, isShifted = false, onToggleShift, isActive = false }: BoardingPassProps) {
    const [mounted, setMounted] = useState(false);
    // Internal isShifted state removed in favor of props
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [flightNumber, setFlightNumber] = useState("---");

    useEffect(() => {
        setMounted(true);
    }, []);



    useEffect(() => {
        // Extract number from flight.flight_number string (e.g. "EK123" -> "123")
        // If it's just "123", use it. If "EK123", strip EK. 
        // Or just use the prop if it's already formatted. 
        // The previous code generated a random number, but the prop has flight_number.
        // Let's try to use the prop if available, else random fallback.
        if (flight.flight_number) {
            setFlightNumber(flight.flight_number.replace(/^\D+/g, ''));
        } else {
            setFlightNumber((Math.floor(Math.random() * 900) + 100).toString());
        }
    }, [flight.flight_number]);

    // Determine status and style
    const now = new Date();
    const departure = new Date(flight.departure_time);
    const timeDiff = departure.getTime() - now.getTime();
    const hoursUntil = timeDiff / (1000 * 60 * 60);

    const isImminent = hoursUntil < 24 && hoursUntil > 0;

    // Live Active State - White Hue
    const internalStatusColor = isActive
        ? "shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)] border-white/60 bg-white/10"
        : (isImminent ? "shadow-[0_0_30px_-5px_rgba(255,255,255,0.2)] border-white/40 bg-white/5" : "border-white/5");

    const statusColor = internalStatusColor;

    // Format helpers
    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "---";
        // Use UTC to preserve the exact date entered regardless of user's timezone
        return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).toUpperCase().replace(',', '');
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return "--:--";
        // Use UTC to preserve the exact time entered regardless of user's timezone
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isConfirmingDelete) {
            onDelete?.(flight.id);
            // Optional: reset state, though component might unmount
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

    const toggleShift = () => {
        if (isActive) {
            // Open FlightAware
            window.open(`https://www.flightaware.com/live/flight/UAE${flightNumber}`, '_blank');
            return;
        }

        // Reset delete confirmation when closing (if it was open)
        if (isShifted) {
            setIsConfirmingDelete(false);
        }
        if (onToggleShift) {
            onToggleShift();
        }
    };

    return (
        <div className="relative w-full max-w-sm group h-36">
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
                        // Open: Wait strictly for card to finish (0.6s). Close: Hide immediately (0s).
                        delay: isShifted ? 0.6 : 0,
                        type: "spring", stiffness: 400, damping: 35
                    }}
                    onClick={handleEdit}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-white/10 transition-all"
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
                        // Open: Stagger slightly after edit (0.65s). Close: Hide immediately (0s).
                        delay: isShifted ? 0.65 : 0,
                        type: "spring", stiffness: 400, damping: 35
                    }}
                    onClick={handleDelete}
                    className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 text-white transition-all",
                        // Hover state handled by motion animate for bg, but adding hover for non-motion props if needed
                        !isConfirmingDelete && "hover:bg-white/10",
                        isConfirmingDelete && "hover:bg-red-600/90 border-red-400/50"
                    )}
                >
                    {isConfirmingDelete ? <Check size={18} /> : <Trash2 size={18} />}
                </motion.button>
            </div>

            {/* Main Card Layer */}
            <motion.div
                animate={{ x: isShifted ? -140 : 0 }}
                transition={{
                    type: "spring", stiffness: 500, damping: 40,
                    // Open: Move immediately (0s). Close: Wait for buttons to hide (0.1s).
                    delay: isShifted ? 0 : 0.1
                }}
                onClick={toggleShift}
                className={cn(
                    "relative w-full h-full glass rounded-3xl overflow-hidden cursor-pointer selection:bg-transparent border transition-all duration-500 z-10 flex flex-col",
                    statusColor,
                    isImminent && "animate-pulse-slow",
                    // Remove shadow when shifted to prevent artifact over buttons
                    isShifted && "shadow-none"
                )}
                whileTap={{ scale: 0.98 }}
            >
                {/* Content */}
                <div className="flex-1 p-6 flex flex-row items-center justify-between bg-black/40 backdrop-blur-md relative">

                    {/* LEFT: Origin */}
                    <div className="flex flex-col items-start gap-3 z-10 w-1/3">
                        <div>
                            <span className="text-4xl font-black tracking-tighter text-white drop-shadow-xl block leading-none">{flight.origin_code}</span>
                            <span className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-bold block mt-1 truncate w-full" title={flight.origin_city}>{flight.origin_city}</span>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-0.5">{formatDate(flight.departure_time)}</span>
                            <span className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{formatTime(flight.departure_time)}</span>
                        </div>
                    </div>

                    {/* CENTER: Flight Info (Dead Center) */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-0 pointer-events-none">
                        <div className="flex flex-col items-center justify-center">
                            {/* LIVE Indicator */}
                            <AnimatePresence>
                                {isActive && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        className="flex items-center gap-1.5 mb-1"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
                                        <span className="text-[10px] font-black tracking-[0.2em] text-white uppercase drop-shadow-sm">Live</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="flex items-center gap-1.5 mb-2">
                                <Plane size={14} className="text-white fill-white rotate-45" />
                                <span className="text-lg font-black text-white tracking-tight">EK{flightNumber}</span>
                            </div>

                            {/* Animated Line */}
                            <div className="w-24 h-[1px] bg-white/10 overflow-hidden relative">
                                <motion.div
                                    className="absolute inset-y-0 left-0 w-1/3 bg-white/60 blur-[1px]"
                                    animate={{ x: ["-100%", "300%"] }}
                                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Destination */}
                    <div className="flex flex-col items-end gap-3 z-10 w-1/3 text-right">
                        <div>
                            <span className="text-4xl font-black tracking-tighter text-white drop-shadow-xl block leading-none">{flight.destination_code}</span>
                            <span className="text-[10px] text-white/50 uppercase tracking-[0.2em] font-bold block mt-1 truncate w-full" title={flight.destination_city}>{flight.destination_city}</span>
                        </div>
                        <div>
                            <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold block mb-0.5">{formatDate(flight.arrival_time)}</span>
                            <span className="text-2xl font-black text-white tracking-tighter font-mono leading-none">{formatTime(flight.arrival_time)}</span>
                        </div>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}
