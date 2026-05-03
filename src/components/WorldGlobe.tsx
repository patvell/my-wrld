"use client";

import React, { useEffect, useRef, useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Flight } from "@/types";
import { AIRPORTS } from "@/data/airports";

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

export default function WorldGlobe({ flights, primaryColor }: WorldGlobeProps) {
  const globeRef = useRef<any>(null);
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
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const brightness = (r + g + b) / 3;
        const isWater = b > r && b > g && brightness < 60;
        if (isWater) {
          data[i+3] = 40;
        } else {
          data[i] = 230; data[i+1] = 230; data[i+2] = 230;
          data[i+3] = 240; 
        }
      }
      ctx.putImageData(imageData, 0, 0);
      import("three").then((THREE) => {
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.MeshPhongMaterial({
          map: tex, transparent: true, opacity: 0.85,
          specular: new THREE.Color(0xffffff), shininess: 100, side: THREE.DoubleSide
        });
        setCustomMaterial(mat);
      });
    };
  }, []);

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = false;
      controls.enablePan = false;
    }
    const isMobile = window.innerWidth < 768;
    globeRef.current.pointOfView({ lat: 25.2, lng: 55.3, altitude: isMobile ? 4.0 : 3.2 }, 0);
  }, []);

  const visitCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    flights.forEach(f => {
      if (isFlightPast(f)) {
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
        isPast: past
      };
    }).filter(Boolean) as ArcDatum[];
  }, [flights]);

  const points = useMemo(() => {
    const seen = new Set<string>();
    const pts: PointDatum[] = [];
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    
    flights.forEach((f) => {
      const past = isFlightPast(f);
      [f.origin_code, f.destination_code].forEach((code) => {
        if (!seen.has(code)) {
          seen.add(code);
          const ap = AIRPORTS[code];
          if (ap) {
            // Significant increase in point size for touch friendliness
            // Especially for mobile, we make the "hit area" (visual size) much larger
            let size = past ? 0.45 : 0.25;
            if (isMobile) size *= 2.5; // Make them 2.5x larger on mobile
            else size *= 1.5;           // 1.5x larger on desktop for better clickability

            pts.push({ 
              lat: ap.lat, lng: ap.lng, code, 
              color: past ? "rgba(255, 255, 255, 1)" : "rgba(255, 255, 255, 0.6)", 
              size 
            });
          }
        }
      });
    });
    return pts;
  }, [flights]);

  const uniqueAirportCount = useMemo(() => {
    const s = new Set<string>();
    flights.forEach((f) => { s.add(f.origin_code); s.add(f.destination_code); });
    return s.size;
  }, [flights]);
  const pastCount = useMemo(() => flights.filter(isFlightPast).length, [flights]);
  const upcomingCount = flights.length - pastCount;

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
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={customMaterial ? undefined : "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"}
          globeMaterial={customMaterial}
          showGraticules={true}
          showAtmosphere={true}
          atmosphereColor={primaryColor}
          atmosphereAltitude={0.25}
          onGlobeReady={handleGlobeReady}
          onPointClick={(p: any) => setSelectedPoint(selectedPoint?.code === p.code ? null : p)}
          onGlobeClick={() => setSelectedPoint(null)}
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
            const el = document.createElement('div');
            el.innerHTML = `
              <div class="flex flex-col items-center" style="transform: translate(-50%, -100%); margin-top: -10px; pointer-events: none;">
                <div style="background: rgba(10,10,10,0.95); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(20px); padding: 12px 16px; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); min-width: 140px;">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                      <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.05em; color: white; line-height: 1;">${d.code}</span>
                      <span style="font-size: 10px; font-weight: 700; letter-spacing: 0.2em; color: rgba(255,255,255,0.4); text-transform: uppercase;">${info?.countryIso || ''}</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.9); text-transform: uppercase; margin-top: 4px;">${info?.city || ''}</div>
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
      <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: color }}>{label}</span>
    </div>
  );
}
