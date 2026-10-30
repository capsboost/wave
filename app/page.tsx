import { unstable_cache } from "next/cache";
import { anilistApi, type AniListAnime } from "@/lib/api/anilist";
import HomeClient from "./HomeClient";

const getCachedHeroAnime = unstable_cache(
  async (): Promise<AniListAnime[]> => {
    try {
      return await anilistApi.getTrending(10, 1);
    } catch (error) {
      console.warn("[Home hero] Failed to load server-side hero data:", error);
      return [];
    }
  },
  ["home-hero-anime"],
  { revalidate: 60 * 60 }
);

export default async function Page() {
  const heroAnime = await getCachedHeroAnime();
  return <HomeClient initialHeroAnime={heroAnime} />;
}
