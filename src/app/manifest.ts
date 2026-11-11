import type { MetadataRoute } from "next";

/** Lets students add HandMeDown to their home screen (needed for push on iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HandMeDown",
    short_name: "HandMeDown",
    description: "Buy, sell and give away things on campus.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCF7F0",
    theme_color: "#483724",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
