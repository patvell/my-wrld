"use client";

import React, { useState, useEffect } from "react";
import GlobalPulse from "@/components/GlobalPulse";
import DigitalBoardingPass from "@/components/DigitalBoardingPass";
import PillMenu from "@/components/PillMenu";
import AddTripModal from "@/components/AddTripModal";
import WorldGlobe from "@/components/WorldGlobe";
import LiquidBackground from "@/components/LiquidBackground";
import BoardingPassSkeleton from "@/components/BoardingPassSkeleton";
import { Flight, PersonaMode } from "@/types";
import { getAirportTimezone } from "@/data/airports";
import { groupFlightsIntoJourneys } from "@/lib/flightGrouping";
import { getCountryTheme } from "@/lib/countryTheme";
import { isLightBackground } from "@/lib/colors";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { History, ArrowUpDown, Undo2, Moon } from "lucide-react";
import { useThemeColor } from "@/hooks/useThemeColor";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}



export default function Home() {
  const [[activeTab, direction], setActiveTab] = useState<["home" | "history" | "settings" | "world", number]>(["home", 0]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [currentPersona, setCurrentPersona] = useState<PersonaMode>("plane");
  const [historySortAsc, setHistorySortAsc] = useState(false); // Default false = Newest (most recent) to Oldest
  const [activeOpenCardId, setActiveOpenCardId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [isReady, setIsReady] = useState(false);

  // Update 'now' every minute to ensure location status (in-air vs landed) stays accurate
  React.useEffect(() => {
    // Sync with minute
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Helper to get current wall clock time in a specific timezone as ISO-like string YYYY-MM-DDTHH:mm
  const getWallClock = (timezone: string) => {
    // We use Sweden/Canada locale to get YYYY-MM-DD format usually, but strict format is better
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    // formatToParts is reliable
    const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(new Date());
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  };

  const getCurrentLocation = () => {
    if (flights.length === 0) return { code: "DXB", city: "Dubai" };

    // We need to sort flights. Since we are comparing wall clocks, we assume departure_time is ISO string.
    const sortedFlights = [...flights].sort((a, b) => a.departure_time.localeCompare(b.departure_time));

    // Find the current active flight
    const activeFlight = sortedFlights.find(f => {
      const originTz = getAirportTimezone(f.origin_code);
      const destTz = getAirportTimezone(f.destination_code);

      const nowOrigin = getWallClock(originTz);
      const nowDest = getWallClock(destTz);

      // Has departed? (Current Origin Time >= Scheduled Departure)
      const hasDeparted = nowOrigin >= f.departure_time;
      // Has arrived? (Current Dest Time >= Scheduled Arrival)
      // Note: This logic assumes Arrival Time in Flight Object is "Destination Wall Clock Time"
      const hasArrived = nowDest >= f.arrival_time;

      return hasDeparted && !hasArrived;
    });

    if (activeFlight) {
      return { code: activeFlight.origin_code, city: activeFlight.origin_city };
    }

    // Find last completed flight
    // We iterate backwards
    for (let i = sortedFlights.length - 1; i >= 0; i--) {
      const f = sortedFlights[i];
      const destTz = getAirportTimezone(f.destination_code);
      const nowDest = getWallClock(destTz);
      if (nowDest >= f.arrival_time) {
        return { code: f.destination_code, city: f.destination_city };
      }
    }

    // If no active and no completed, return origin of first flight
    const first = sortedFlights[0];
    return { code: first.origin_code, city: first.origin_city };
  };

  /* 
   * Helper to check if flight has "Arrived" for the purpose of moving to History tab.
   * Requirement: Move to history 2 hours AFTER landing.
   */
  const hasFlightArrived = (flight: Flight) => {
    const destTz = getAirportTimezone(flight.destination_code);
    const nowDest = getWallClock(destTz);

    // We can't just compare ISO strings directly for "2 hours later" easily without parsing
    // But since we are using wall clock ISO strings, let's parse them back to Date objects 
    // strictly for comparison. We treat them as if they are UTC to avoid browser timezone shifts.
    // Clean string of any Z or offsets to treat as abstract wall clock
    const cleanIso = flight.arrival_time.replace(/Z$|[+-]\d{2}:?\d{2}$/, '');
    const arrivalDate = new Date(cleanIso + "Z"); // Treat as UTC
    const nowDestDate = new Date(nowDest + "Z");

    const twoHoursAfter = new Date(arrivalDate.getTime() + 2 * 60 * 60 * 1000);

    return nowDestDate >= twoHoursAfter;
  };

  /*
   * Helper to check if flight is "Active" (Live Tracking Mode).
   * Requirement: Active from 3 hours BEFORE departure until 2 hours AFTER arrival.
   * During this time, card has white hue and tapping opens FlightAware.
   */
  const getFlightStatus = (flight: Flight) => {
    const originTz = getAirportTimezone(flight.origin_code);
    const destTz = getAirportTimezone(flight.destination_code);

    const nowOrigin = getWallClock(originTz);
    const nowDest = getWallClock(destTz);

    // Clean strings
    const cleanDep = flight.departure_time.replace(/Z$|[+-]\d{2}:?\d{2}$/, '');
    const cleanArr = flight.arrival_time.replace(/Z$|[+-]\d{2}:?\d{2}$/, '');

    const depDate = new Date(cleanDep + "Z");
    const arrDate = new Date(cleanArr + "Z");
    const nowOriginDate = new Date(nowOrigin + "Z");
    const nowDestDate = new Date(nowDest + "Z");

    // 3 hours before departure (using Origin time)
    const threeHoursBeforeDep = new Date(depDate.getTime() - 3 * 60 * 60 * 1000);
    // 2 hours after arrival (using Destination time)
    const twoHoursAfterArr = new Date(arrDate.getTime() + 2 * 60 * 60 * 1000);

    const isAfterStart = nowOriginDate >= threeHoursBeforeDep;
    const isBeforeEnd = nowDestDate <= twoHoursAfterArr;

    return isAfterStart && isBeforeEnd;
  };

  const currentLocation = getCurrentLocation();
  const currentLocationCode = currentPersona === "home" ? "YUL" : currentLocation.code;
  const countryTheme = loading
    ? getCountryTheme("YUL")
    : getCountryTheme(currentLocationCode);
  const isLightBg = isLightBackground(countryTheme.effectiveBg);
  const mutedTextClass = isLightBg ? "text-neutral-700" : "text-white/70";
  const subtleTextClass = isLightBg ? "text-neutral-600" : "text-white/40";
  const softTextClass = isLightBg ? "text-neutral-700" : "text-white/60";
  const iconMutedClass = isLightBg ? "text-neutral-500" : "text-white opacity-50";

  const upcomingFlights = flights.filter(f => !hasFlightArrived(f));
  const upcomingJourneys = groupFlightsIntoJourneys(upcomingFlights, true);

  const pastFlights = flights.filter(f => hasFlightArrived(f));
  const pastJourneys = groupFlightsIntoJourneys(pastFlights, historySortAsc);

  useEffect(() => {
    fetchFlights();
  }, []);

  const fetchFlights = async () => {
    try {
      const res = await fetch('/api/flights');
      if (!res.ok) throw new Error('Failed to fetch flights');
      const data = await res.json();

      if (data && data.length > 0) {
        // Ensure status is typed correctly if needed, though usually string matches
        setFlights(data as Flight[]);
      } else {
        // Fallback to initial flights ONLY if DB is empty and we want to seed? 
        // Or just leave empty. The user wants persistence, so let's stick to DB.
        // But for development/demo, maybe we insert initial flights if empty?
        // Let's refrain from auto-seeding to respect user data privacy/intent unless asked.
        setFlights([]);
      }
    } catch (error) {
      console.error('Error fetching flights:', error);
      // In case of error (e.g. no connection), maybe show empty or local backup
    } finally {
      // Data is fetched, but we don't set loading to false yet
      // We wait for the next render cycle where primaryColor will be calculated
      setLoading(false);
    }
  };

  // Stage 2: Once loading is false and primaryColor is determined, wait a tiny bit then reveal
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

  const handleAddTrip = async (tripData: any) => {
    if (editingFlightId) {
      // Update existing flight
      try {
        const res = await fetch(`/api/flights/${editingFlightId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tripData),
        });

        if (!res.ok) throw new Error('Failed to update flight');

        setFlights((prev) => prev.map(f =>
          f.id === editingFlightId ? { ...f, ...tripData } : f
        ));
        setEditingFlightId(null);
      } catch (error) {
        console.error('Error updating flight:', error);
        alert('Failed to update flight');
      }
    } else {
      // Create new flight
      try {
        const newFlightData = {
          ...tripData,
          // user_id: ... // if auth is implemented
        };

        const res = await fetch('/api/flights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newFlightData),
        });

        if (!res.ok) throw new Error('Failed to create flight');
        const data = await res.json();

        if (data) {
          setFlights((prev) => [...prev, data as Flight]);
        }
      } catch (error) {
        console.error('Error adding flight:', error);
        alert('Failed to add flight');
      }
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteTrip = async (id: string) => {
    try {
      const res = await fetch(`/api/flights/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete flight');

      setFlights((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      console.error('Error deleting flight:', error);
      alert('Failed to delete flight');
    }
  };

  const handleEditTrip = (id: string) => {
    setEditingFlightId(id);
    setIsAddModalOpen(true);
  };

  const handleCardToggle = (id: string) => {
    setActiveOpenCardId(prev => (prev === id ? null : id));
  };

  // Staggered container variants for "reshuffling" effect
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.02,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: "easeInOut" as const
      },
    },
  };

  const cardVariants = {
    hidden: {
      y: 20,
      opacity: 0,
      scale: 0.95,
      filter: "blur(4px)"
    },
    show: {
      y: 0,
      opacity: 1,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 150,
        damping: 20,
        mass: 0.8
      }
    },
    exit: {
      y: -20,
      opacity: 0,
      scale: 0.95,
      filter: "blur(4px)",
      transition: { duration: 0.15, ease: "easeIn" as const }
    },
  };

  // Sync background and theme-color with browser UI
  useThemeColor(countryTheme.themeColor);


  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: isReady ? 1 : 0 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
      className={cn(
        "h-[100dvh] min-h-[100dvh] w-full font-sans selection:bg-emirates-red/30 relative overflow-hidden flex flex-col",
        isLightBg ? "text-neutral-900" : "text-white"
      )}
    >
      {/* Full Screen Background */}
      <LiquidBackground theme={countryTheme} />

      {/* Top Navigation / Clocks - Only visible on Home/Settings */}
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
                partnerCity="Montreal"
                partnerCode="YUL"
                persona={currentPersona}
                onTogglePersona={() => setCurrentPersona(prev => prev === "home" ? "plane" : "home")}
                isLoading={loading}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Header for Upcoming Journeys */}
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

      {/* Sticky Header for Past Trips (History) */}
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
              layout
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 w-full h-full flex flex-col"
            >
               {/* Globe will go here */}
               <WorldGlobe flights={flights} primaryColor={countryTheme.accent} />
            </motion.div>
          ) : activeTab === "home" ? (
            <motion.div
              key="home"
              layout
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-[420px] px-4 pb-40 flex flex-col items-center gap-6"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
              }}
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
                  {upcomingJourneys
                    .map((journey, jIdx) => (
                      <div key={`upcoming-journey-${jIdx}`} className="w-full max-w-sm flex flex-col gap-0">
                        {journey.map((flight, fIdx) => {
                          const nextFlight = journey[fIdx + 1];
                          let isLayover = false;
                          if (nextFlight) {
                            const t1 = new Date(flight.departure_time).getTime();
                            const t2 = new Date(nextFlight.departure_time).getTime();
                            const firstFlight = t1 < t2 ? flight : nextFlight;
                            const secondFlight = t1 < t2 ? nextFlight : flight;
                            isLayover = (new Date(secondFlight.departure_time).getTime() - new Date(firstFlight.arrival_time).getTime()) / 3600000 > 12;
                          }

                          return (
                            <React.Fragment key={flight.id}>
                              <motion.div variants={cardVariants} layout className="w-full relative z-20">
                                <DigitalBoardingPass
                                  flight={flight}
                                  onDelete={handleDeleteTrip}
                                  onEdit={handleEditTrip}
                                  isShifted={activeOpenCardId === flight.id}
                                  onToggleShift={() => handleCardToggle(flight.id)}
                                  isActive={getFlightStatus(flight)}
                                />
                              </motion.div>
                              
                              {fIdx < journey.length - 1 && (
                                <motion.div 
                                  variants={cardVariants}
                                  className="w-full flex justify-center items-center py-1 relative opacity-60 z-10"
                                >
                                  <div className="w-6 h-6 rounded-full glass-dark flex items-center justify-center relative z-10 text-white">
                                    {isLayover ? (
                                      <Moon size={12} className="fill-white/20" />
                                    ) : (
                                      <Undo2 size={12} strokeWidth={3} />
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ))}

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
              layout
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="exit"
              className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-24 px-4 pb-32 flex flex-col items-center gap-6"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
              }}
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
                  {pastJourneys
                    .map((journey, jIdx) => (
                      <div key={`journey-${jIdx}`} className="w-full max-w-sm flex flex-col gap-0">
                        {journey.map((flight, fIdx) => {
                          const nextFlight = journey[fIdx + 1];
                          let isLayover = false;
                          if (nextFlight) {
                            const t1 = new Date(flight.departure_time).getTime();
                            const t2 = new Date(nextFlight.departure_time).getTime();
                            const firstFlight = t1 < t2 ? flight : nextFlight;
                            const secondFlight = t1 < t2 ? nextFlight : flight;
                            isLayover = (new Date(secondFlight.departure_time).getTime() - new Date(firstFlight.arrival_time).getTime()) / 3600000 > 12;
                          }

                          return (
                            <React.Fragment key={flight.id}>
                              <motion.div variants={cardVariants} layout className="w-full relative z-20">
                                <DigitalBoardingPass
                                  flight={flight}
                                  onDelete={handleDeleteTrip} // Probably want to allow deleting history too?
                                  onEdit={handleEditTrip}
                                  isShifted={activeOpenCardId === flight.id}
                                  onToggleShift={() => handleCardToggle(flight.id)}
                                />
                              </motion.div>
                              
                              {fIdx < journey.length - 1 && (
                                <motion.div 
                                  variants={cardVariants}
                                  className="w-full flex justify-center items-center py-1 relative opacity-60 z-10"
                                >
                                  <div className="w-6 h-6 rounded-full glass-dark flex items-center justify-center relative z-10 text-white">
                                    {isLayover ? (
                                      <Moon size={12} className="fill-white/20" />
                                    ) : (
                                      <Undo2 size={12} strokeWidth={3} />
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ))}

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

      {/* Bottom Menu - Fixed */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
        <div className="pointer-events-auto">
          <PillMenu
            activeTab={activeTab === "settings" ? "home" : activeTab}
            onTabChange={handleTabChange}
            onAddClick={() => setIsAddModalOpen(true)}
            primaryColor={countryTheme.accent}
          />
        </div>
      </div>

      {/* Add Trip Modal */}
      <AddTripModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingFlightId(null);
        }}
        onAdd={handleAddTrip}
        isHistoryMode={activeTab === "history"}
        flightToEdit={flights.find(f => f.id === editingFlightId) || null}
      />
    </motion.main>
  );
}
