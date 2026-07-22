import React from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Undo2, Moon } from "lucide-react";
import { Flight } from "@/types";
import DigitalBoardingPass from "@/components/DigitalBoardingPass";
import { isActive as isFlightActive, isLayoverBetween, isPast, isImminent } from "@/lib/time";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { cardVariantsFull, cardVariantsLite } from "@/lib/motion";
import { cn } from "@/lib/utils";

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
  /** Dim every journey after the first so the next one reads as the focus. */
  emphasizeFirst?: boolean;
  /** Airport code for secondary times on the active card (GlobalPulse selection). */
  referenceCode?: string | null;
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
  emphasizeFirst = false,
  referenceCode = null,
  keyPrefix,
}: JourneyListProps) {
  const { isFullExperience } = usePerformanceTier();
  const cardVariants = isFullExperience ? cardVariantsFull : cardVariantsLite;
  // Layout springs during removal are the point of this component; skip them
  // only on the reduced tier where they'd cost more than they delight.
  const enableLayout = isFullExperience;

  const connectorChrome = isFullExperience
    ? "glass-dark border-white/10 bg-black/55"
    : "bg-neutral-950/90 border-white/10";

  return (
    <LayoutGroup id={keyPrefix}>
      <AnimatePresence mode="popLayout" initial={false}>
        {journeys.map((journey, jIdx) => (
          // Stable key based on the journey's first flight so cards are not
          // remounted (and re-animated from hidden) when journeys are regrouped
          // after adding/removing a flight.
          <motion.div
            key={`${keyPrefix}-${journey[0]?.id ?? jIdx}`}
            layout={enableLayout}
            variants={cardVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="w-full max-w-sm flex flex-col gap-0"
          >
            {/* The top journey is the hero; later ones sit back a little. The
                opacity lives on an inner wrapper so it doesn't fight the keyed
                motion.div's animated opacity. */}
            <div className={cn("flex flex-col gap-0 transition-opacity", emphasizeFirst && jIdx > 0 && "opacity-75")}>
              {/* AnimatePresence tracks direct keyed motion children, so cards and
                  connectors are emitted as flat siblings rather than fragments. */}
              <AnimatePresence mode="popLayout" initial={false}>
              {journey.flatMap((flight, fIdx) => {
                const nextFlight = journey[fIdx + 1];
                const layover = nextFlight ? isLayoverBetween(flight, nextFlight) : false;
                const isLive =
                  showLiveStatus &&
                  liveFlightId === flight.id &&
                  isFlightActive(flight, now);
                const connectorActive = isLive;
                const connectorImminent = isImminent(flight);
                const connectorPast = isPast(flight);

                const items = [
                  <motion.div
                    key={flight.id}
                    layout={enableLayout}
                    variants={cardVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
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
                      referenceCode={referenceCode}
                    />
                  </motion.div>,
                ];

                if (fIdx < journey.length - 1) {
                  items.push(
                    <motion.div
                      key={`${flight.id}-connector`}
                      layout={enableLayout}
                      variants={cardVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
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
                    </motion.div>,
                  );
                }

                return items;
              })}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </LayoutGroup>
  );
}
