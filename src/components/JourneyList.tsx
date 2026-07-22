import React from "react";
import { motion } from "framer-motion";
import { Undo2, Moon } from "lucide-react";
import { Flight } from "@/types";
import DigitalBoardingPass from "@/components/DigitalBoardingPass";
import { isActive as isFlightActive, isLayoverBetween, isPast, isImminent } from "@/lib/time";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { cn } from "@/lib/utils";

const fullCardVariants = {
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
};

const mobileCardVariants = {
  hidden: { y: 12, opacity: 0, filter: "none" },
  show: {
    y: 0,
    opacity: 1,
    filter: "none",
    transition: { duration: 0.2, ease: "easeOut" as const },
  },
  exit: {
    y: -12,
    opacity: 0,
    filter: "none",
    transition: { duration: 0.12, ease: "easeIn" as const },
  },
};

interface JourneyListProps {
  journeys: Flight[][];
  now: Date;
  activeOpenCardId: string | null;
  onToggleCard: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  /** Whether to surface the live-tracking ("active") state on cards. */
  showLiveStatus?: boolean;
  /** Only this flight id should poll/highlight as live (next upcoming in window). */
  liveFlightId?: string | null;
  onLanded?: (id: string) => void;
  keyPrefix: string;
}

export default function JourneyList({
  journeys,
  now,
  activeOpenCardId,
  onToggleCard,
  onDelete,
  onEdit,
  showLiveStatus = false,
  liveFlightId = null,
  onLanded,
  keyPrefix,
}: JourneyListProps) {
  const { isFullExperience } = usePerformanceTier();
  const cardVariants = isFullExperience ? fullCardVariants : mobileCardVariants;

  const connectorChrome = isFullExperience
    ? "glass-dark border-white/10 bg-black/55"
    : "bg-neutral-950/90 border-white/10";

  return (
    <>
      {journeys.map((journey, jIdx) => (
        // Stable key based on the journey's first flight so cards are not
        // remounted (and re-animated from hidden) when journeys are regrouped
        // after adding/removing a flight.
        <div
          key={`${keyPrefix}-${journey[0]?.id ?? jIdx}`}
          className="w-full max-w-sm flex flex-col gap-0"
        >
          {journey.map((flight, fIdx) => {
            const nextFlight = journey[fIdx + 1];
            const layover = nextFlight ? isLayoverBetween(flight, nextFlight) : false;
            const isLive =
              showLiveStatus &&
              liveFlightId === flight.id &&
              isFlightActive(flight, now);
            const connectorActive = isLive;
            const connectorImminent = isImminent(flight);
            const connectorPast = isPast(flight);

            return (
              <React.Fragment key={flight.id}>
                <motion.div
                  variants={cardVariants}
                  initial="hidden"
                  animate="show"
                  className="w-full relative z-20"
                >
                  <DigitalBoardingPass
                    flight={flight}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    isShifted={activeOpenCardId === flight.id}
                    onToggleShift={() => onToggleCard(flight.id)}
                    isActive={isLive}
                    onLanded={onLanded}
                  />
                </motion.div>

                {fIdx < journey.length - 1 && (
                  <motion.div
                    variants={cardVariants}
                    initial="hidden"
                    animate="show"
                    className="w-full flex justify-center items-center py-1.5 relative z-10"
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center border text-white shadow-sm",
                        connectorChrome,
                        connectorActive && "border-white/60 bg-white/10 shadow-[0_0_16px_-4px_rgba(255,255,255,0.35)]",
                        !connectorActive && connectorImminent && "border-white/40 bg-white/5",
                        !connectorActive && !connectorImminent && connectorPast && "border-white/10",
                      )}
                      aria-hidden
                    >
                      {layover ? (
                        <Moon size={13} className="fill-white text-white" strokeWidth={2.5} />
                      ) : (
                        <Undo2 size={13} strokeWidth={2.5} />
                      )}
                    </div>
                  </motion.div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      ))}
    </>
  );
}
