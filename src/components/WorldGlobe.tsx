"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { Material } from "three";
import type { GlobeMethods } from "react-globe.gl";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";
import { isPast } from "@/lib/time";
import { loadGlobeTexture } from "@/lib/createGlobeTexture";
import Globe from "@/components/GlobeCanvas";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { findNearbyAirports } from "@/lib/globeUtils";
import { hexToRgba, isLightBackground } from "@/lib/colors";
import { cn } from "@/lib/utils";

const HOME_BASE = "DXB";
const TILT_LIMIT = (35 * Math.PI) / 180;
const AUTO_ROTATE_RESUME_MS = 3000;
const DESKTOP_GLOBE_ALTITUDE = 3.2;
const MOBILE_GLOBE_ALTITUDE = 6.7;
const MAX_VISIBLE_ROUTES = 20;
const CLUSTER_THRESHOLD_KM = 350;

interface WorldGlobeProps {
  flights: Flight[];
  atmosphereColor: string;
  chromeColor: string;
}

const NAV_PILL_CLASS = "glass-dark rounded-full shadow-2xl border-white/5";

interface ArcDatum {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  isPast: boolean;
}

interface PointDatum {
  lat: number;
  lng: number;
  code: string;
  color: string;
  size: number;
  hasPast: boolean;
  hasUpcoming: boolean;
}

function isReturnToHome(flight: Flight): boolean {
  return flight.destination_code === HOME_BASE;
}

function getDimensions(isMobile: boolean) {
  if (typeof window === "undefined") return { width: 390, height: 844 };
  const scale = isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;
  return {
    width: Math.floor(window.innerWidth * scale),
    height: Math.floor(window.innerHeight * scale),
  };
}

function getGlobeAltitude(isMobile: boolean) {
  return isMobile ? MOBILE_GLOBE_ALTITUDE : DESKTOP_GLOBE_ALTITUDE;
}

function markerStyle(
  chromeColor: string,
  hasPast: boolean,
  hasUpcoming: boolean,
  isSelected: boolean,
  isMobile: boolean,
) {
  const mult = isMobile ? 2.5 : 1.5;
  let size: number;
  let alpha: number;

  if (hasPast && hasUpcoming) {
    size = 0.42;
    alpha = 0.95;
  } else if (hasPast) {
    size = 0.5;
    alpha = 1;
  } else {
    size = 0.32;
    alpha = 0.6;
  }

  if (isSelected) {
    size *= 1.25;
    alpha = 1;
  }

  return { size: size * mult, color: hexToRgba(chromeColor, alpha) };
}

