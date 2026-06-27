"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";
import { loadGlobeTexture } from "@/lib/createGlobeTexture";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const HOME_BASE = "DXB";
const TILT_LIMIT = (35 * Math.PI) / 180;
const AUTO_ROTATE_RESUME_MS = 3000;

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

function isFlightPast(flight: Flight): boolean {
  const arrival = flight.arrival_time.replace(/Z$|[+-]\d{2}:?\d{2}$/, "");
  const arrDate = new Date(arrival + "Z");
  const twoHoursAfter = new Date(arrDate.getTime() + 2 * 60 * 60 * 1000);
  return new Date() >= twoHoursAfter;
}

function isReturnToHome(flight: Flight): boolean {
  return flight.destination_code === HOME_BASE;
}

export default function WorldGlobe({ flights, primaryColor }: WorldGlobeProps) {
  const globeRef = useRef<any>(null);
  const autoRotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dimensions, setDimensions] = useState({ width: 390, height: 844 });
  const [customMaterial, setCustomMaterial] = useState<any>(null);
  const [selectedPoint, setSelectedPoint] = useState<any>(null);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadGlobeTexture(primaryColor)
      .then((material) => {
        if (!cancelled) setCustomMaterial(material);
      })
      .catch((error) => {
        console.error("Failed to load globe texture:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [primaryColor]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const points = useMemo(() => {
    const seen = new Set<string>();
    const pts: PointDatum[] = [];
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    flights.forEach((f) => {
      const past = isFlightPast(f);
      [f.origin_code, f.destination_code].forEach((code) => {
        if (!seen.has(code)) {
          seen.add(code);
          const ap = AIRPORTS[code];
          if (ap && ap.lat !== undefined && ap.lng !== undefined) {
            let size = past ? 0.45 : 0.25;
            if (isMobile) size *= 2.5;
            else size *= 1.5;

            pts.push({
              lat: ap.lat, lng: ap.lng, code,
              color: past ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.6)",
              size,
            });
          }
        }
      });
    });
    return pts;
  }, [flights]);

  const handleGlobeClick = useCallback(({ lat, lng }: { lat: number; lng: number }) => {
    const THRESHOLD = 500;
    let closestPoint = null;
    let minDistance = Infinity;

    points.forEach((p) => {
      const dist = getDistance(lat, lng, p.lat, p.lng);
      if (dist < minDistance && dist < THRESHOLD) {
        minDistance = dist;
        closestPoint = p;
      }
    });

    if (closestPoint) {
      setSelectedPoint(selectedPoint?.code === (closestPoint as PointDatum).code ? null : closestPoint);
    } else {
      setSelectedPoint(null);
    }
  }, [points, selectedPoint]);

  const resumeAutoRotate = useCallback(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) controls.autoRotate = true;
  }, []);

  const scheduleAutoRotateResume = useCallback(() => {
    if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
    autoRotateTimerRef.current = setTimeout(resumeAutoRotate, AUTO_ROTATE_RESUME_MS);
  }, [resumeAutoRotate]);

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.minPolarAngle = Math.PI / 2 - TILT_LIMIT;
      controls.maxPolarAngle = Math.PI / 2 + TILT_LIMIT;

      controls.addEventListener("start", () => {
        controls.autoRotate = false;
        if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
      });
      controls.addEventListener("end", scheduleAutoRotateResume);
    }
    const isMobile = window.innerWidth < 768;
    globeRef.current.pointOfView({ lat: 25.2, lng: 55.3, altitude: isMobile ? 4.0 : 3.2 }, 0);
  }, [scheduleAutoRotateResume]);

  useEffect(() => {
    return () => {
      if (autoRotateTimerRef.current) clearTimeout(autoRotateTimerRef.current);
    };
  }, []);

  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    flights.forEach((f) => {
      if (isFlightPast(f) && !isReturnToHome(f)) {
        counts[f.destination_code] = (counts[f.destination_code] || 0) + 1;
      }
    });
    return counts;
  }, [flights]);

  const arcs = useMemo(() => {
    return flights.map((f) => {
      const origin = AIRPORTS[f.origin_code], dest = AIRPORTS[f.destination_code];
      if (!origin || !dest) return null;
      const past = isFlightPast(f);
      return {
        startLat: origin.lat, startLng: origin.lng, endLat: dest.lat, endLng: dest.lng,
        color: past ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.5)",
        isPast: past,
      };
    }).filter(Boolean) as ArcDatum[];
  }, [flights]);

  const uniqueAirportCount = useMemo(() => {
    const s = new Set<string>();
    flights.forEach((f) => { s.add(f.origin_code); s.add(f.destination_code); });
    return s.size;
  }, [flights]);

  const countableFlights = useMemo(
    () => flights.filter((f) => !isReturnToHome(f)),
    [flights],
  );
  const pastCount = useMemo(
    () => countableFlights.filter(isFlightPast).length,
    [countableFlights],
  );
  const upcomingCount = countableFlights.length - pastCount;

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-6 left-0 right-0 z-20 flex flex-col items-center gap-4 pointer-events-none text-white">
        <div className="flex items-center gap-4 px-5 py-2 rounded-full glass-dark border border-white/10 backdrop-blur-md">
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
          <LegendItem label="Past" color="rgba(255, 255, 255, 1)" />
          <LegendItem label="Upcoming" color="rgba(255, 255, 255, 0.5)" />
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        {customMaterial && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={customMaterial}
          showGraticules={true}
          showAtmosphere={false}
          onGlobeReady={handleGlobeReady}
          onGlobeClick={handleGlobeClick}
          arcsData={arcs}
          arcStartLat={(d: any) => d.startLat}
          arcStartLng={(d: any) => d.startLng}
          arcEndLat={(d: any) => d.endLat}
          arcEndLng={(d: any) => d.endLng}
          arcColor={(d: any) => d.color}
          arcStroke={(d: any) => d.isPast ? 1.4 : 0.8}
          arcDashLength={0}
          arcDashGap={0}
          arcDashAnimateTime={0}
          pointsData={points}
          pointColor={(d: any) => d.color}
          pointRadius={(d: any) => d.size}
          pointAltitude={0.01}
          htmlElementsData={selectedPoint ? [selectedPoint] : []}
          htmlElement={(d: any) => {
            const info = AIRPORTS[d.code];
            const visits = visitCounts[d.code] || 0;
            const el = document.createElement("div");
            el.innerHTML = `
              <div class="flex flex-col items-center" style="transform: translate(-50%, -100%); margin-top: -10px; pointer-events: none;">
                <div style="background: rgba(10,10,10,0.95); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(20px); padding: 12px 16px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); min-width: 140px;">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                      <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.05em; color: white; line-height: 1;">${d.code}</span>
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
      </div>
    </div>
  );
}

function StatPill({ value, label, dim = false }: any) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-bold ${dim ? "text-white/60" : "text-white"}`}>{value}</span>
      <span className="text-[9px] font-bold tracking-widest uppercase text-white/60">{label}</span>
    </div>
  );
}

function LegendItem({ label, color }: any) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ height: 2, width: 20, background: color, borderRadius: 10 }} />
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color }}>{label}</span>
    </div>
  );
}
