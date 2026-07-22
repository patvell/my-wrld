"use client";

import { useEffect, useState } from "react";

export type PerformanceTier = "full" | "mobile" | "reduced";

function getMobileQuery() {
  if (typeof window === "undefined") return null;
  return window.matchMedia("(max-width: 768px)");
}

function getReducedMotionQuery() {
  if (typeof window === "undefined") return null;
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

function computeTier(isMobile: boolean, prefersReducedMotion: boolean): PerformanceTier {
  if (prefersReducedMotion) return "reduced";
  if (isMobile) return "mobile";
  return "full";
}

/**
 * Experience + layout hints.
 *
 * - `isFullExperience`: product UX matches desktop (glass, card springs, live
 *   shimmer, etc.). True on phone and desktop; only `prefers-reduced-motion`
 *   opts into the lite path.
 * - `isMobile`: viewport ≤768px — layout/sizing only (globe altitude, sheet
 *   drag, marker scale), never used to strip features.
 *
 * IMPORTANT: always start with stable SSR defaults and only read matchMedia
 * after mount — otherwise narrow preview panes hydrate differently and Next
 * reports attribute mismatches.
 */
export function usePerformanceTier() {
  const [tier, setTier] = useState<PerformanceTier>("full");
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    const mobileQuery = getMobileQuery();
    const motionQuery = getReducedMotionQuery();
    if (!mobileQuery || !motionQuery) return;

    const update = () => {
      setIsMobileViewport(mobileQuery.matches);
      setTier(computeTier(mobileQuery.matches, motionQuery.matches));
    };

    update();
    mobileQuery.addEventListener("change", update);
    motionQuery.addEventListener("change", update);

    return () => {
      mobileQuery.removeEventListener("change", update);
      motionQuery.removeEventListener("change", update);
    };
  }, []);

  return {
    tier,
    isMobile: isMobileViewport,
    prefersReducedMotion: tier === "reduced",
    // Phone and desktop share the same product experience; only reduced-motion
    // users get the lite visual path.
    isFullExperience: tier !== "reduced",
  };
}
