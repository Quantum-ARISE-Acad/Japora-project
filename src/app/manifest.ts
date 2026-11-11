import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Japora — Sell on WhatsApp",
    short_name: "Japora",
    description: "Sell on WhatsApp. Get paid. Grow your hustle.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#16a34a",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
