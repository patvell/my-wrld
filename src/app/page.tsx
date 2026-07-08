"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import GlobalPulse from "@/components/GlobalPulse";
import PillMenu from "@/components/PillMenu";
import AddTripModal from "@/components/AddTripModal";
import LiquidBackground from "@/components/LiquidBackground";
import BoardingPassSkeleton from "@/components/BoardingPassSkeleton";
import JourneyList from "@/components/JourneyList";
import HistoryView from "@/components/HistoryView";
import { Flight, FlightInput, PersonaMode } from "@/types";
import { groupFlightsIntoJourneys } from "@/lib/flightGrouping";
import { getCurrentLocation, isPast } from "@/lib/time";
import { nextCountdown, formatCountdown } from "@/lib/stats";
import { PARTNER_CITY, PARTNER_CODE } from "@/lib/config";
import { getCountryTheme } from "@/lib/countryTheme";
import { isLightBackground } from "@/lib/colors";
import { PLACE_TRANSITION_CSS } from "@/lib/placeTransition";
import { motion } from "framer-motion";
import { TAB_FADE, TAB_SHIFT_PX, cardVariantsFull, cardVariantsLite } from "@/lib/motion";
import { History, ArrowUpDown, PlaneLanding, PlaneTakeoff } from "lucide-react";
import { toast } from "sonner";
import { useThemeColor } from "@/hooks/useThemeColor";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { cn } from "@/lib/utils";

const WorldGlobe = dynamic(() => import("@/components/WorldGlobe"), { ssr: false });

function LoadErrorState({ onRetry, textClass }: { onRetry: () => void; textClass: string }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center gap-4">
      <p className={cn(textClass, "text-sm font-medium tracking-wide")}>
        Couldn&apos;t load your journeys.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="px-5 py-2.5 rounded-full glass-dark border border-white/15 text-white text-xs font-bold uppercase tracking-widest hover:bg-black/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        Try again
      </button>
    </div>
  );
}

