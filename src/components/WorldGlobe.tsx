"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Material } from "three";
import type { GlobeMethods } from "react-globe.gl";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";
import { isPast } from "@/lib/time";
import { loadGlobeTexture } from "@/lib/createGlobeTexture";
import Globe from "@/components/GlobeCanvas";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { findNearbyAirports, computeArrivalVisitCounts, isOnVisibleHemisphere, computeWorldTravelStats } from "@/lib/globeUtils";
import { hexToRgba, isLightBackground } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const HOME_BASE = "DXB";
const TILT_LIMIT = (35 * Math.PI) / 180;
const AUTO_ROTATE_RESUME_MS = 3000;
const DESKTOP_GLOBE_ALTITUDE = 3.2;
const MOBILE_GLOBE_ALTITUDE = 6.7;
const MAX_VISIBLE_ROUTES = 20;
const CLUSTER_THRESHOLD_KM = 350;
const POINT_ALTITUDE = 0.02;
const ARC_ALTITUDE_AUTO_SCALE = 0.28;
const DEFAULT_CAMERA_POV = { lat: 25.2, lng: 55.3 };

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
  emphasis: "default" | "connected" | "selected",
  isMobile: boolean,
) {
  const mult = isMobile ? 2.5 : 1.5;
  let size: number;
  let alpha: number;

  if (hasPast && hasUpcoming) {
    size = 0.462;
    alpha = 0.95;
  } else if (hasPast) {
    size = 0.55;
    alpha = 1;
  } else {
    size = 0.352;
    alpha = 0.6;
  }

  if (emphasis === "connected") {
    size *= 1.12;
    alpha = Math.min(1, alpha + 0.2);
  } else if (emphasis === "selected") {
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
  const [cameraPov, setCameraPov] = useState(DEFAULT_CAMERA_POV);
  const [statsOpen, setStatsOpen] = useState(false);

  const syncCameraPov = useCallback(() => {
    const pov = globeRef.current?.pointOfView();
    if (pov && typeof pov.lat === "number" && typeof pov.lng === "number") {
      setCameraPov({ lat: pov.lat, lng: pov.lng });
    }
  }, []);

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

  const connectedCodes = useMemo(() => {
    if (!selectedPoint) return new Set<string>();

    const codes = new Set<string>([selectedPoint.code]);
    flights.forEach((f) => {
      if (f.origin_code === selectedPoint.code || f.destination_code === selectedPoint.code) {
        codes.add(f.origin_code);
        codes.add(f.destination_code);
      }
    });
    return codes;
  }, [flights, selectedPoint]);

  const basePoints = useMemo(() => {
    const pts: PointDatum[] = [];

    Object.entries(airportStatus).forEach(([code, { past, upcoming }]) => {
      const ap = AIRPORTS[code];
      if (!ap || ap.lat === undefined || ap.lng === undefined) return;

      const { size, color } = markerStyle(chromeColor, past, upcoming, "default", isMobile);
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
      const emphasis: "default" | "connected" | "selected" = !selectedPoint
        ? "default"
        : p.code === selectedPoint.code
          ? "selected"
          : connectedCodes.has(p.code)
            ? "connected"
            : "default";

      if (emphasis === "default") return p;

      const { size, color } = markerStyle(
        chromeColor,
        p.hasPast,
        p.hasUpcoming,
        emphasis,
        isMobile,
      );
      return { ...p, size, color };
    });
  }, [basePoints, chromeColor, connectedCodes, selectedPoint, isMobile]);

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
        controls.addEventListener("change", syncCameraPov);
        controlsConfiguredRef.current = true;
      }

      return !controls.enableZoom;
    },
    [enforceGlobeRestrictions, isFullExperience, prefersReducedMotion, scheduleAutoRotateResume, syncCameraPov],
  );

  const setInitialPointOfView = useCallback(
    (globe: GlobeMethods) => {
      globe.pointOfView({ lat: DEFAULT_CAMERA_POV.lat, lng: DEFAULT_CAMERA_POV.lng, altitude: getGlobeAltitude(isMobile) }, 0);
      const pov = globe.pointOfView();
      if (pov && typeof pov.lat === "number" && typeof pov.lng === "number") {
        setCameraPov({ lat: pov.lat, lng: pov.lng });
      }
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

  const visitCounts = useMemo(
    () => computeArrivalVisitCounts(flights, (f) => isPast(f)),
    [flights],
  );

  const { arcs } = useMemo(() => {
    if (!selectedPoint) return { arcs: [] as ArcDatum[] };

    const hubCode = selectedPoint.code;
    const matchingFlights = flights
      .filter(
        (f) => f.origin_code === hubCode || f.destination_code === hubCode,
      )
      .sort((a, b) => b.departure_time.localeCompare(a.departure_time))
      .slice(0, MAX_VISIBLE_ROUTES);

    const routeArcs: ArcDatum[] = [];

    matchingFlights.forEach((f) => {
      const origin = AIRPORTS[f.origin_code];
      const dest = AIRPORTS[f.destination_code];
      if (!origin || !dest) return;

      if (origin.lat === undefined || origin.lng === undefined || dest.lat === undefined || dest.lng === undefined) {
        return;
      }

      const past = isPast(f);
      routeArcs.push({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: dest.lat,
        endLng: dest.lng,
        color: past ? hexToRgba(chromeColor, 0.45) : hexToRgba(chromeColor, 0.3),
        isPast: past,
      });
    });

    return { arcs: routeArcs };
  }, [flights, selectedPoint, chromeColor]);

  const visibleDisplayPoints = useMemo(
    () =>
      displayPoints.filter((p) =>
        isOnVisibleHemisphere(p.lat, p.lng, cameraPov.lat, cameraPov.lng),
      ),
    [displayPoints, cameraPov],
  );

  const worldStats = useMemo(
    () =>
      computeWorldTravelStats(flights, (f) => isPast(f), {
        excludeReturnHome: isReturnToHome,
      }),
    [flights],
  );

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-6 left-0 right-0 z-20 flex flex-col items-center gap-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setStatsOpen(true)}
          className={cn(
            "pointer-events-auto flex flex-col items-center gap-1.5 px-6 py-3 border transition-transform active:scale-[0.98]",
            NAV_PILL_CLASS,
          )}
          aria-label="Open Your World stats"
        >
          <span className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/45">
            Your World
          </span>
          <div className="flex items-stretch gap-3">
            <StatPill value={worldStats.cities} label="Cities" />
            <div className="w-[1px] self-stretch bg-white/10" />
            <StatPill value={worldStats.kmFlownLabel} label="KM Flown" />
            <div className="w-[1px] self-stretch bg-white/10" />
            <StatPill value={worldStats.pastCount} label="Past" />
            {worldStats.upcomingCount > 0 && (
              <>
                <div className="w-[1px] self-stretch bg-white/10" />
                <StatPill value={worldStats.upcomingCount} label="Upcoming" dim />
              </>
            )}
          </div>
          <span className="text-[8px] font-bold tracking-widest uppercase text-white/25">
            Tap for details
          </span>
        </button>

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

      <AnimatePresence>
        {statsOpen && (
          <motion.div
            key="world-stats-sheet"
            className="absolute inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close stats"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setStatsOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="world-stats-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#0c0c0c] px-5 pb-10 pt-4 shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
              <div className="mb-5 flex items-center justify-between">
                <h2
                  id="world-stats-title"
                  className="text-sm font-black tracking-[0.2em] uppercase text-white"
                >
                  Your World
                </h2>
                <button
                  type="button"
                  onClick={() => setStatsOpen(false)}
                  className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatsSheetCard label="Cities" value={String(worldStats.cities)} />
                <StatsSheetCard label="KM Flown" value={worldStats.kmFlownLabel} />
                <StatsSheetCard label="Hours" value={worldStats.hoursFlownLabel} />
                <StatsSheetCard label="Past Flights" value={String(worldStats.pastCount)} />
                <StatsSheetCard
                  label="Longest Flight"
                  value={worldStats.longestFlight?.kmLabel ?? "—"}
                  hint={worldStats.longestFlight?.label}
                />
                <StatsSheetCard
                  label="Most Visited"
                  value={
                    worldStats.mostVisited
                      ? `${worldStats.mostVisited.visits}×`
                      : "—"
                  }
                  hint={
                    worldStats.mostVisited
                      ? `${worldStats.mostVisited.city} (${worldStats.mostVisited.code})`
                      : undefined
                  }
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            arcStroke={(d: object) => ((d as ArcDatum).isPast ? 0.7 : 0.55)}
            arcAltitudeAutoScale={ARC_ALTITUDE_AUTO_SCALE}
            arcDashLength={(d: object) => ((d as ArcDatum).isPast ? 0 : 0.4)}
            arcDashGap={(d: object) => ((d as ArcDatum).isPast ? 0 : 0.25)}
            arcDashAnimateTime={0}
            pointsTransitionDuration={0}
            pointsData={visibleDisplayPoints}
            pointColor={(d: object) => (d as PointDatum).color}
            pointRadius={(d: object) => (d as PointDatum).size}
            pointAltitude={POINT_ALTITUDE}
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
  value: number | string;
  label: string;
  dim?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[3.25rem]">
      <span className={cn("text-sm font-black tracking-tight leading-none", dim ? "text-white/50" : "text-white")}>
        {value}
      </span>
      <span className="text-[8px] font-bold tracking-widest uppercase text-white/40">{label}</span>
    </div>
  );
}

function StatsSheetCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-[9px] font-bold tracking-widest uppercase text-white/40">{label}</div>
      <div className="mt-1.5 text-2xl font-black tracking-tight text-white">{value}</div>
      {hint ? (
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/45">{hint}</div>
      ) : null}
    </div>
  );
}
