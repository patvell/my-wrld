"use client";

import React from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import type { TravelStats } from "@/lib/stats";
import { formatDistanceKm } from "@/lib/stats";
import { spring } from "@/lib/motion";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";

export interface DestinationEntry {
  code: string;
  city: string;
  country: string;
  visits: number;
}

interface WorldStatsSheetProps {
  open: boolean;
  onClose: () => void;
  stats: TravelStats;
  destinations: DestinationEntry[];
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 border border-white/10 py-3 px-2 min-w-0">
      <span className="text-lg font-black tracking-tight leading-none text-white text-center">{value}</span>
      <span className="text-[10px] font-bold tracking-widest uppercase text-white/55 text-center">{label}</span>
    </div>
  );
}

/**
 * Bottom sheet with the full travel-stat grid and an accessible destinations
 * list — the same data the globe shows, reachable without a pointer.
 */
export default function WorldStatsSheet({ open, onClose, stats, destinations }: WorldStatsSheetProps) {
  const { isMobile } = usePerformanceTier();
  const dragControls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close travel stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] cursor-default"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Travel stats"
            initial={{ opacity: 0, y: 120 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 120 }}
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
            className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-[#0F0F0F] border-t border-x md:border border-white/10 rounded-t-[32px] z-[70] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
          >
            <div
              className="flex-none touch-none md:touch-auto"
              onPointerDown={(e) => {
                if (isMobile) dragControls.start(e);
              }}
            >
              <div className="mx-auto mt-3 mb-1 h-1.5 w-10 rounded-full bg-white/15 md:hidden" aria-hidden />
              <div className="flex items-center justify-between px-6 pt-2 pb-4 border-b border-white/5">
                <h2 className="text-base font-bold text-white tracking-widest uppercase">Your World</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-2">
                <Stat value={String(stats.flights)} label="Flights" />
                <Stat value={String(stats.airports)} label="Airports" />
                <Stat value={String(stats.cities)} label="Cities" />
                <Stat value={String(stats.countries)} label="Countries" />
                <Stat value={`${stats.hoursInAir}H`} label="In Air" />
                <Stat value={formatDistanceKm(stats.distanceKm)} label="Flown" />
              </div>

              {(stats.longestFlightRoute || stats.mostVisitedCity) && (
                <div className="flex flex-col gap-2">
                  {stats.longestFlightRoute && (
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-white/55">Longest flight</span>
                      <span className="text-sm font-black text-white">
                        {stats.longestFlightRoute} · {formatDistanceKm(stats.longestFlightKm)}
                      </span>
                    </div>
                  )}
                  {stats.mostVisitedCity && (
                    <div className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-white/55">Most visited</span>
                      <span className="text-sm font-black text-white">{stats.mostVisitedCity}</span>
                    </div>
                  )}
                </div>
              )}

              {destinations.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[11px] font-black tracking-[0.3em] uppercase text-white/55 px-1">Destinations</h3>
                  <ul className="flex flex-col divide-y divide-white/5 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                    {destinations.map((d) => (
                      <li key={d.code} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="flex items-baseline gap-2.5 min-w-0">
                          <span className="text-sm font-black tracking-wider text-white">{d.code}</span>
                          <span className="text-[11px] font-bold text-white/70 truncate">{d.city}</span>
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{d.country}</span>
                          <span className="text-[11px] font-black text-white/85 tabular-nums">
                            {d.visits}×
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
