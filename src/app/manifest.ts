import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "APMA CRM",
    short_name: "APMA CRM",
    description: "Agentliyin satış, iş və komanda idarəetməsi",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    lang: "az",
    icons: [
      { src: "/brand/apma-icon-light-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/apma-icon-light-512.png", sizes: "512x512", type: "image/png", purpose: "any" },

    ],
  };
}
