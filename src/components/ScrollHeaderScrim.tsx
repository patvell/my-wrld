import { cn } from "@/lib/utils";
import { PLACE_TRANSITION_CSS } from "@/lib/placeTransition";

interface ScrollHeaderScrimProps {
  className?: string;
}

/** Theme-matched gradient that cards fade under fixed section headers. */
export default function ScrollHeaderScrim({ className }: ScrollHeaderScrimProps) {
  return (
    <div
      aria-hidden
      className={cn("absolute left-0 right-0 z-[35] pointer-events-none", className)}
      style={{
        background: "linear-gradient(to bottom, var(--dynamic-background) 0%, transparent 100%)",
        transition: `background ${PLACE_TRANSITION_CSS}`,
      }}
    />
  );
}
