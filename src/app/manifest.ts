import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Assistente studio",
    short_name: "Studio",
    description: "Piano di studio settimanale da ClasseViva e calendario di famiglia",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#1f4e79",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
