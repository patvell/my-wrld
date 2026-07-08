"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { Material } from "three";
import type { GlobeMethods } from "react-globe.gl";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";
import { isPast } from "@/lib/time";
import { loadGlobeTexture } from "@/lib/createGlobeTexture";
import Globe from "@/components/GlobeCanvas";
import { usePerformanceTier } from "@/hooks/usePerformanceTier";
import { findNearbyAirports, computeArrivalVisitCounts, isOnVisibleHemisphere } from "@/lib/globeUtils";
import { hexToRgba, isLightBackground } from "@/lib/colors";
import { HOME_HUB_CODE } from "@/lib/config";
import { computeTravelStats, formatDistanceKm } from "@/lib/stats";
import WorldStatsSheet, { type DestinationEntry } from "@/components/WorldStatsSheet";
import { cn } from "@/lib/utils";

const HOME_BASE = HOME_HUB_CODE;
const TILT_LIMIT = (35 * Math.PI) / 180;
const AUTO_ROTATE_RESUME_MS = 3000;
const DESKTOP_GLOBE_ALTITUDE = 3.2;
const MOBILE_GLOBE_ALTITUDE = 6.7;
const CLUSTER_THRESHOLD_KM = 350;
const POV_SYNC_INTERVAL_MS = 150;
const POV_SYNC_EPSILON_DEG = 0.5;
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
}

interface PointDatum {
  lat: number;
  lng: number;
  code: string;
  color: string;
  size: number;
}

function isReturnToHome(flight: Flight): boolean {
  return flight.destination_code === HOME_BASE;
}

