"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";

// Dynamically import Globe as a React component — no SSR
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

interface WorldGlobeProps {
  flights: Flight[];
  primaryColor: string;
}

interface ArcDatum {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
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

export default function WorldGlobe({ flights, primaryColor }: WorldGlobeProps) {
  const globeRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 390, height: 844 });

  // Measure viewport
  useEffect(() => {
    const update = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Configure controls + initial POV after globe mounts
  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;

    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 250;
      controls.maxDistance = 550;
    }

    // Zoom out further on mobile so globe fits comfortably above the legend
    const isMobile = window.innerWidth < 768;
    globeRef.current.pointOfView(
      { lat: 25.2, lng: 55.3, altitude: isMobile ? 4.0 : 3.2 },
      1200
    );
  }, []);

  // Build arc data
  const arcs: ArcDatum[] = useMemo(() => {
    return flights
      .map((flight) => {
        const origin = AIRPORTS[flight.origin_code];
        const dest = AIRPORTS[flight.destination_code];
        if (!origin?.lat || !origin?.lng || !dest?.lat || !dest?.lng) return null;
        const past = isFlightPast(flight);
        return {
          startLat: origin.lat,
          startLng: origin.lng,
          endLat: dest.lat,
          endLng: dest.lng,
          color: past
            ? (["rgba(255,255,255,0.9)", "rgba(255,255,255,0.9)"] as [string, string])
            : (["rgba(255,255,255,0.15)", "rgba(255,255,255,0.15)"] as [string, string]),
          isPast: past,
        };
      })
      .filter(Boolean) as ArcDatum[];
  }, [flights]);

  // Build unique airport points
  const points: PointDatum[] = useMemo(() => {
    const seen = new Set<string>();
    const pts: PointDatum[] = [];
    flights.forEach((flight) => {
      const past = isFlightPast(flight);
      [flight.origin_code, flight.destination_code].forEach((code) => {
        if (!seen.has(code)) {
          seen.add(code);
          const ap = AIRPORTS[code];
          if (ap?.lat !== undefined && ap?.lng !== undefined) {
            pts.push({
              lat: ap.lat,
              lng: ap.lng,
              code: ap.code,
              color: past ? (ap.flagColor || "rgba(255,255,255,0.9)") : "rgba(255,255,255,0.2)",
              size: past ? 0.45 : 0.25,
            });
          }
        }
      });
    });
    return pts;
  }, [flights]);

  // Stats
  const uniqueAirportCount = useMemo(() => {
    const s = new Set<string>();
    flights.forEach((f) => { s.add(f.origin_code); s.add(f.destination_code); });
    return s.size;
  }, [flights]);

  const pastCount = useMemo(() => flights.filter(isFlightPast).length, [flights]);
  const upcomingCount = flights.length - pastCount;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Stat bar */}
      <div className="absolute top-6 left-0 right-0 z-10 flex justify-center pointer-events-none">
        <div
          className="flex items-center gap-4 px-5 py-2 rounded-full"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            backdropFilter: "blur(10px)",
          }}
        >
          <StatPill value={uniqueAirportCount} label="Airports" />
          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
          <StatPill value={pastCount} label="Past" />
          {upcomingCount > 0 && (
            <>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
              <StatPill value={upcomingCount} label="Upcoming" dim />
            </>
          )}
        </div>
      </div>

      {/* Globe */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          showGraticules={false}
          showAtmosphere={true}
          atmosphereColor={primaryColor}
          atmosphereAltitude={0.22}
          onGlobeReady={handleGlobeReady}
          // Arcs
          arcsData={arcs}
          arcStartLat={(d: object) => (d as ArcDatum).startLat}
          arcStartLng={(d: object) => (d as ArcDatum).startLng}
          arcEndLat={(d: object) => (d as ArcDatum).endLat}
          arcEndLng={(d: object) => (d as ArcDatum).endLng}
          arcColor={(d: object) => (d as ArcDatum).color}
          arcStroke={(d: object) => ((d as ArcDatum).isPast ? 1.2 : 0.55)}
          arcAltitude={0.3}
          arcDashLength={(d: object) => ((d as ArcDatum).isPast ? 1 : 0.15)}
          arcDashGap={(d: object) => ((d as ArcDatum).isPast ? 0 : 0.1)}
          arcDashAnimateTime={(d: object) => ((d as ArcDatum).isPast ? 0 : 5000)}
          // Points
          pointsData={points}
          pointColor={(d: object) => (d as PointDatum).color}
          pointRadius={(d: object) => (d as PointDatum).size}
          pointAltitude={0.005}
          pointsMerge={false}
        />
      </div>

      {/* Legend */}
      <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-10 flex items-center gap-5 pointer-events-none">
        <LegendItem label="Past flights" solid />
        <LegendItem label="Upcoming" solid={false} />
      </div>
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
      <span
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: dim ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.95)",
          letterSpacing: "0.04em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.25em",
          textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function LegendItem({ label, solid }: { label: string; solid: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {solid ? (
        <div
          style={{
            height: 2,
            width: 24,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.9)",
          }}
        />
      ) : (
        <div className="flex gap-[3px] items-center">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 2,
                width: 5,
                borderRadius: 9999,
                background: "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      )}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.25em",
          textTransform: "uppercase" as const,
          color: "rgba(255,255,255,0.8)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
