"use client";

import { forwardRef, useEffect, useState, type MutableRefObject } from "react";
import type { ComponentProps } from "react";
import type GlobeType from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";

type GlobeProps = ComponentProps<typeof GlobeType>;

const GlobeCanvas = forwardRef<GlobeMethods, GlobeProps>(function GlobeCanvas(props, ref) {
  const [Globe, setGlobe] = useState<typeof GlobeType | null>(null);

  useEffect(() => {
    import("react-globe.gl").then((mod) => setGlobe(() => mod.default));
  }, []);

  if (!Globe) return null;

  return <Globe {...props} ref={ref as MutableRefObject<GlobeMethods | undefined>} />;
});

export default GlobeCanvas;
