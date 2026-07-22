"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Flight } from "@/types";
import JourneyList from "@/components/JourneyList";
import { availableYears, computeTravelStats, formatDistanceKm, groupJourneysByMonth } from "@/lib/stats";
import { spring, duration } from "@/lib/motion";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { cn } from "@/lib/utils";

interface HistoryViewProps {
  journeys: Flight[][];
  flights: Flight[];
  now: Date;
  activeOpenCardId: string | null;
  onToggleCard: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  isLightBg: boolean;
}

/** Always renders on the dark glass panel, regardless of page theme. */
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-lg font-black tracking-tight leading-none text-white">{value}</span>
      <span className="text-[10px] font-bold tracking-widest uppercase text-white/55">{label}</span>
    </div>
  );
}

/**
 * Height-collapsing month body. Clip only while the expand/collapse tween
 * runs — once settled, stay overflow-visible so boarding-pass shift springs
 * are never clipped mid-close (tying overflow to activeOpenCardId caused that).
 */
function MonthBody({ children }: { children: React.ReactNode }) {
  const [clipHeight, setClipHeight] = useState(true);
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: duration.base, ease: "easeInOut" }}
      onAnimationStart={() => setClipHeight(true)}
      onAnimationComplete={() => setClipHeight(false)}
      className={clipHeight ? "overflow-hidden" : "overflow-visible"}
    >
      <div className="flex flex-col items-center gap-6 pt-1 pb-2 overflow-visible">
        {children}
      </div>
    </motion.div>
  );
}

export default function HistoryView({
  journeys,
  flights,
  now,
  activeOpenCardId,
  onToggleCard,
  onDelete,
  onEdit,
  isLightBg,
}: HistoryViewProps) {
  const { isFullExperience } = usePerformanceTier();
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const years = useMemo(() => availableYears(flights), [flights]);
  const stats = useMemo(() => computeTravelStats(flights, yearFilter ?? undefined), [flights, yearFilter]);

  const filteredJourneys = useMemo(
    () =>
      yearFilter == null
        ? journeys
        : journeys.filter((j) => Number(j[0]?.departure_time.slice(0, 4)) === yearFilter),
    [journeys, yearFilter],
  );
  const months = useMemo(() => groupJourneysByMonth(filteredJourneys), [filteredJourneys]);

  const toggleMonth = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const chipBase = "px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-widest uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

  return (
    <div className="w-full max-w-sm flex flex-col gap-5">
      {/* Stats header */}
      <div className={cn("rounded-3xl border px-5 py-4 flex flex-col gap-4", isFullExperience ? "glass-dark" : "bg-neutral-950/90", isLightBg ? "border-black/10" : "border-white/10")}>
        {years.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter by year">
            <button
              type="button"
              onClick={() => setYearFilter(null)}
              aria-pressed={yearFilter == null}
              className={cn(chipBase, yearFilter == null ? "bg-white text-black" : "bg-white/10 text-white/70 hover:text-white")}
            >
              All
            </button>
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYearFilter(y)}
                aria-pressed={yearFilter === y}
                className={cn(chipBase, yearFilter === y ? "bg-white text-black" : "bg-white/10 text-white/70 hover:text-white")}
              >
                {y}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-4 gap-2">
          <StatTile value={String(stats.flights)} label="Flights" />
          <StatTile value={String(stats.countries)} label="Countries" />
          <StatTile value={`${stats.hoursInAir}H`} label="In Air" />
          <StatTile value={formatDistanceKm(stats.distanceKm).replace(/ KM$/, "")} label="KM Flown" />
        </div>
      </div>

      {/* Month sections */}
      {months.map((month) => {
        const isOpen = !collapsed.has(month.key);
        const tripCount = month.journeys.length;
        return (
          <section key={month.key} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => toggleMonth(month.key)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3 px-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-lg"
            >
              <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase", isLightBg ? "text-neutral-700" : "text-white/70")}>
                {month.label}
              </h3>
              <span className={cn("text-[10px] font-bold tracking-wider uppercase", isLightBg ? "text-neutral-500" : "text-white/45")}>
                {tripCount} {tripCount === 1 ? "trip" : "trips"}
              </span>
              <div className={cn("h-[1px] flex-1", isLightBg ? "bg-neutral-300/60" : "bg-white/10")} />
              <motion.span
                animate={{ rotate: isOpen ? 0 : -90 }}
                transition={spring.smooth}
                className={cn("flex", isLightBg ? "text-neutral-600" : "text-white/60")}
              >
                <ChevronDown size={14} strokeWidth={3} />
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <MonthBody>
                  <JourneyList
                    journeys={month.journeys}
                    now={now}
                    activeOpenCardId={activeOpenCardId}
                    onToggleCard={onToggleCard}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    keyPrefix={`past-${month.key}`}
                  />
                </MonthBody>
              )}
            </AnimatePresence>
          </section>
        );
      })}
    </div>
  );
}
