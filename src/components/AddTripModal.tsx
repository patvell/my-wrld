"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { X, Calendar, Plane, Clock, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AIRPORTS } from "@/data/airports";
import { Flight, FlightInput } from "@/types";
import { buildWallClock, normalizeWallClock, padTimeInput, toInstant } from "@/lib/time";
import { daySpan } from "@/lib/aeroMapper";
import { AIRLINE_CODE, formatFlightDigits } from "@/lib/config";
import { spring } from "@/lib/motion";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import AirportField from "@/components/AirportField";

/** Add `n` whole days to a "YYYY-MM-DD" date string (UTC-safe). */
function addDays(date: string, n: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

interface AddTripModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (trip: FlightInput) => Promise<boolean>;
    isHistoryMode?: boolean;
    flightToEdit?: Flight | null;
}

export default function AddTripModal({ isOpen, onClose, onAdd, isHistoryMode = false, flightToEdit }: AddTripModalProps) {
    const { isMobile } = usePerformanceTier();
    // Sheet drag-to-dismiss starts only from the header/grab-handle so it
    // never fights with scrolling the form body.
    const dragControls = useDragControls();

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

    // AeroAPI lookup (autofill)
    const [aeroConfigured, setAeroConfigured] = useState(false);
    const [lookingUp, setLookingUp] = useState(false);
    // Days the arrival falls after departure (preserved when the date is moved).
    const [arrivalDayOffset, setArrivalDayOffset] = useState<number | null>(null);
    const [pendingFaFlightId, setPendingFaFlightId] = useState<string | null>(null);

    const dialogRef = useRef<HTMLDivElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    // Probe whether AeroAPI is available so we only show the lookup affordance when usable.
    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        fetch("/api/aeroapi")
            .then((r) => r.json())
            .then((d) => {
                if (active) setAeroConfigured(Boolean(d?.configured));
            })
            .catch(() => {
                if (active) setAeroConfigured(false);
            });
        return () => {
            active = false;
        };
    }, [isOpen]);

    const handleLookup = async () => {
        const digits = flightNum.replace(/\D/g, "");
        if (!digits) {
            toast.error("Enter a flight number first");
            return;
        }
        // Flexible entry order: a date isn't required to look up. Use the chosen
        // departure date if present, otherwise today, to pick the schedule.
        const lookupDate = originDate || new Date().toISOString().slice(0, 10);
        setLookingUp(true);
        try {
            const params = new URLSearchParams({ ident: `${AIRLINE_CODE}${digits}`, date: lookupDate });
            if (isHistoryMode) params.set("prefer_history", "1");
            const res = await fetch(`/api/aeroapi/lookup?${params.toString()}`);
            if (!res.ok) throw new Error("Lookup failed");
            const data = await res.json();
            if (!data.configured) {
                toast.error("Flight lookup is not configured");
                setAeroConfigured(false);
                return;
            }
            if (!data.found || !data.flight) {
                toast.error("No matching flight found for that number and date");
                return;
            }
            const f = data.flight as FlightInput;
            const dep = normalizeWallClock(f.departure_time);
            const arr = normalizeWallClock(f.arrival_time);
            const span = typeof data.day_span === "number" ? data.day_span : daySpan(dep, arr);

            // Keep the user's chosen departure date (they often book a month out,
            // beyond AeroAPI's horizon). Fill route + times from the schedule and
            // derive the arrival date from the overnight day-span.
            const baseDate = lookupDate;
            setOrigin(f.origin_code);
            setOriginDate(baseDate);
            setOriginTime(dep.slice(11, 16));
            setDestination(f.destination_code);
            setDestDate(addDays(baseDate, span));
            setDestTime(arr.slice(11, 16));
            setArrivalDayOffset(span);
            setPendingFaFlightId(data.fa_flight_id ?? null);
            if (f.flight_number) setFlightNum(f.flight_number.replace(/^\D+/g, ""));
            setErrors({});

            const route = `${f.origin_code} → ${f.destination_code}`;
            if (data.source === "schedule") {
                toast.success(
                    data.exact
                        ? `Found published schedule for ${route}`
                        : `Loaded published schedule for ${route} — set your travel date`,
                );
            } else if (data.source === "history") {
                toast.success(`Found historical flight ${route}`);
            } else if (data.exact) {
                toast.success(`Found ${route}`);
            } else {
                toast.success(`Loaded ${route} schedule — set your travel date`);
            }
        } catch {
            toast.error("Could not look up flight");
        } finally {
            setLookingUp(false);
        }
    };

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
                setArrivalDayOffset(daySpan(dep, arr));
                setPendingFaFlightId(flightToEdit.fa_flight_id ?? null);

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
                setArrivalDayOffset(null);
                setPendingFaFlightId(null);
                setErrors({});
            }
        }
    }, [isOpen, flightToEdit]);

    // Moving the departure date carries the arrival date with it, keeping the
    // same day-span (so overnight flights stay correct) and the arrival time.
    // Works after a lookup (span known) and for manual entry (derive span from
    // the currently entered dates).
    const handleOriginDateChange = (value: string) => {
        const span =
            arrivalDayOffset != null
                ? arrivalDayOffset
                : originDate && destDate
                  ? daySpan(originDate, destDate)
                  : null;
        setOriginDate(value);
        if (span != null && value) {
            setDestDate(addDays(value, span));
            setArrivalDayOffset(span);
        }
    };

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

    const [submitting, setSubmitting] = useState(false);

    // Calendar days the arrival lands after departure — surfaces the overnight
    // span the date-carry logic already preserves behind the scenes.
    const arrivalSpanDays = originDate && destDate ? Math.max(0, daySpan(originDate, destDate)) : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: { origin?: string; destination?: string } = {};

        if (!validateAirport(origin)) {
            newErrors.origin = "Unknown airport code";
        }
        if (!validateAirport(destination)) {
            newErrors.destination = "Unknown airport code";
        }

        const paddedOriginTime = padTimeInput(originTime);
        const paddedDestTime = padTimeInput(destTime);
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(paddedOriginTime)) {
            newErrors.origin = newErrors.origin ?? "Enter a valid time (HH:MM)";
        }
        if (!timeRegex.test(paddedDestTime)) {
            newErrors.destination = newErrors.destination ?? "Enter a valid time (HH:MM)";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const originData = AIRPORTS[origin.toUpperCase()];
        const destData = AIRPORTS[destination.toUpperCase()];

        // Times are stored as local wall-clock at each airport. Classify the
        // flight as past/upcoming from its actual departure instant (not the tab
        // it was opened from) so historic flights can be logged from anywhere.
        const departureWallClock = buildWallClock(originDate, paddedOriginTime);
        const arrivalWallClock = buildWallClock(destDate, paddedDestTime);
        const hasDeparted = toInstant(departureWallClock, origin.toUpperCase()).getTime() < Date.now();

        const trip: FlightInput = {
            origin_code: origin.toUpperCase(),
            origin_city: originData.city,
            destination_code: destination.toUpperCase(),
            destination_city: destData.city,
            flight_number: `${AIRLINE_CODE}${formatFlightDigits(flightNum)}`,
            departure_time: departureWallClock,
            arrival_time: arrivalWallClock,
            status: hasDeparted ? "completed" : "scheduled",
            type: hasDeparted ? "past" : "future",
        };
        if (pendingFaFlightId) {
            trip.fa_flight_id = pendingFaFlightId;
        }

        setSubmitting(true);
        try {
            const ok = await onAdd(trip);
            if (!ok) return;
        } finally {
            setSubmitting(false);
        }
    };

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
                        transition={spring.smooth}
                        drag={isMobile ? "y" : false}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        dragMomentum={false}
                        onDragEnd={(_: unknown, info: PanInfo) => {
                            if (info.offset.y > 120 || info.velocity.y > 600) onClose();
                        }}
                        className="fixed inset-x-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-[#0F0F0F] border-t border-x md:border border-white/10 rounded-t-[32px] rounded-b-none md:rounded-[32px] z-[70] shadow-2xl flex flex-col max-h-[85vh] md:max-h-[90vh] overflow-hidden"
                    >
                        {/* Decorative background glow - kept in main container so it stays fixed */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emirates-red/5 blur-[80px] rounded-full pointer-events-none -z-10" />

                        {/* Fixed Header (doubles as the sheet's drag handle on mobile) */}
                        <div
                            className="flex-none z-20 bg-[#0F0F0F] border-b border-white/5 relative touch-none md:touch-auto"
                            onPointerDown={(e) => {
                                if (isMobile) dragControls.start(e);
                            }}
                        >
                            <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-white/15 md:hidden" aria-hidden />
                            <div className="flex items-center justify-between px-5 md:px-8 pt-2 pb-4 md:pt-8 md:pb-6">
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
                            <button onClick={onClose} aria-label="Close" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                                <X size={20} />
                            </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-5 py-6 md:p-8">
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

                                    {aeroConfigured && (
                                        <button
                                            type="button"
                                            onClick={handleLookup}
                                            disabled={lookingUp}
                                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                                        >
                                            {lookingUp ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Search size={14} />
                                            )}
                                            {lookingUp ? "Looking up..." : "Look up flight"}
                                        </button>
                                    )}
                                </div>

                                {/* 2. Dual Column Layout */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 relative">
                                    {/* Decor: Center Divider */}
                                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/5 -translate-x-1/2 hidden md:block" />

                                    {/* LEFT: ORIGIN */}
                                    <div className="space-y-5">
                                        {/* Airport Code */}
                                        <div className="space-y-2">
                                            <label htmlFor="origin-input" className="text-[10px] uppercase tracking-widest text-emirates-red font-bold flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emirates-red" />
                                                Depart From
                                            </label>
                                            <AirportField
                                                id="origin-input"
                                                value={origin}
                                                onChange={(v) => {
                                                    setOrigin(v);
                                                    if (errors.origin) setErrors(prev => ({ ...prev, origin: undefined }));
                                                }}
                                                placeholder="DXB"
                                                hasError={Boolean(errors.origin)}
                                                accentClass="focus:border-emirates-red/50"
                                            />
                                            {errors.origin && (
                                                <p role="alert" className="text-[11px] font-bold text-red-400 ml-1">
                                                    {errors.origin}
                                                </p>
                                            )}
                                        </div>

                                        {/* Date */}
                                        <div className="space-y-1">
                                            <label htmlFor="origin-date" className="h-5 flex items-center text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1">Date</label>
                                            <div className="relative">
                                                <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                                                <input
                                                    id="origin-date"
                                                    type="date"
                                                    value={originDate}
                                                    onChange={(e) => handleOriginDateChange(e.target.value)}
                                                    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 text-white text-sm font-bold tracking-wide uppercase focus:outline-none focus:border-emirates-red/30 transition-all [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full cursor-pointer"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Time */}
                                        <div className="space-y-1">
                                            <label htmlFor="origin-time" className="h-5 flex items-center text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1">Time</label>
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
                                    <div className="space-y-5">
                                        {/* Airport Code */}
                                        <div className="space-y-2">
                                            <label htmlFor="dest-input" className="text-[10px] uppercase tracking-widest text-dubai-gold font-bold flex items-center gap-2 justify-start md:justify-end">
                                                <span className="md:hidden">Arrive At</span> {/* Mobile label order */}
                                                <div className="w-1.5 h-1.5 rounded-full bg-dubai-gold" />
                                                <span className="hidden md:inline">Arrive At</span> {/* Desktop label order */}
                                            </label>
                                            <AirportField
                                                id="dest-input"
                                                value={destination}
                                                onChange={(v) => {
                                                    setDestination(v);
                                                    if (errors.destination) setErrors(prev => ({ ...prev, destination: undefined }));
                                                }}
                                                placeholder="LHR"
                                                hasError={Boolean(errors.destination)}
                                                accentClass="focus:border-dubai-gold/50"
                                            />
                                            {errors.destination && (
                                                <p role="alert" className="text-[11px] font-bold text-red-400 ml-1 md:text-right md:mr-1">
                                                    {errors.destination}
                                                </p>
                                            )}
                                        </div>

                                        {/* Date */}
                                        <div className="space-y-1">
                                            <div className="h-5 flex items-center gap-2 ml-1 md:ml-0 md:mr-1 md:flex-row-reverse">
                                                <label htmlFor="dest-date" className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Date</label>
                                                <AnimatePresence>
                                                    {arrivalSpanDays > 0 && (
                                                        <motion.span
                                                            initial={{ opacity: 0, scale: 0.8 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.8 }}
                                                            transition={spring.smooth}
                                                            className="px-1.5 py-0.5 rounded-full bg-dubai-gold/15 border border-dubai-gold/30 text-dubai-gold text-[9px] font-bold tracking-wider"
                                                        >
                                                            +{arrivalSpanDays} DAY{arrivalSpanDays > 1 ? "S" : ""}
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                            </div>
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
                                            <label htmlFor="dest-time" className="h-5 flex items-center md:justify-end text-[10px] uppercase tracking-wider text-white/30 font-bold ml-1 md:ml-0 md:mr-1">Time</label>
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
                                    disabled={submitting}
                                    className="w-full py-5 rounded-2xl bg-white text-black text-sm font-bold tracking-widest uppercase mt-4 hover:bg-white/90 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    <span className="relative z-10">
                                        {submitting ? "Saving..." : flightToEdit ? "Update Journey" : "Confirm Journey"}
                                    </span>
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
