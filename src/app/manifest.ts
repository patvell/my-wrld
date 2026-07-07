import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "my wrld",
    short_name: "my wrld",
    description: "A shared flight diary for two — journeys, time zones, and a world of past trips.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F8F6F3",
    theme_color: "#F8F6F3",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