export default function Home() {
  const { isFullExperience } = usePerformanceTier();
  const [activeTab, setActiveTab] = useState<"home" | "history" | "settings" | "world">("home");
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [currentPersona, setCurrentPersona] = useState<PersonaMode>("plane");
  const [historySortAsc, setHistorySortAsc] = useState(false);
  const [activeOpenCardId, setActiveOpenCardId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentLocation = useMemo(() => getCurrentLocation(flights, now), [flights, now]);
  const currentLocationCode = currentPersona === "home" ? PARTNER_CODE : currentLocation.code;
  const countryTheme = loading
    ? getCountryTheme(PARTNER_CODE)
    : getCountryTheme(currentLocationCode);

  const isLightBg = isLightBackground(countryTheme.effectiveBg);
  const mutedTextClass = isLightBg ? "text-neutral-700" : "text-white/70";
  const subtleTextClass = isLightBg ? "text-neutral-600" : "text-white/40";
  const softTextClass = isLightBg ? "text-neutral-700" : "text-white/60";
  const iconMutedClass = isLightBg ? "text-neutral-500" : "text-white opacity-50";

  const upcomingFlights = useMemo(() => flights.filter((f) => !isPast(f, now)), [flights, now]);
  const upcomingJourneys = useMemo(() => groupFlightsIntoJourneys(upcomingFlights, true), [upcomingFlights]);

  const pastFlights = useMemo(() => flights.filter((f) => isPast(f, now)), [flights, now]);
  const pastJourneys = useMemo(() => groupFlightsIntoJourneys(pastFlights, historySortAsc), [pastFlights, historySortAsc]);

  const countdown = useMemo(() => nextCountdown(flights, now), [flights, now]);

  useEffect(() => {
    fetchFlights();
  }, []);

  useEffect(() => {
    const REFRESH_MS = 5 * 60 * 1000;
    const timer = setInterval(() => fetchFlights(true), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchFlights(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Silent refreshes keep the list current (e.g. a flight the cron marked as
  // landed moves to History) without flashing the skeleton or an error state
  // over data we already have.
  const fetchFlights = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const res = await fetch('/api/flights');
      if (!res.ok) throw new Error('Failed to fetch flights');
      const data = await res.json();
      setFlights(Array.isArray(data) ? (data as Flight[]) : []);
      if (silent) setLoadError(false);
    } catch (error) {
      console.error('Error fetching flights:', error);
      if (!silent) setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const handleTabChange = (newTab: "home" | "history" | "settings" | "world") => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
  };

  const handleAddTrip = async (tripData: FlightInput): Promise<boolean> => {
    const flightId = editingFlightId;
    if (flightId) {
      try {
        const res = await fetch(`/api/flights/${flightId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tripData),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error('Failed to update flight:', res.status, body);
          toast.error('Failed to update flight');
          return false;
        }
        const updated = (await res.json()) as Flight;
        setFlights((prev) => prev.map((f) => (f.id === flightId ? updated : f)));
        setEditingFlightId(null);
        setIsAddModalOpen(false);
        return true;
      } catch (error) {
        console.error('Error updating flight:', error);
        toast.error('Failed to update flight — check your connection and try again');
        return false;
      }
    }

    try {
      const res = await fetch('/api/flights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripData),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('Failed to create flight:', res.status, body);
        toast.error('Failed to add flight');
        return false;
      }
      const data = (await res.json()) as Flight;
      if (data) setFlights((prev) => [...prev, data]);
      setIsAddModalOpen(false);
      return true;
    } catch (error) {
      console.error('Error adding flight:', error);
      toast.error('Failed to add flight — check your connection and try again');
      return false;
    }
  };

  const handleDeleteTrip = async (id: string) => {
    try {
      const res = await fetch(`/api/flights/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('Failed to delete flight:', res.status, body);
        throw new Error('Failed to delete flight');
      }
      setFlights((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      console.error('Error deleting flight:', error);
      toast.error('Failed to delete flight');
    }
  };

  const handleEditTrip = (id: string) => {
    setEditingFlightId(id);
    setIsAddModalOpen(true);
  };

  const handleCardToggle = (id: string) => {
    setActiveOpenCardId((prev) => (prev === id ? null : id));
  };

  const cardVariants = isFullExperience ? cardVariantsFull : cardVariantsLite;

  // Shared-axis tab motion: inactive panels rest offset toward their side of
  // the tab order (world < home < history), so activating one slides it in
  // from the direction of travel instead of a flat crossfade.
  const TAB_ORDER = { world: 0, home: 1, history: 2, settings: 1 } as const;
  const activeIdx = TAB_ORDER[activeTab];
  const panelShift = (tab: keyof typeof TAB_ORDER) =>
    activeTab === tab ? 0 : TAB_ORDER[tab] < activeIdx ? -TAB_SHIFT_PX : TAB_SHIFT_PX;

  const homeScrollMask = {
    maskImage:
      "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
  } as const;

  const historyScrollMask = {
    maskImage:
      "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
  } as const;

  useThemeColor(countryTheme.effectiveBg);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: isReady ? 1 : 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className={cn(
        "h-[100dvh] min-h-[100dvh] w-full font-sans selection:bg-emirates-red/30 relative overflow-hidden flex flex-col",
        isLightBg ? "text-neutral-900" : "text-white"
      )}
      style={{ transition: `color ${PLACE_TRANSITION_CSS}` }}
    >
      <LiquidBackground theme={countryTheme} />

      {/* inert (not just pointer-events) — descendants re-enable hit-testing
          with pointer-events-auto, and hidden panels must not take focus. */}
      <motion.div
        aria-hidden={activeTab !== "home"}
        inert={activeTab !== "home"}
        animate={{
          opacity: activeTab === "home" ? 1 : 0,
          y: activeTab === "home" ? 0 : -12,
        }}
        transition={TAB_FADE}
        className="absolute top-0 left-0 right-0 z-50 pointer-events-none"
        style={{ pointerEvents: activeTab === "home" ? "auto" : "none" }}
      >
        <GlobalPulse
          faCity={currentLocation.city}
          faCode={currentLocation.code}
          partnerCity={PARTNER_CITY}
          partnerCode={PARTNER_CODE}
          persona={currentPersona}
          onTogglePersona={() => setCurrentPersona((prev) => (prev === "home" ? "plane" : "home"))}
          isLoading={loading}
        />
      </motion.div>

      <motion.div
        aria-hidden={activeTab !== "home"}
        inert={activeTab !== "home"}
        animate={{
          opacity: activeTab === "home" ? 1 : 0,
          y: activeTab === "home" ? 0 : -8,
        }}
        transition={TAB_FADE}
        className="absolute top-[calc(max(env(safe-area-inset-top,0px),40px)+300px)] left-0 right-0 z-40 flex justify-center pointer-events-none"
        style={{ pointerEvents: activeTab === "home" ? "auto" : "none" }}
      >
        <div className="w-full max-w-sm flex items-center justify-between px-6 py-4 pointer-events-auto">
          <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase", mutedTextClass)}>Upcoming Trips ({upcomingFlights.length})</h3>
          <div className={cn("h-[1px] flex-1 ml-6", isLightBg ? "bg-neutral-300/60" : "bg-white/10")} />
        </div>
      </motion.div>

      <motion.div
        aria-hidden={activeTab !== "history"}
        inert={activeTab !== "history"}
        animate={{
          opacity: activeTab === "history" ? 1 : 0,
          y: activeTab === "history" ? 0 : -8,
        }}
        transition={TAB_FADE}
        className="absolute top-[max(calc(env(safe-area-inset-top,0px)+8px),2rem)] left-0 right-0 z-40 flex justify-center pointer-events-none"
        style={{ pointerEvents: activeTab === "history" ? "auto" : "none" }}
      >
        <div className="w-full max-w-sm flex items-center justify-between px-6 py-4 bg-transparent pointer-events-auto">
          <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase", mutedTextClass)}>Past Trips ({pastFlights.length})</h3>
          <div className={cn("h-[1px] flex-1 mx-6", isLightBg ? "bg-neutral-300/60" : "bg-white/10")} />
          <button
            onClick={() => setHistorySortAsc(!historySortAsc)}
            className={cn(mutedTextClass, isLightBg ? "hover:text-neutral-900" : "hover:text-white", "transition-colors")}
            title={historySortAsc ? "Sort Oldest to Newest" : "Sort Newest to Oldest"}
          >
            <ArrowUpDown size={14} strokeWidth={3} />
          </button>
        </div>
      </motion.div>

      <div className="flex-1 w-full max-w-full relative overflow-hidden">
        <motion.div
          aria-hidden={activeTab !== "world"}
          inert={activeTab !== "world"}
          animate={{ opacity: activeTab === "world" ? 1 : 0, x: panelShift("world") }}
          transition={TAB_FADE}
          className="absolute inset-0 w-full h-full flex flex-col"
          style={{ pointerEvents: activeTab === "world" ? "auto" : "none" }}
        >
          <WorldGlobe
            flights={flights}
            atmosphereColor={countryTheme.effectiveBg}
            chromeColor={countryTheme.chromeColor}
          />
        </motion.div>

        <motion.div
          aria-hidden={activeTab !== "home"}
          inert={activeTab !== "home"}
          animate={{ opacity: activeTab === "home" ? 1 : 0, x: panelShift("home") }}
          transition={TAB_FADE}
          className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-[calc(max(env(safe-area-inset-top,0px),40px)+380px)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10rem)] flex flex-col items-center gap-6"
          style={{ ...homeScrollMask, pointerEvents: activeTab === "home" ? "auto" : "none" }}
        >
          {loading ? (
            <div className="flex flex-col gap-6 w-full items-center">
              {[1, 2, 3].map((i) => (
                <motion.div key={i} variants={cardVariants} initial="hidden" animate="show" className="w-full max-w-sm">
                  <BoardingPassSkeleton />
                </motion.div>
              ))}
            </div>
          ) : loadError ? (
            <LoadErrorState onRetry={fetchFlights} textClass={softTextClass} />
          ) : (
            <>
              {countdown && (
                <div className="w-full max-w-sm flex justify-center">
                  <div
                    className="glass-dark border border-white/10 rounded-full px-4 py-2 flex items-center gap-2"
                    role="status"
                  >
                    {countdown.kind === "landing-home" ? (
                      <PlaneLanding size={13} className="text-white/80" aria-hidden />
                    ) : (
                      <PlaneTakeoff size={13} className="text-white/80" aria-hidden />
                    )}
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/85">
                      {countdown.kind === "landing-home" ? "Lands home in" : "Next journey in"}{" "}
                      {formatCountdown(countdown.target.getTime() - now.getTime())}
                    </span>
                  </div>
                </div>
              )}
              <JourneyList
                journeys={upcomingJourneys}
                now={now}
                activeOpenCardId={activeOpenCardId}
                onToggleCard={handleCardToggle}
                onDelete={handleDeleteTrip}
                onEdit={handleEditTrip}
                showLiveStatus
                keyPrefix="upcoming"
              />
              {upcomingJourneys.length === 0 && (
                <div className="mt-12 text-center">
                  <p className={cn(subtleTextClass, "text-xs italic tracking-wide")}>Your upcoming flights will appear here</p>
                </div>
              )}
            </>
          )}
        </motion.div>

        <motion.div
          aria-hidden={activeTab !== "history"}
          inert={activeTab !== "history"}
          animate={{ opacity: activeTab === "history" ? 1 : 0, x: panelShift("history") }}
          transition={TAB_FADE}
          className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-[max(calc(env(safe-area-inset-top,0px)+72px),6rem)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+8rem)] flex flex-col items-center gap-6"
          style={{ ...historyScrollMask, pointerEvents: activeTab === "history" ? "auto" : "none" }}
        >
          {loading ? (
            <div className="flex flex-col gap-6 w-full items-center">
              {[1, 2, 3].map((i) => (
                <motion.div key={i} variants={cardVariants} initial="hidden" animate="show" className="w-full max-w-sm">
                  <BoardingPassSkeleton />
                </motion.div>
              ))}
            </div>
          ) : loadError ? (
            <LoadErrorState onRetry={fetchFlights} textClass={softTextClass} />
          ) : (
            <>
              <HistoryView
                journeys={pastJourneys}
                flights={pastFlights}
                now={now}
                activeOpenCardId={activeOpenCardId}
                onToggleCard={handleCardToggle}
                onDelete={handleDeleteTrip}
                onEdit={handleEditTrip}
                isLightBg={isLightBg}
              />
              {pastJourneys.length === 0 && (
                <div className="mt-20 flex flex-col items-center text-center">
                  <div className={cn("w-24 h-24 rounded-full border flex items-center justify-center mb-6", isLightBg ? "border-neutral-200 bg-white/80 shadow-sm" : "border-white/5 bg-white/5")}>
                    <History className={cn(iconMutedClass, "w-10 h-10")} />
                  </div>
                  <p className={cn(softTextClass, "text-sm font-medium tracking-wide")}>Your past journeys will appear here.</p>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto">
          <PillMenu
            activeTab={activeTab === "settings" ? "home" : activeTab}
            onTabChange={handleTabChange}
            onAddClick={() => setIsAddModalOpen(true)}
            chromeColor={countryTheme.chromeColor}
          />
        </div>
      </div>

      <AddTripModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingFlightId(null);
        }}
        onAdd={handleAddTrip}
        isHistoryMode={activeTab === "history"}
        flightToEdit={flights.find((f) => f.id === editingFlightId) || null}
      />
    </motion.main>
  );
}