// Dimensions are CSS pixels: react-globe.gl applies devicePixelRatio itself,
// so scaling here would double-apply DPR and massively overdraw on mobile.
function getDimensions() {
  if (typeof window === "undefined") return { width: 390, height: 844 };
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getGlobeAltitude(isMobile: boolean) {
  return isMobile ? MOBILE_GLOBE_ALTITUDE : DESKTOP_GLOBE_ALTITUDE;
}

function markerStyle(
  chromeColor: string,
  emphasis: "default" | "connected" | "selected",
  isMobile: boolean,
) {
  const mult = isMobile ? 2.5 : 1.5;
  let size = 0.55;

  if (emphasis === "connected") {
    size *= 1.12;
  } else if (emphasis === "selected") {
    size *= 1.25;
  }

  return { size: size * mult, color: hexToRgba(chromeColor, 1) };
}

export default function WorldGlobe({ flights, atmosphereColor, chromeColor }: WorldGlobeProps) {
  const { isMobile, isFullExperience, prefersReducedMotion } = usePerformanceTier();
  const lightBg = useMemo(() => isLightBackground(atmosphereColor), [atmosphereColor]);

  const globeRef = useRef<GlobeMethods | null>(null);
  const autoRotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsConfiguredRef = useRef(false);
  const configureAttemptsRef = useRef(0);
  const lastPovSyncRef = useRef(0);
  const [dimensions, setDimensions] = useState(() => getDimensions());
  const [material, setMaterial] = useState<Material | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointDatum | null>(null);
  const [clusterOptions, setClusterOptions] = useState<PointDatum[] | null>(null);
  const [globeInitialized, setGlobeInitialized] = useState(false);
  const [cameraPov, setCameraPov] = useState(DEFAULT_CAMERA_POV);
  const [statsOpen, setStatsOpen] = useState(false);

  // Controls fire "change" on every animation frame while auto-rotating;
  // throttle + epsilon-gate so hemisphere culling doesn't re-render React
  // (and rebind globe point data) 60 times a second.
  const syncCameraPov = useCallback(() => {
    const nowTs = performance.now();
    if (nowTs - lastPovSyncRef.current < POV_SYNC_INTERVAL_MS) return;
    const pov = globeRef.current?.pointOfView();
    if (pov && typeof pov.lat === "number" && typeof pov.lng === "number") {
      lastPovSyncRef.current = nowTs;
      setCameraPov((prev) =>
        Math.abs(prev.lat - pov.lat) < POV_SYNC_EPSILON_DEG &&
        Math.abs(prev.lng - pov.lng) < POV_SYNC_EPSILON_DEG
          ? prev
          : { lat: pov.lat, lng: pov.lng },
      );
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setDimensions(getDimensions()), 150);
    };
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
    };
  }, []);

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

  // Only completed travel appears on the globe: upcoming trips contribute
  // neither markers nor arcs.
  const pastFlights = useMemo(() => flights.filter((f) => isPast(f)), [flights]);

  const visitedCodes = useMemo(() => {
    const codes = new Set<string>();
    pastFlights.forEach((f) => {
      if (isReturnToHome(f)) return;
      codes.add(f.origin_code);
      codes.add(f.destination_code);
    });
    return codes;
  }, [pastFlights]);

  const connectedCodes = useMemo(() => {
    if (!selectedPoint) return new Set<string>();

    const codes = new Set<string>([selectedPoint.code]);
    pastFlights.forEach((f) => {
      if (f.origin_code === selectedPoint.code || f.destination_code === selectedPoint.code) {
        codes.add(f.origin_code);
        codes.add(f.destination_code);
      }
    });
    return codes;
  }, [pastFlights, selectedPoint]);

  const basePoints = useMemo(() => {
    const pts: PointDatum[] = [];

    visitedCodes.forEach((code) => {
      const ap = AIRPORTS[code];
      if (!ap || ap.lat === undefined || ap.lng === undefined) return;

      const { size, color } = markerStyle(chromeColor, "default", isMobile);
      pts.push({ lat: ap.lat, lng: ap.lng, code, color, size });
    });

    return pts;
  }, [visitedCodes, chromeColor, isMobile]);

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

      const { size, color } = markerStyle(chromeColor, emphasis, isMobile);
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
    () => computeArrivalVisitCounts(flights, isPast),
    [flights],
  );

  const { arcs } = useMemo(() => {
    if (!selectedPoint) return { arcs: [] as ArcDatum[] };

    const hubCode = selectedPoint.code;
    const matchingFlights = pastFlights.filter(
      (f) => f.origin_code === hubCode || f.destination_code === hubCode,
    );

    // One arc per unique route (A→B and B→A share an arc), so every journey
    // flown from a hub is wired without stacking duplicates.
    const seenRoutes = new Set<string>();
    const routeArcs: ArcDatum[] = [];

    matchingFlights.forEach((f) => {
      const routeKey = [f.origin_code, f.destination_code].sort().join("|");
      if (seenRoutes.has(routeKey)) return;
      seenRoutes.add(routeKey);

      const origin = AIRPORTS[f.origin_code];
      const dest = AIRPORTS[f.destination_code];
      if (!origin || !dest) return;

      if (origin.lat === undefined || origin.lng === undefined || dest.lat === undefined || dest.lng === undefined) {
        return;
      }

      routeArcs.push({
        startLat: origin.lat,
        startLng: origin.lng,
        endLat: dest.lat,
        endLng: dest.lng,
        color: hexToRgba(chromeColor, 0.45),
      });
    });

    return { arcs: routeArcs };
  }, [pastFlights, selectedPoint, chromeColor]);

  const visibleDisplayPoints = useMemo(
    () =>
      displayPoints.filter((p) =>
        isOnVisibleHemisphere(p.lat, p.lng, cameraPov.lat, cameraPov.lng),
      ),
    [displayPoints, cameraPov],
  );

  const travelStats = useMemo(() => computeTravelStats(pastFlights), [pastFlights]);

  const destinations = useMemo<DestinationEntry[]>(() => {
    return [...visitedCodes]
      .filter((code) => code !== HOME_BASE)
      .map((code) => ({
        code,
        city: AIRPORTS[code]?.city ?? code,
        country: AIRPORTS[code]?.country ?? "",
        visits: visitCounts[code] || 0,
      }))
      .sort((a, b) => b.visits - a.visits || a.code.localeCompare(b.code));
  }, [visitedCodes, visitCounts]);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-6 left-0 right-0 z-20 flex flex-col items-center gap-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setStatsOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Open travel stats: ${travelStats.countries} countries, ${travelStats.cities} cities, ${travelStats.flights} flights, ${formatDistanceKm(travelStats.distanceKm)} flown`}
          className={cn(
            "pointer-events-auto flex items-center gap-4 px-5 py-2 border transition-colors hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            NAV_PILL_CLASS,
          )}
        >
          <StatPill value={travelStats.countries} label="Countries" />
          <div className="w-[1px] h-3 bg-white/10" />
          <StatPill value={travelStats.cities} label="Cities" />
          <div className="w-[1px] h-3 bg-white/10" />
          <StatPill value={travelStats.flights} label="Flights" />
          <ChevronDown size={13} strokeWidth={3} className="text-white/50 -mr-1" aria-hidden />
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
                aria-selected={selectedPoint?.code === p.code}
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
            arcStroke={0.7}
            arcAltitudeAutoScale={ARC_ALTITUDE_AUTO_SCALE}
            // Selected-hub routes render as solid, static wires.
            arcsTransitionDuration={0}
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

      <WorldStatsSheet
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        stats={travelStats}
        destinations={destinations}
      />
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
    <div className="flex items-center gap-1.5">
      <span className={cn("text-xs font-bold", dim ? "text-white/50" : "text-white")}>{value}</span>
      <span className="text-[10px] font-bold tracking-widest uppercase text-white/55">{label}</span>
    </div>
  );
}
