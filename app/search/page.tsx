import type { Metadata } from "next";
import { Suspense } from "react";
import SearchClient from "./SearchClient";
import { RouteLoading } from "@/components/ui/RouteLoading";

export const metadata: Metadata = {
  title: "Browse Anime Catalog & Directory - Filter by Genre, Year & Rating",
  description:
    "Explore thousands of anime series and movies. Filter by genre, release year, format, rating, and status on Wave Anime. Fast search alternative to Aniwave and HiAnime.",
  keywords: [
    "browse anime",
    "anime catalog",
    "anime genres",
    "action anime",
    "romance anime",
    "top rated anime",
    "anime search engine",
    "aniwave search",
  ],
  openGraph: {
    title: "Browse Anime Catalog & Directory | Wave Anime",
    description:
      "Explore thousands of anime series and movies with instant genre filters and cyber HUD.",
  },
};

export default function Page() {
  return (
    <Suspense 
      fallback={
        <RouteLoading message="Loading catalog..." />
      }
    >
      <SearchClient />
    </Suspense>
  );
}
