import React from "react";
import { motion } from "framer-motion";
import { Undo2, Moon } from "lucide-react";
import { Flight } from "@/types";
import DigitalBoardingPass from "@/components/DigitalBoardingPass";
import { isActive as isFlightActive, isLayoverBetween } from "@/lib/time";

const cardVariants = {
  hidden: { y: 20, opacity: 0, scale: 0.95, filter: "blur(4px)" },
  show: {
    y: 0,
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 150, damping: 20, mass: 0.8 },
  },
  exit: {
    y: -20,
    opacity: 0,
    scale: 0.95,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeIn" as const },
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
  keyPrefix,
}: JourneyListProps) {
  return (
    <>
      {journeys.map((journey, jIdx) => (
        <div key={`${keyPrefix}-journey-${jIdx}`} className="w-full max-w-sm flex flex-col gap-0">
          {journey.map((flight, fIdx) => {
            const nextFlight = journey[fIdx + 1];
            const layover = nextFlight ? isLayoverBetween(flight, nextFlight) : false;

            return (
              <React.Fragment key={flight.id}>
                <motion.div variants={cardVariants} layout className="w-full relative z-20">
                  <DigitalBoardingPass
                    flight={flight}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    isShifted={activeOpenCardId === flight.id}
                    onToggleShift={() => onToggleCard(flight.id)}
                    isActive={showLiveStatus && isFlightActive(flight, now)}
                  />
                </motion.div>

                {fIdx < journey.length - 1 && (
                  <motion.div
                    variants={cardVariants}
                    className="w-full flex justify-center items-center py-1 relative opacity-60 z-10"
                  >
                    <div className="w-6 h-6 rounded-full glass flex items-center justify-center relative z-10 text-white">
                      {layover ? (
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
    </>
  );
}
