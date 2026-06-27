"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import GlobalPulse from "@/components/GlobalPulse";
import PillMenu from "@/components/PillMenu";
import AddTripModal from "@/components/AddTripModal";
import LiquidBackground from "@/components/LiquidBackground";
import BoardingPassSkeleton from "@/components/BoardingPassSkeleton";
import JourneyList from "@/components/JourneyList";
import { Flight, FlightInput, PersonaMode } from "@/types";
import { groupFlightsIntoJourneys } from "@/lib/flightGrouping";
import { getCurrentLocation, isPast } from "@/lib/time";
import { PARTNER_CITY, PARTNER_CODE } from "@/lib/config";
import { getCountryTheme } from "@/lib/countryTheme";
import { isLightBackground } from "@/lib/colors";
import { PLACE_TRANSITION_CSS } from "@/lib/placeTransition";
import { motion, AnimatePresence } from "framer-motion";
import { History, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useThemeColor } from "@/hooks/useThemeColor";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { cn } from "@/lib/utils";

const WorldGlobe = dynamic(() => import("@/components/WorldGlobe"), { ssr: false });

export default function Home() {
  const { isFullExperience } = usePerformanceTier();
  const [[activeTab, direction], setActiveTab] = useState<["home" | "history" | "settings" | "world", number]>(["home", 0]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchFlights();
  }, []);

  const fetchFlights = async () => {
    try {
      const res = await fetch('/api/flights');
      if (!res.ok) throw new Error('Failed to fetch flights');
      const data = await res.json();
      setFlights(Array.isArray(data) ? (data as Flight[]) : []);
    } catch (error) {
      console.error('Error fetching flights:', error);
    } finally {
      setLoading(false);
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
    const currentIdx = activeTab === "world" ? 0 : activeTab === "home" ? 1 : 2;
    const newIdx = newTab === "world" ? 0 : newTab === "home" ? 1 : 2;
    const newDir = newIdx > currentIdx ? 1 : -1;
    setActiveTab([newTab, newDir]);
  };

  const handleAddTrip = async (tripData: FlightInput) => {
    if (editingFlightId) {
      try {
        const res = await fetch(`/api/flights/${editingFlightId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tripData),
        });
        if (!res.ok) throw new Error('Failed to update flight');
        const updated = (await res.json()) as Flight;
        setFlights((prev) => prev.map((f) => (f.id === editingFlightId ? updated : f)));
        setEditingFlightId(null);
      } catch (error) {
        console.error('Error updating flight:', error);
        toast.error('Failed to update flight');
      }
    } else {
      try {
        const res = await fetch('/api/flights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tripData),
        });
        if (!res.ok) throw new Error('Failed to create flight');
        const data = (await res.json()) as Flight;
        if (data) setFlights((prev) => [...prev, data]);
      } catch (error) {
        console.error('Error adding flight:', error);
        toast.error('Failed to add flight');
      }
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteTrip = async (id: string) => {
    try {
      const res = await fetch(`/api/flights/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete flight');
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

  const containerVariants = useMemo(
    () => ({
      hidden: { opacity: 0 },
      show: {
        opacity: 1,
        transition: isFullExperience
          ? { staggerChildren: 0.08, delayChildren: 0.02 }
          : { staggerChildren: 0, delayChildren: 0, duration: 0.2 },
      },
      exit: { opacity: 0, transition: { duration: 0.2, ease: "easeInOut" as const } },
    }),
    [isFullExperience],
  );

  const cardVariants = useMemo(
    () =>
      isFullExperience
        ? {
            hidden: { y: 20, opacity: 0, scale: 0.95 },
            show: {
              y: 0,
              opacity: 1,
              scale: 1,
              transition: { type: "spring" as const, stiffness: 150, damping: 20, mass: 0.8 },
            },
            exit: {
              y: -20,
              opacity: 0,
              scale: 0.95,
              transition: { duration: 0.15, ease: "easeIn" as const },
            },
          }
        : {
            hidden: { y: 12, opacity: 0, filter: "none" },
            show: { y: 0, opacity: 1, filter: "none", transition: { duration: 0.2, ease: "easeOut" as const } },
            exit: { y: -12, opacity: 0, filter: "none", transition: { duration: 0.12, ease: "easeIn" as const } },
          },
    [isFullExperience],
  );

  const homeScrollMask = isFullExperience
    ? {
        maskImage: "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
      }
    : undefined;

  const historyScrollMask = isFullExperience
    ? {
        maskImage: "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
      }
    : undefined;

  useThemeColor(countryTheme.themeColor);

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

      <AnimatePresence>
        {activeTab !== "history" && activeTab !== "world" && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute top-0 left-0 right-0 z-50 pointer-events-none"
          >
            <div className="pointer-events-auto">
              <GlobalPulse
                faCity={currentLocation.city}
                faCode={currentLocation.code}
                partnerCity={PARTNER_CITY}
                partnerCode={PARTNER_CODE}
                persona={currentPersona}
                onTogglePersona={() => setCurrentPersona((prev) => (prev === "home" ? "plane" : "home"))}
                isLoading={loading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === "home" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[340px] left-0 right-0 z-40 flex justify-center pointer-events-none"
          >
            <div className="w-full max-w-sm flex items-center justify-between px-6 py-4 pointer-events-auto">
              <h3 className={cn("text-xs font-black tracking-[0.3em] uppercase", mutedTextClass)}>Upcoming Trips ({upcomingFlights.length})</h3>
              <div className={cn("h-[1px] flex-1 ml-6", isLightBg ? "bg-neutral-300/60" : "bg-white/10")} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTab === "history" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-8 left-0 right-0 z-40 flex justify-center pointer-events-none"
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
        )}
      </AnimatePresence>

      <div className="flex-1 w-full max-w-full relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {activeTab === "world" ? (
            <motion.div
              key="world"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 w-full h-full flex flex-col"
            >
              <WorldGlobe
                flights={flights}
                atmosphereColor={countryTheme.effectiveBg}
                chromeColor={countryTheme.chromeColor}
              />
            </motion.div>
          ) : activeTab === "home" ? (
            <motion.div
              key="home"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-[420px] px-4 pb-40 flex flex-col items-center gap-6"
              style={homeScrollMask}
            >
              {loading ? (
                <div className="flex flex-col gap-6 w-full items-center">
                  {[1, 2, 3].map((i) => (
                    <motion.div key={i} variants={cardVariants} className="w-full max-w-sm">
                      <BoardingPassSkeleton />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <>
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
          ) : (
            <motion.div
              key="history"
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-24 px-4 pb-32 flex flex-col items-center gap-6"
              style={historyScrollMask}
            >
              {loading ? (
                <div className="flex flex-col gap-6 w-full items-center">
                  {[1, 2, 3].map((i) => (
                    <motion.div key={i} variants={cardVariants} className="w-full max-w-sm">
                      <BoardingPassSkeleton />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <>
                  <JourneyList
                    journeys={pastJourneys}
                    now={now}
                    activeOpenCardId={activeOpenCardId}
                    onToggleCard={handleCardToggle}
                    onDelete={handleDeleteTrip}
                    onEdit={handleEditTrip}
                    keyPrefix="past"
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
          )}
        </AnimatePresence>
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
