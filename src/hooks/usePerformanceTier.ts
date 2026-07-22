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

function readTier(): PerformanceTier {
  const mobileQuery = getMobileQuery();
  const motionQuery = getReducedMotionQuery();
  if (!mobileQuery || !motionQuery) return "full";
  return computeTier(mobileQuery.matches, motionQuery.matches);
}

/**
 * Performance tier for animation/blob density.
 * IMPORTANT: always start with a stable SSR default ("full") and only read
 * matchMedia after mount — otherwise narrow preview panes hydrate with
 * "mobile" and Next.js reports attribute mismatches (Turbopack overlay).
 */
export function usePerformanceTier() {
  const [tier, setTier] = useState<PerformanceTier>("full");

  useEffect(() => {
    const mobileQuery = getMobileQuery();
    const motionQuery = getReducedMotionQuery();
    if (!mobileQuery || !motionQuery) return;

    const update = () => {
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
    isMobile: tier === "mobile" || tier === "reduced",
    prefersReducedMotion: tier === "reduced",
    isFullExperience: tier === "full",
  };
}
