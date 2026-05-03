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

// Parse a hex or rgb color into an RGB tuple
function parseColor(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return [r, g, b];
  }
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [parseInt(m[1]) / 255, parseInt(m[2]) / 255, parseInt(m[3]) / 255];
  return [0.1, 0.1, 0.15];
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

  // Apply custom Three.js glass material to the globe surface
  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;

    // --- Controls ---
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
      controls.enablePan = false;
      controls.minDistance = 250;
      controls.maxDistance = 550;
    }

    // --- Custom glass globe material ---
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const THREE = require("three");
      const [r, g, b] = parseColor(primaryColor);

      // The globe mesh material: dark glass tinted with primaryColor
      const glassMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(r * 0.25, g * 0.25, b * 0.25),
        emissive: new THREE.Color(r * 0.08, g * 0.08, b * 0.08),
        specular: new THREE.Color(0.6, 0.65, 0.7),
        shininess: 120,
        transparent: true,
        opacity: 0.55,
        side: THREE.FrontSide,
      });

      globeRef.current.globeMaterial(glassMaterial);
    } catch (e) {
      // Fallback: just clear the texture
      globeRef.current.globeImageUrl("");
    }

    // --- POV ---
    const isMobile = window.innerWidth < 768;
    globeRef.current.pointOfView(
      { lat: 25.2, lng: 55.3, altitude: isMobile ? 4.0 : 3.2 },
      1200
    );
  }, [primaryColor]);

  // Re-apply material when primaryColor changes
  useEffect(() => {
    if (!globeRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const THREE = require("three");
      const [r, g, b] = parseColor(primaryColor);
      const glassMaterial = new THREE.MeshPhongMaterial({
        color: new THREE.Color(r * 0.25, g * 0.25, b * 0.25),
        emissive: new THREE.Color(r * 0.08, g * 0.08, b * 0.08),
        specular: new THREE.Color(0.6, 0.65, 0.7),
        shininess: 120,
        transparent: true,
        opacity: 0.55,
        side: THREE.FrontSide,
      });
      globeRef.current.globeMaterial(glassMaterial);
    } catch (_) {}
  }, [primaryColor]);

  // Build arc data
  // Past flights: crisp bright white — high contrast against the dim graticules
  // Upcoming flights: warm amber glow — distinct from both white arcs and grey grid lines
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
          // Past: solid bright white | Upcoming: translucent warm amber
          color: past
            ? (["rgba(255,255,255,1)", "rgba(255,255,255,1)"] as [string, string])
            : (["rgba(255,210,100,0.25)", "rgba(255,210,100,0.25)"] as [string, string]),
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
              color: past ? "rgba(255,255,255,0.9)" : "rgba(255,210,100,0.6)",
              size: past ? 0.4 : 0.22,
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
      {/* Stat bar + Legend */}
      <div className="absolute top-6 left-0 right-0 z-20 flex flex-col items-center gap-4 pointer-events-none">
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

        {/* Legend — white for past, amber for upcoming */}
        <div className="flex items-center gap-5 opacity-80">
          <LegendItem label="Past" color="rgba(255,255,255,0.9)" solid />
          <LegendItem label="Upcoming" color="rgba(255,210,100,0.7)" solid={false} />
        </div>
      </div>

      {/* Globe */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          // No image texture — we use custom Three.js material
          globeImageUrl=""
          // Graticules form the wireframe skeleton visible through the glass
          showGraticules={true}
          showAtmosphere={true}
          atmosphereColor={primaryColor}
          atmosphereAltitude={0.28}
          onGlobeReady={handleGlobeReady}
          // Arcs
          arcsData={arcs}
          arcStartLat={(d: object) => (d as ArcDatum).startLat}
          arcStartLng={(d: object) => (d as ArcDatum).startLng}
          arcEndLat={(d: object) => (d as ArcDatum).endLat}
          arcEndLng={(d: object) => (d as ArcDatum).endLng}
          arcColor={(d: object) => (d as ArcDatum).color}
          arcStroke={(d: object) => ((d as ArcDatum).isPast ? 1.4 : 0.6)}
          arcAltitude={0.3}
          arcDashLength={(d: object) => ((d as ArcDatum).isPast ? 1 : 0.2)}
          arcDashGap={(d: object) => ((d as ArcDatum).isPast ? 0 : 0.12)}
          arcDashAnimateTime={(d: object) => ((d as ArcDatum).isPast ? 0 : 6000)}
          // Points
          pointsData={points}
          pointColor={(d: object) => (d as PointDatum).color}
          pointRadius={(d: object) => (d as PointDatum).size}
          pointAltitude={0.008}
          pointsMerge={false}
        />
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

function LegendItem({ label, solid, color }: { label: string; solid: boolean; color: string }) {
  return (
    <div className="flex items-center gap-2">
      {solid ? (
        <div
          style={{
            height: 2,
            width: 20,
            borderRadius: 9999,
            background: color,
          }}
        />
      ) : (
        <div className="flex gap-[3px] items-center">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 2,
                width: 4,
                borderRadius: 9999,
                background: color,
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
