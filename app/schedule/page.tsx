import type { Metadata } from "next";
import ScheduleClient from "./ScheduleClient";
import { anilistApi } from "@/lib/api/anilist";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Anime Airing Schedule & Simulcast Release Calendar",
  description:
    "Track daily anime broadcast schedules, simulcast countdowns, and upcoming episode air dates in real time on Wave Anime. Free and updated 24/7.",
  keywords: [
    "anime schedule",
    "anime release dates",
    "simulcast schedule",
    "airing anime today",
    "weekly anime calendar",
    "wave anime schedule",
  ],
  openGraph: {
    title: "Anime Airing Schedule & Simulcast Release Calendar | Wave Anime",
    description:
      "Track daily anime broadcast schedules, countdowns, and upcoming episode air dates in real time.",
  },
};

export default async function Page() {
  const scheduleAnime = await anilistApi.getAiringSchedule(50).catch(() => []);

  return (
    <ScheduleClient initialSchedule={scheduleAnime} />
  );
}
