"use client";

import React, { useState, useEffect } from "react";
import GlobalPulse from "@/components/GlobalPulse";
import DigitalBoardingPass from "@/components/DigitalBoardingPass";
import PillMenu from "@/components/PillMenu";
import AddTripModal from "@/components/AddTripModal";
import LiquidBackground from "@/components/LiquidBackground";
import { Flight, PersonaMode } from "@/types";
import { getAirportColor, getAirportTimezone } from "@/data/airports";
import { supabase } from "@/lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { History, ArrowUpDown } from "lucide-react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}



export default function Home() {
  const [[activeTab, direction], setActiveTab] = useState<["home" | "history" | "settings", number]>(["home", 0]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [currentPersona, setCurrentPersona] = useState<PersonaMode>("home");
  const [historySortAsc, setHistorySortAsc] = useState(false); // Default false = Newest (most recent) to Oldest
  const [activeOpenCardId, setActiveOpenCardId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

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

  const hasFlightArrived = (flight: Flight) => {
    const destTz = getAirportTimezone(flight.destination_code);
    const nowDest = getWallClock(destTz);
    return nowDest >= flight.arrival_time;
  };

  const currentLocation = getCurrentLocation();
  const currentLocationCode = currentPersona === "home" ? "YUL" : currentLocation.code;
  const primaryColor = getAirportColor(currentLocationCode);

  const upcomingFlights = flights
    .filter(f => !hasFlightArrived(f))
    .sort((a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());

  const pastFlights = flights
    .filter(f => hasFlightArrived(f))
    .sort((a, b) => {
      const tA = new Date(a.departure_time).getTime();
      const tB = new Date(b.departure_time).getTime();
      return historySortAsc ? tA - tB : tB - tA;
    });

  useEffect(() => {
    fetchFlights();
  }, []);

  const fetchFlights = async () => {
    try {
      const { data, error } = await supabase
        .from('flights')
        .select('*')
        .order('departure_time', { ascending: true });

      if (error) throw error;

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
      setLoading(false);
    }
  };

  const handleTabChange = (newTab: "home" | "history" | "settings") => {
    if (newTab === activeTab) return;
    const currentIdx = activeTab === "history" ? 1 : 0;
    const newIdx = newTab === "history" ? 1 : 0;
    const newDir = newIdx > currentIdx ? 1 : -1;
    setActiveTab([newTab, newDir]);
  };

  const handleAddTrip = async (tripData: any) => {
    if (editingFlightId) {
      // Update existing flight
      try {
        const { error } = await supabase
          .from('flights')
          .update(tripData)
          .eq('id', editingFlightId);

        if (error) throw error;

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
        // Remove ID to let DB generate it, or generate one here if we want optimistic UI
        // Supabase returns the created object
        const newFlightData = {
          ...tripData,
          // user_id: ... // if auth is implemented
        };

        const { data, error } = await supabase
          .from('flights')
          .insert([newFlightData])
          .select()
          .single();

        if (error) throw error;

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
      const { error } = await supabase
        .from('flights')
        .delete()
        .eq('id', id);

      if (error) throw error;

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

  // Slide variants for smooth transitions
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
      filter: "blur(4px)",
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
      filter: "blur(4px)",
    }),
  };

  // Transition settings
  const transition = {
    x: { type: "spring" as const, stiffness: 200, damping: 25 },
    opacity: { duration: 0.3 },
    filter: { duration: 0.3 },
  };

  useEffect(() => {
    // Sync body background color for edge/bounce areas
    document.body.style.backgroundColor = primaryColor;
  }, [primaryColor]);

  return (
    <main className="h-[100dvh] w-full font-sans text-white selection:bg-emirates-red/30 relative overflow-hidden flex flex-col">
      {/* Full Screen Background */}
      <LiquidBackground primaryColor={primaryColor} />

      {/* Top Navigation / Clocks - Only visible on Home/Settings */}
      <AnimatePresence>
        {activeTab !== "history" && (
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
            <div className="w-full max-w-sm flex items-center justify-between px-6 py-4 bg-transparent mix-blend-plus-lighter backdrop-blur-sm">
              <h3 className="text-xs font-black tracking-[0.3em] text-white/50 uppercase drop-shadow-md">Upcoming Trips ({upcomingFlights.length})</h3>
              <div className="h-[1px] flex-1 bg-white/10 ml-6" />
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
              <h3 className="text-xs font-black tracking-[0.3em] text-white/50 uppercase drop-shadow-md">Past Trips ({pastFlights.length})</h3>
              <div className="h-[1px] flex-1 bg-white/10 mx-6" />
              <button
                onClick={() => setHistorySortAsc(!historySortAsc)}
                className="text-white/50 hover:text-white transition-colors"
                title={historySortAsc ? "Sort Oldest to Newest" : "Sort Newest to Oldest"}
              >
                <ArrowUpDown size={14} strokeWidth={3} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 w-full max-w-full relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          {activeTab === "home" ? (
            <motion.div
              key="home"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-[420px] px-4 pb-40 flex flex-col items-center gap-6"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 380px, black 440px, black 85%, transparent 100%)",
              }}
            >
              {loading ? (
                <div className="mt-12 text-center text-white/20">Loading...</div>
              ) : (
                <>
                  {upcomingFlights
                    .map((flight) => (
                      <DigitalBoardingPass
                        key={flight.id}
                        flight={flight}
                        onDelete={handleDeleteTrip}
                        onEdit={handleEditTrip}
                        isShifted={activeOpenCardId === flight.id}
                        onToggleShift={() => handleCardToggle(flight.id)}
                      />
                    ))}

                  {upcomingFlights.length === 0 && (
                    <div className="mt-12 text-center">
                      <p className="text-white/20 text-xs italic tracking-wide">No scheduled horizons yet.</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="absolute inset-0 w-full h-full overflow-y-scroll overflow-x-hidden no-scrollbar pt-24 px-4 pb-32 flex flex-col items-center gap-6"
              style={{
                maskImage: "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 40px, black 120px, black 85%, transparent 100%)",
              }}
            >
              {loading ? (
                <div className="mt-20 text-center text-white/20">Loading...</div>
              ) : (
                <>
                  {pastFlights
                    .map((flight) => (
                      <DigitalBoardingPass
                        key={flight.id}
                        flight={flight}
                        onDelete={handleDeleteTrip} // Probably want to allow deleting history too?
                        onEdit={handleEditTrip}
                        isShifted={activeOpenCardId === flight.id}
                        onToggleShift={() => handleCardToggle(flight.id)}
                      />
                    ))}

                  {pastFlights.length === 0 && (
                    <div className="mt-20 flex flex-col items-center text-center">
                      <div className="w-24 h-24 rounded-full border border-white/5 flex items-center justify-center mb-6 bg-white/5">
                        <History className="text-white opacity-50 w-10 h-10" />
                      </div>
                      <p className="text-white/60 text-sm font-medium tracking-wide">Your past journeys will appear here.</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Menu - Fixed */}
      <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="pointer-events-auto">
          <PillMenu
            activeTab={activeTab === "settings" ? "home" : activeTab}
            onTabChange={handleTabChange}
            onAddClick={() => setIsAddModalOpen(true)}
            primaryColor={primaryColor}
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
    </main>
  );
}
