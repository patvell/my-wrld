"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Plane, Clock } from "lucide-react";
import { AIRPORTS } from "@/data/airports";
import { Flight, FlightInput } from "@/types";
import { normalizeWallClock } from "@/lib/time";
import { AIRLINE_CODE } from "@/lib/config";

interface AddTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (trip: FlightInput) => void;
    isHistoryMode?: boolean;
    flightToEdit?: Flight | null;
}

export default function AddTripModal({ isOpen, onClose, onAdd, isHistoryMode = false, flightToEdit }: AddTripModalProps) {
    // Flight Info
    const [flightNum, setFlightNum] = useState("");

    // Origin Info
    const [origin, setOrigin] = useState("");
    const [originDate, setOriginDate] = useState("");
    const [originTime, setOriginTime] = useState("");

    // Destination Info
    const [destination, setDestination] = useState("");
    const [destDate, setDestDate] = useState("");
    const [destTime, setDestTime] = useState("");

    // Validation Errors
    const [errors, setErrors] = useState<{ origin?: string; destination?: string }>({});

    const dialogRef = useRef<HTMLDivElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    // Focus management: trap focus while open, close on Escape, restore on close.
    useEffect(() => {
        if (!isOpen) return;
        lastFocusedRef.current = document.activeElement as HTMLElement | null;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key !== "Tab") return;
            const root = dialogRef.current;
            if (!root) return;
            const focusable = root.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            lastFocusedRef.current?.focus?.();
        };
    }, [isOpen, onClose]);

    // Reset or Populate form on open. Syncing the form fields to the selected
    // flight when the dialog opens is a legitimate prop-to-state sync.
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (isOpen) {
            if (flightToEdit) {
                // Populate from existing flight. Times are canonical wall-clock
                // ("YYYY-MM-DDTHH:mm"), so split the parts directly to avoid any
                // timezone shifting from Date parsing.
                setFlightNum((flightToEdit.flight_number ?? "").replace(/^\D+/g, ''));

                setOrigin(flightToEdit.origin_code);

                const dep = normalizeWallClock(flightToEdit.departure_time);
                const arr = normalizeWallClock(flightToEdit.arrival_time);

                setOriginDate(dep.slice(0, 10));
                setOriginTime(dep.slice(11, 16));

                setDestination(flightToEdit.destination_code);
                setDestDate(arr.slice(0, 10));
                setDestTime(arr.slice(11, 16));

                setErrors({});
            } else {
                // Reset to defaults
                setOrigin("");
                setDestination("");
                setFlightNum("");
                const today = new Date().toISOString().split('T')[0];
                setOriginDate(today);
                setDestDate(today);
                setOriginTime("");
                setDestTime("");
                setErrors({});
            }
        }
    }, [isOpen, flightToEdit]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const handleTimeChange = (val: string, setter: (v: string) => void) => {
        const digits = val.replace(/\D/g, '').slice(0, 4);
        let formatted = digits;
        if (digits.length >= 3) {
            formatted = digits.slice(0, 2) + ':' + digits.slice(2);
        }
        setter(formatted);
    };

    const validateAirport = (code: string) => {
        return AIRPORTS[code.toUpperCase()] !== undefined;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: { origin?: string; destination?: string } = {};

        if (!validateAirport(origin)) {
            newErrors.origin = "Invalid";
        }
        if (!validateAirport(destination)) {
            newErrors.destination = "Invalid";
        }

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(originTime)) {
            newErrors.origin = "Check Time";
        }
        if (!timeRegex.test(destTime)) {
            newErrors.destination = "Check Time";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const originData = AIRPORTS[origin.toUpperCase()];
        const destData = AIRPORTS[destination.toUpperCase()];

        // Note: Dates/Times are stored as ISO strings but conceptually represent
        // the local time at the respective airport, as per requirement.
        // We will likely need a helper to calculate duration or convert for global comparison later.

        onAdd({
            origin_code: origin.toUpperCase(),
            origin_city: originData.city,
            destination_code: destination.toUpperCase(),
            destination_city: destData.city,
            flight_number: `${AIRLINE_CODE}${flightNum}`,
            departure_time: `${originDate}T${originTime}`, // canonical wall-clock (local to origin)
            arrival_time: `${destDate}T${destTime}`,       // canonical wall-clock (local to destination)
            status: isHistoryMode ? "completed" : "scheduled",
            type: isHistoryMode ? "past" : "future",
        });
        onClose();
    };

    // Date Restrictions
    const today = new Date().toISOString().split('T')[0];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
                    />

                    {/* Modal */}
                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-trip-title"
                        initial={{ opacity: 0, y: 100, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-[#0F0F0F] border-t border-x md:border border-white/10 rounded-t-[32px] rounded-b-none md:rounded-[32px] z-[70] shadow-2xl flex flex-col max-h-[85vh] md:max-h-[90vh] overflow-hidden"
                    >
                        {/* Decorative background glow - kept in main container so it stays fixed */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emirates-red/5 blur-[80px] rounded-full pointer-events-none -z-10" />

                        {/* Fixed Header */}
                        <div className="flex-none z-20 bg-[#0F0F0F] border-b border-white/5 flex items-center justify-between px-5 md:px-8 pt-5 pb-4 md:pt-8 md:pb-6 relative">
                            {/* Gradient mask for smooth content fade under header if we wanted, but solid buffer is safer for 'fixed' feel */}
                            <div className="flex flex-col">
                                <h2 id="add-trip-title" className="text-xl font-bold text-white tracking-widest uppercase">
                                    {flightToEdit ? "Edit Journey Details" : (isHistoryMode ? "Log Past Journey" : "NEW JOURNEY")}
                                </h2>
                                {!flightToEdit && (
                                    <span className="text-[10px] text-white/40 uppercase tracking-wider">
                                        {isHistoryMode ? "Add to your vault" : "YOUR NEXT ADVENTURE AWAITS"}
                                    </span>
                                )}
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-5 md:p-8 pt-6 md:pt-8">
                            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 pb-4">
                                {/* 1. Header: Flight Number */}
                                <div className="flex flex-col items-center justify-center border-b border-white/5 pb-6 md:pb-8">
                                    <label htmlFor="flight-number" className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-3">Flight Number</label>
                                    <div className="relative flex items-center justify-center">
                                        <span className="text-4xl font-bold text-white/40 tracking-tighter mr-2">{AIRLINE_CODE}</span>
                                        <input
                                            id="flight-number"
                                            type="text"
                                            inputMode="numeric"
                                            value={flightNum}
                                            onChange={(e) => setFlightNum(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            placeholder="000"
                                            className="bg-transparent border-none text-4xl w-32 font-bold text-white tracking-tighter placeholder:text-white/10 focus:outline-none text-center p-0"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                </div>

                                {/* 2. Dual Column Layout */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 relative">
                                    {/* Decor: Center Divider */}
                                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/5 -translate-x-1/2 hidden md:block" />

                                    {/* LEFT: ORIGIN */}
                                    <div className="space-y-4 md:space-y-5">
                                        {/* Airport Code */}
                                        <div className="space-y-2">
                                            <label htmlFor="origin-input" className="text-[10px] uppercase tracking-widest text-emirates-red font-bold flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emirates-red" />
                                                Depart From
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    id="origin-input"
                                                    type="text"
                                                    value={origin}
                                                    onChange={(e) => {
                                                        setOrigin(e.target.value);
                                                        if (errors.origin) setErrors(prev => ({ ...prev, origin: undefined }));
                                                    }}
                                                    maxLength={3}
                                                    placeholder="DXB"
                                                    className={`w-full h-14 md:h-16 bg-white/5 border rounded-2xl text-center text-xl md:text-2xl text-white font-bold tracking-widest uppercase focus:outline-none focus:bg-white/10 transition-all placeholder:text-white/10 ${errors.origin ? 'border-red-500/50' : 'border-white/10 focus:border-emirates-red/50'}`}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <div className="space-y-1">
                                            <label htmlFor="origin-date" className="text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1">Date</label>
                                            <div className="relative">
                                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                                <input
                                                    id="origin-date"
                                                    type="date"
                                                    value={originDate}
                                                    min={!isHistoryMode ? today : undefined}
                                                    max={isHistoryMode ? today : undefined}
                                                    onChange={(e) => setOriginDate(e.target.value)}
                                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white text-sm font-bold tracking-wide uppercase focus:outline-none focus:border-emirates-red/30 transition-all [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full cursor-pointer"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div className="space-y-1">
                                            <label htmlFor="origin-time" className="text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1">Time</label>
                                            <div className="relative">
                                                <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                                <input
                                                    id="origin-time"
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={5}
                                                    placeholder="00:00"
                                                    value={originTime}
                                                    onChange={(e) => handleTimeChange(e.target.value, setOriginTime)}
                                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white text-sm font-bold tracking-wide uppercase focus:outline-none focus:border-emirates-red/30 transition-all placeholder:text-white/10"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>


                                    {/* RIGHT: DESTINATION */}
                                    <div className="space-y-4 md:space-y-5">
                                        {/* Airport Code */}
                                        <div className="space-y-2">
                                            <label htmlFor="dest-input" className="text-[10px] uppercase tracking-widest text-dubai-gold font-bold flex items-center gap-2 justify-start md:justify-end">
                                                <span className="md:hidden">Arrive At</span> {/* Mobile label order */}
                                                <div className="w-1.5 h-1.5 rounded-full bg-dubai-gold" />
                                                <span className="hidden md:inline">Arrive At</span> {/* Desktop label order */}
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    id="dest-input"
                                                    type="text"
                                                    value={destination}
                                                    onChange={(e) => {
                                                        setDestination(e.target.value);
                                                        if (errors.destination) setErrors(prev => ({ ...prev, destination: undefined }));
                                                    }}
                                                    maxLength={3}
                                                    placeholder="LHR"
                                                    className={`w-full h-14 md:h-16 bg-white/5 border rounded-2xl text-center text-xl md:text-2xl text-white font-bold tracking-widest uppercase focus:outline-none focus:bg-white/10 transition-all placeholder:text-white/10 ${errors.destination ? 'border-red-500/50' : 'border-white/10 focus:border-dubai-gold/50'}`}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Date */}
                                        <div className="space-y-1">
                                            <label htmlFor="dest-date" className="text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1 md:mr-1 text-left md:text-right block">Date</label>
                                            <div className="relative">
                                                <Calendar size={16} className="absolute left-4 md:right-4 md:left-auto top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                                <input
                                                    id="dest-date"
                                                    type="date"
                                                    value={destDate}
                                                    min={originDate}
                                                    onChange={(e) => setDestDate(e.target.value)}
                                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 md:pl-4 md:pr-12 text-white text-sm font-bold tracking-wide uppercase focus:outline-none focus:border-dubai-gold/30 transition-all [color-scheme:dark] text-left md:text-right [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full cursor-pointer"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div className="space-y-1">
                                            <label htmlFor="dest-time" className="text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1 md:mr-1 text-left md:text-right block">Time</label>
                                            <div className="relative">
                                                <Clock size={16} className="absolute left-4 md:right-4 md:left-auto top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                                <input
                                                    id="dest-time"
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={5}
                                                    placeholder="00:00"
                                                    value={destTime}
                                                    onChange={(e) => handleTimeChange(e.target.value, setDestTime)}
                                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 md:pl-4 md:pr-12 text-white text-sm font-bold tracking-wide uppercase focus:outline-none focus:border-dubai-gold/30 transition-all placeholder:text-white/10 text-left md:text-right"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-5 rounded-2xl bg-white text-black text-sm font-bold tracking-widest uppercase mt-4 hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <span className="relative z-10">{flightToEdit ? "Update Journey" : "Confirm Journey"}</span>
                                    <Plane size={16} className="relative z-10 rotate-45 mb-1" />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