export default function WorldGlobe({ flights, atmosphereColor, chromeColor }: WorldGlobeProps) {
  const { isMobile, isFullExperience, prefersReducedMotion } = usePerformanceTier();
  const lightBg = useMemo(() => isLightBackground(atmosphereColor), [atmosphereColor]);

  const globeRef = useRef<GlobeMethods | null>(null);
  const autoRotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsConfiguredRef = useRef(false);
  const configureAttemptsRef = useRef(0);
  const [dimensions, setDimensions] = useState(() => getDimensions(isMobile));
  const [material, setMaterial] = useState<Material | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointDatum | null>(null);
  const [clusterOptions, setClusterOptions] = useState<PointDatum[] | null>(null);
  const [globeInitialized, setGlobeInitialized] = useState(false);

  useEffect(() => {
    setDimensions(getDimensions(isMobile));
  }, [isMobile]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setDimensions(getDimensions(isMobile)), 150);
    };
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, [isMobile]);

  useEffect(() => {
    let cancelled = false;

    loadGlobeTexture(atmosphereColor, lightBg)
      .then((mat) => {
        if (!cancelled) setMaterial(mat);
      })
      .catch((error) => {
        console.error("Failed to load globe texture:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [atmosphereColor, lightBg]);

  const airportStatus = useMemo(() => {
    const status: Record<string, { past: boolean; upcoming: boolean }> = {};

    flights.forEach((f) => {
      if (isReturnToHome(f)) return;
      const past = isPast(f);
      [f.origin_code, f.destination_code].forEach((code) => {
        if (!status[code]) status[code] = { past: false, upcoming: false };
        if (past) status[code].past = true;
        else status[code].upcoming = true;
      });
    });

    return status;
  }, [flights]);

  const basePoints = useMemo(() => {
    const pts: PointDatum[] = [];

    Object.entries(airportStatus).forEach(([code, { past, upcoming }]) => {
      const ap = AIRPORTS[code];
      if (!ap || ap.lat === undefined || ap.lng === undefined) return;

      const { size, color } = markerStyle(chromeColor, past, upcoming, false, isMobile);
      pts.push({
        lat: ap.lat,
        lng: ap.lng,
        code,
        color,
        size,
        hasPast: past,
        hasUpcoming: upcoming,
      });
    });

    return pts;
  }, [airportStatus, chromeColor, isMobile]);

  const displayPoints = useMemo(() => {
    return basePoints.map((p) => {
      const isSelected = selectedPoint?.code === p.code;
      if (!isSelected) return p;
      const { size, color } = markerStyle(chromeColor, p.hasPast, p.hasUpcoming, true, isMobile);
      return { ...p, size, color };
    });
  }, [basePoints, chromeColor, selectedPoint, isMobile]);

  const selectAirport = useCallback((point: PointDatum | null) => {
    setClusterOptions(null);
    setSelectedPoint(point);
  }, []);

  const toggleAirport = useCallback(
    (point: PointDatum) => {
      setClusterOptions(null);
      setSelectedPoint((prev) => (prev?.code === point.code ? null : point));
    },
    [],
  );

  const handlePointClick = useCallback(
    (point: object) => {
      toggleAirport(point as PointDatum);
    },
    [toggleAirport],
  );

  const handleGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      const nearby = findNearbyAirports(lat, lng, basePoints, CLUSTER_THRESHOLD_KM);

      if (nearby.length === 0) {
        selectAirport(null);
        return;
      }

      if (nearby.length === 1) {
        toggleAirport(nearby[0]);
        return;
      }

      setSelectedPoint(null);
      setClusterOptions(nearby);
    },
    [basePoints, selectAirport, toggleAirport],
  );

  const resumeAutoRotate = useCallback(() => {
    if (!globeRef.current || !isFullExperience || prefersReducedMotion) return;
    const controls = globeRef.current.controls();
    if (controls) controls.autoRotate = true;
  }, [isFullExperience, prefersReducedMotion]);

  const scheduleAutoRotateResume = useCallback(() => {
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
    autoRotateTimerRef.current = setTimeout(resumeAutoRotate, AUTO_ROTATE_RESUME_MS);
  }, [resumeAutoRotate]);

  const enforceGlobeRestrictions = useCallback((controls: NonNullable<ReturnType<GlobeMethods["controls"]>>) => {
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 2 - TILT_LIMIT;
    controls.maxPolarAngle = Math.PI / 2 + TILT_LIMIT;
  }, []);

  const configureGlobeControls = useCallback(
    (globe: GlobeMethods) => {
      const controls = globe.controls();
      if (!controls) return false;

      controls.autoRotate = isFullExperience && !prefersReducedMotion;
      controls.autoRotateSpeed = 0.3;
      enforceGlobeRestrictions(controls);

      if (!controlsConfiguredRef.current) {
        controls.addEventListener("start", () => {
          controls.autoRotate = false;
          if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
        });
        controls.addEventListener("end", scheduleAutoRotateResume);
        controlsConfiguredRef.current = true;
      }

      return !controls.enableZoom;
    },
    [enforceGlobeRestrictions, isFullExperience, prefersReducedMotion, scheduleAutoRotateResume],
  );

  const setInitialPointOfView = useCallback(
    (globe: GlobeMethods) => {
      globe.pointOfView({ lat: 25.2, lng: 55.3, altitude: getGlobeAltitude(isMobile) }, 0);
    },
    [isMobile],
  );

  useEffect(() => {
    if (!globeInitialized || !globeRef.current) return;
    setInitialPointOfView(globeRef.current);
  }, [globeInitialized, isMobile, setInitialPointOfView]);

  const tryConfigureGlobe = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return false;

    if (!configureGlobeControls(globe)) return false;

    if (!globeInitialized) {
      setInitialPointOfView(globe);
      setGlobeInitialized(true);
    }

    return true;
  }, [configureGlobeControls, globeInitialized, setInitialPointOfView]);

  const handleGlobeRef = useCallback(
    (instance: GlobeMethods | null) => {
      globeRef.current = instance;
      if (instance) tryConfigureGlobe();
    },
    [tryConfigureGlobe],
  );

  const handleGlobeReady = useCallback(() => {
    tryConfigureGlobe();
  }, [tryConfigureGlobe]);

  useEffect(() => {
    if (!material) return;

    configureAttemptsRef.current = 0;
    let cancelled = false;

    const retryConfigure = () => {
      if (cancelled) return;
      if (tryConfigureGlobe()) return;

      configureAttemptsRef.current += 1;
      if (configureAttemptsRef.current < 40) {
        window.setTimeout(retryConfigure, 50);
      }
    };

    retryConfigure();

    return () => {
      cancelled = true;
    };
  }, [material, tryConfigureGlobe]);

  useEffect(() => {
    return () => {
      controlsConfiguredRef.current = false;
      configureAttemptsRef.current = 0;
      setGlobeInitialized(false);
      if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
    };
  }, []);

  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    flights.forEach((f) => {
      if (isPast(f) && !isReturnToHome(f)) {
        counts[f.destination_code] = (counts[f.destination_code] || 0) + 1;
      }
    });
    return counts;
  }, [flights]);

  const arcs = useMemo(() => {
    if (!selectedPoint) return [] as ArcDatum[];

    const routes = flights
      .filter((f) => {
        if (isReturnToHome(f)) return false;
        return f.origin_code === selectedPoint.code || f.destination_code === selectedPoint.code;
      })
      .slice(0, MAX_VISIBLE_ROUTES)
      .map((f) => {
        const origin = AIRPORTS[f.origin_code];
        const dest = AIRPORTS[f.destination_code];
        if (!origin || !dest) return null;
        const past = isPast(f);
        return {
          startLat: origin.lat,
          startLng: origin.lng,
          endLat: dest.lat,
          endLng: dest.lng,
          color: past ? hexToRgba(chromeColor, 0.45) : hexToRgba(chromeColor, 0.3),
          isPast: past,
        };
      })
      .filter(Boolean) as ArcDatum[];

    return routes;
  }, [flights, selectedPoint, chromeColor]);

  const uniqueAirportCount = useMemo(() => basePoints.length, [basePoints]);

  const countableFlights = useMemo(
    () => flights.filter((f) => !isReturnToHome(f)),
    [flights],
  );
  const pastCount = useMemo(
    () => countableFlights.filter((f) => isPast(f)).length,
    [countableFlights],
  );
  const upcomingCount = countableFlights.length - pastCount;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-6 left-0 right-0 z-20 flex flex-col items-center gap-3 pointer-events-none">
        <div
          className={cn("flex items-center gap-4 px-5 py-2 border", NAV_PILL_CLASS)}
          aria-label={`${uniqueAirportCount} airports, ${pastCount} past flights, ${upcomingCount} upcoming flights`}
        >
          <StatPill value={uniqueAirportCount} label="Airports" />
          <div className="w-[1px] h-3 bg-white/10" />
          <StatPill value={pastCount} label="Past" />
          {upcomingCount > 0 && (
            <>
              <div className="w-[1px] h-3 bg-white/10" />
              <StatPill value={upcomingCount} label="Upcoming" dim />
            </>
          )}
        </div>

        {clusterOptions && clusterOptions.length > 1 && (
          <div
            className={cn(
              "pointer-events-auto flex flex-wrap items-center justify-center gap-2 px-3 py-2 border max-w-[90vw]",
              NAV_PILL_CLASS,
            )}
            role="listbox"
            aria-label="Select airport"
          >
            {clusterOptions.map((p) => (
              <button
                key={p.code}
                type="button"
                role="option"
                onClick={() => selectAirport(p)}
                className="px-3 py-1.5 rounded-full text-xs font-black tracking-wider border border-white/20 text-white transition-colors hover:bg-white/10"
              >
                {p.code}
              </button>
            ))}
          </div>
        )}
      </div>

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: material ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {material && (
          <Globe
            ref={handleGlobeRef}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={material}
            showGraticules={isFullExperience}
            showAtmosphere={false}
            onGlobeReady={handleGlobeReady}
            onGlobeClick={handleGlobeClick}
            onPointClick={handlePointClick}
            arcsData={arcs}
            arcStartLat={(d: object) => (d as ArcDatum).startLat}
            arcStartLng={(d: object) => (d as ArcDatum).startLng}
            arcEndLat={(d: object) => (d as ArcDatum).endLat}
            arcEndLng={(d: object) => (d as ArcDatum).endLng}
            arcColor={(d: object) => (d as ArcDatum).color}
            arcStroke={(d: object) => ((d as ArcDatum).isPast ? 0.6 : 0.5)}
            arcAltitude={0.015}
            arcDashLength={(d: object) => ((d as ArcDatum).isPast ? 0 : 0.4)}
            arcDashGap={(d: object) => ((d as ArcDatum).isPast ? 0 : 0.25)}
            arcDashAnimateTime={0}
            pointsData={displayPoints}
            pointColor={(d: object) => (d as PointDatum).color}
            pointRadius={(d: object) => (d as PointDatum).size}
            pointAltitude={0.015}
            htmlElementsData={selectedPoint ? [selectedPoint] : []}
            htmlElement={(d: object) => {
              const point = d as PointDatum;
              const info = AIRPORTS[point.code];
              const visits = visitCounts[point.code] || 0;
              const el = document.createElement("div");
              el.innerHTML = `
              <div class="flex flex-col items-center" style="transform: translate(-50%, -100%); margin-top: -10px; pointer-events: none;">
                <div style="background: rgba(10,10,10,0.95); border: 1px solid rgba(255,255,255,0.2); padding: 12px 16px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); min-width: 140px;">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                      <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.05em; color: white; line-height: 1;">${point.code}</span>
                      <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); text-transform: uppercase;">${info?.countryIso || ""}</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.9); text-transform: uppercase; margin-top: 4px;">${info?.city || ""}</div>
                    <div style="width: 100%; height: 1px; background: rgba(255,255,255,0.1); margin: 6px 0;"></div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <span style="font-size: 8px; font-weight: 700; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); text-transform: uppercase;">Visits</span>
                      <span style="font-size: 14px; font-weight: 900; color: white;">${visits}</span>
                    </div>
                  </div>
                </div>
                <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid rgba(255,255,255,0.2); margin-top: -1px;"></div>
              </div>
            `;
              return el;
            }}
          />
        )}
      </motion.div>
    </div>
  );
}

function StatPill({
  value,
  label,
  dim = false,
}: {
  value: number;
  label: string;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("text-xs font-bold", dim ? "text-white/50" : "text-white")}>{value}</span>
      <span className="text-[9px] font-bold tracking-widest uppercase text-white/40">{label}</span>
    </div>
  );
}
