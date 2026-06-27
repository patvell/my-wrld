"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { Material } from "three";
import type { GlobeMethods } from "react-globe.gl";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";
import { isPast } from "@/lib/time";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const TEXTURE_URL = "/earth-blue-marble.jpg";

interface WorldGlobeProps {
  flights: Flight[];
  primaryColor: string;
}

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
}

/**
 * Build the processed globe material once and cache it at module scope so that
 * remounting the globe (e.g. switching tabs) never re-runs the expensive
 * per-pixel canvas pass on the main thread.
 */
let cachedMaterial: Promise<Material> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildGlobeMaterial(): Promise<Material> {
  const THREE = await import("three");
  const img = await loadImage(TEXTURE_URL);

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const brightness = (r + g + b) / 3;
    const isWater = b > r && b > g && brightness < 60;
    if (isWater) {
      data[i + 3] = 40;
    } else {
      data[i] = 230;
      data[i + 1] = 230;
      data[i + 2] = 230;
      data[i + 3] = 240;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.MeshPhongMaterial({
    map: tex,
    transparent: true,
    opacity: 0.85,
    specular: new THREE.Color(0xffffff),
    shininess: 100,
    side: THREE.DoubleSide,
  });
}

function getGlobeMaterial(): Promise<Material> {
  if (!cachedMaterial) cachedMaterial = buildGlobeMaterial();
  return cachedMaterial;
}

function getDimensions() {
  if (typeof window === "undefined") return { width: 390, height: 844 };
  return { width: window.innerWidth, height: window.innerHeight };
}

export default function WorldGlobe({ flights, primaryColor }: WorldGlobeProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState(getDimensions);
  const [material, setMaterial] = useState<Material | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<PointDatum | null>(null);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Debounced resize so we don't re-render on every resize event.
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

  // Resolve the cached material; guard against setting state after unmount.
  useEffect(() => {
    let active = true;
    getGlobeMaterial()
      .then((mat) => {
        if (active) setMaterial(mat);
      })
      .catch((err) => console.error("Failed to build globe material:", err));
    return () => {
      active = false;
    };
  }, []);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const points = useMemo(() => {
    const seen = new Set<string>();
    const pts: PointDatum[] = [];
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    flights.forEach((f) => {
      const past = isPast(f);
      [f.origin_code, f.destination_code].forEach((code) => {
        if (!seen.has(code)) {
          seen.add(code);
          const ap = AIRPORTS[code];
          if (ap && ap.lat !== undefined && ap.lng !== undefined) {
            let size = past ? 0.45 : 0.25;
            size *= isMobile ? 2.5 : 1.5;
            pts.push({
              lat: ap.lat,
              lng: ap.lng,
              code,
              color: past ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.6)",
              size,
            });
          }
        }
      });
    });
    return pts;
  }, [flights]);

  const handleGlobeClick = useCallback(
    ({ lat, lng }: { lat: number; lng: number }) => {
      const THRESHOLD = 500;
      let closestPoint: PointDatum | null = null;
      let minDistance = Infinity;

      points.forEach((p) => {
        const dist = getDistance(lat, lng, p.lat, p.lng);
        if (dist < minDistance && dist < THRESHOLD) {
          minDistance = dist;
          closestPoint = p;
        }
      });

      setSelectedPoint((prev) =>
        closestPoint && prev?.code === (closestPoint as PointDatum).code ? null : closestPoint,
      );
    },
    [points],
  );

  const handleGlobeReady = useCallback(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = !prefersReducedMotion;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = false;
      controls.enablePan = false;
    }
    const isMobile = window.innerWidth < 768;
    globe.pointOfView({ lat: 25.2, lng: 55.3, altitude: isMobile ? 4.0 : 3.2 }, 0);
  }, [prefersReducedMotion]);

  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    flights.forEach((f) => {
      if (isPast(f)) {
        counts[f.destination_code] = (counts[f.destination_code] || 0) + 1;
      }
    });
    return counts;
  }, [flights]);

  const arcs = useMemo(() => {
    return flights
      .map((f) => {
        const origin = AIRPORTS[f.origin_code],
          dest = AIRPORTS[f.destination_code];
        if (!origin || !dest) return null;
        const past = isPast(f);
        return {
          startLat: origin.lat,
          startLng: origin.lng,
          endLat: dest.lat,
          endLng: dest.lng,
          color: past ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.5)",
          isPast: past,
        };
      })
      .filter(Boolean) as ArcDatum[];
  }, [flights]);

  const uniqueAirportCount = useMemo(() => {
    const s = new Set<string>();
    flights.forEach((f) => {
      s.add(f.origin_code);
      s.add(f.destination_code);
    });
    return s.size;
  }, [flights]);
  const pastCount = useMemo(() => flights.filter((f) => isPast(f)).length, [flights]);
  const upcomingCount = flights.length - pastCount;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-6 left-0 right-0 z-20 flex flex-col items-center gap-4 pointer-events-none text-white">
        <div
          className="flex items-center gap-4 px-5 py-2 rounded-full glass-dark border border-white/10 backdrop-blur-md"
          aria-label={`${uniqueAirportCount} airports, ${pastCount} past flights, ${upcomingCount} upcoming flights`}
        >
          <StatPill value={uniqueAirportCount} label="Airports" />
          <div className="w-[1px] h-3 bg-white/20" />
          <StatPill value={pastCount} label="Past" />
          {upcomingCount > 0 && (
            <>
              <div className="w-[1px] h-3 bg-white/20" />
              <StatPill value={upcomingCount} label="Upcoming" dim />
            </>
          )}
        </div>
        <div className="flex items-center gap-5 opacity-90">
          <LegendItem label="Past" dashed={false} />
          <LegendItem label="Upcoming" dashed />
        </div>
      </div>

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: material ? 1 : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {material && (
          <Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={material}
            showGraticules={true}
            showAtmosphere={true}
            atmosphereColor={primaryColor}
            atmosphereAltitude={0.25}
            onGlobeReady={handleGlobeReady}
            onGlobeClick={handleGlobeClick}
            arcsData={arcs}
            arcStartLat={(d: object) => (d as ArcDatum).startLat}
            arcStartLng={(d: object) => (d as ArcDatum).startLng}
            arcEndLat={(d: object) => (d as ArcDatum).endLat}
            arcEndLng={(d: object) => (d as ArcDatum).endLng}
            arcColor={(d: object) => (d as ArcDatum).color}
            arcStroke={(d: object) => ((d as ArcDatum).isPast ? 1.4 : 0.8)}
            arcDashLength={0}
            arcDashGap={0}
            arcDashAnimateTime={0}
            pointsData={points}
            pointColor={(d: object) => (d as PointDatum).color}
            pointRadius={(d: object) => (d as PointDatum).size}
            pointAltitude={0.01}
            htmlElementsData={selectedPoint ? [selectedPoint] : []}
            htmlElement={(d: object) => {
              const point = d as PointDatum;
              const info = AIRPORTS[point.code];
              const visits = visitCounts[point.code] || 0;
              const el = document.createElement("div");
              el.innerHTML = `
              <div class="flex flex-col items-center" style="transform: translate(-50%, -100%); margin-top: -10px; pointer-events: none;">
                <div style="background: rgba(10,10,10,0.95); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(20px); padding: 12px 16px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); min-width: 140px;">
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

function StatPill({ value, label, dim = false }: { value: number; label: string; dim?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-bold ${dim ? "text-white/60" : "text-white"}`}>{value}</span>
      <span className="text-[9px] font-bold tracking-widest uppercase text-white/60">{label}</span>
    </div>
  );
}

function LegendItem({ label, dashed }: { label: string; dashed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        style={{
          height: 0,
          width: 20,
          borderTopWidth: 2,
          borderTopStyle: dashed ? "dashed" : "solid",
          borderTopColor: dashed ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,1)",
        }}
      />
      <span
        className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: dashed ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,1)" }}
      >
        {label}
      </span>
    </div>
  );
}
