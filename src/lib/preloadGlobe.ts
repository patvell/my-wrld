let globeModulePromise: Promise<typeof import("react-globe.gl")> | null = null;

export function preloadGlobeModule() {
  if (!globeModulePromise) {
    globeModulePromise = import("react-globe.gl");
  }
  return globeModulePromise;
}
