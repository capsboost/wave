import HomeClient from "./HomeClient";
import { anilistApi } from "@/lib/api/anilist";

export const revalidate = 3600;

export default async function Page() {
  const [heroAnimeList, trendingAnime, recentEpisodes, topThisWeek, scheduleAnime] = await Promise.all([
    anilistApi.getTrending(10, 1).catch(() => []),
    anilistApi.getTrending(15, 2).catch(() => []),
    anilistApi.getRecentReleases(20).catch(() => []),
    anilistApi.getTopThisWeek(9).catch(() => []),
    anilistApi.getAiringSchedule(15).catch(() => [])
  ]);

  return (
    <HomeClient 
      heroAnimeList={heroAnimeList}
      trendingAnime={trendingAnime}
      recentEpisodes={recentEpisodes}
      topThisWeek={topThisWeek}
      scheduleAnime={scheduleAnime}
    />
  );
}
