"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AIRPORTS, type ExtendedAirport } from "@/data/airports";
import { duration } from "@/lib/motion";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 6;

/** Rank airports for a query: code prefix first, then city/country matches. */
function searchAirports(query: string): ExtendedAirport[] {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    const byCode: ExtendedAirport[] = [];
    const byPlace: ExtendedAirport[] = [];
    for (const airport of Object.values(AIRPORTS)) {
        if (airport.code.startsWith(q)) {
            byCode.push(airport);
        } else if (
            airport.city.toUpperCase().includes(q) ||
            airport.country.toUpperCase().includes(q)
        ) {
            byPlace.push(airport);
        }
    }
    return [...byCode, ...byPlace].slice(0, MAX_SUGGESTIONS);
}

interface AirportFieldProps {
    id: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    hasError?: boolean;
    /** Focus border accent, e.g. "focus:border-emirates-red/50". */
    accentClass: string;
}

/**
 * Airport code input with a search dropdown over the known AIRPORTS map.
 * Typing a city, country, or partial code suggests matches; picking one fills
 * the IATA code. Typing a full code directly still works untouched.
 */
export default function AirportField({ id, value, onChange, placeholder, hasError = false, accentClass }: AirportFieldProps) {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(0);

    const suggestions = useMemo(() => (open ? searchAirports(value) : []), [open, value]);
    const listId = `${id}-listbox`;

    const pick = (code: string) => {
        onChange(code);
        setOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!open || suggestions.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted((h) => (h + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[Math.min(highlighted, suggestions.length - 1)].code);
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <div className="relative">
            <input
                id={id}
                type="text"
                role="combobox"
                aria-expanded={open && suggestions.length > 0}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-invalid={hasError}
                autoComplete="off"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setOpen(true);
                    setHighlighted(0);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={handleKeyDown}
                maxLength={24}
                placeholder={placeholder}
                className={cn(
                    "w-full h-14 md:h-16 bg-white/5 border rounded-2xl text-center text-xl md:text-2xl text-white font-bold tracking-widest uppercase focus:outline-none focus:bg-white/10 transition-all placeholder:text-white/10",
                    hasError ? "border-red-500/50" : cn("border-white/10", accentClass),
                )}
                required
            />

            <AnimatePresence>
                {open && suggestions.length > 0 && (
                    <motion.ul
                        id={listId}
                        role="listbox"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: duration.fast }}
                        className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border border-white/10 bg-[#161616] shadow-2xl shadow-black/50 overflow-hidden"
                    >
                        {suggestions.map((airport, i) => (
                            <li key={airport.code} role="option" aria-selected={i === highlighted} id={`${listId}-${i}`}>
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    // preventDefault keeps focus in the input so blur
                                    // doesn't close the list before click lands.
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => pick(airport.code)}
                                    onMouseEnter={() => setHighlighted(i)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
                                        i === highlighted ? "bg-white/10" : "bg-transparent",
                                    )}
                                >
                                    <span className="flex items-baseline gap-2.5 min-w-0">
                                        <span className="text-base font-black tracking-wider text-white">{airport.code}</span>
                                        <span className="text-[11px] font-bold text-white/70 truncate">{airport.city}</span>
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 shrink-0">{airport.country}</span>
                                </button>
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
