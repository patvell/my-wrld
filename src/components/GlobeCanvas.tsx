"use client";

import { forwardRef, useCallback, useEffect, useState, type MutableRefObject, type Ref } from "react";
import type { ComponentProps } from "react";
import type GlobeType from "react-globe.gl";
import type { GlobeMethods } from "react-globe.gl";
import { preloadGlobeModule } from "@/lib/preloadGlobe";

type GlobeProps = ComponentProps<typeof GlobeType>;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as MutableRefObject<T | null>).current = value;
  }
}

const GlobeCanvas = forwardRef<GlobeMethods, GlobeProps>(function GlobeCanvas(props, ref) {
  const [Globe, setGlobe] = useState<typeof GlobeType | null>(null);

  useEffect(() => {
    let cancelled = false;

    preloadGlobeModule().then((mod) => {
      if (!cancelled) setGlobe(() => mod.default);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRef = useCallback(
    (instance: GlobeMethods | null) => {
      assignRef(ref, instance);
    },
    [ref],
  );

  if (!Globe) return null;

  return (
    <Globe
      {...props}
      ref={handleRef as unknown as MutableRefObject<GlobeMethods | undefined>}
    />
  );
});

export default GlobeCanvas;
