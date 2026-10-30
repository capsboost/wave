import type { Metadata } from "next";
import { Suspense } from "react";
import WatchClient from "./WatchClient";
import { RouteLoading } from "@/components/ui/RouteLoading";

export const metadata: Metadata = {
  title: "Watch Anime Online",
  description: "Watch anime episodes with English subtitles and dubbing on Wave Anime.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; episode: string }>;
}) {
  const { id, episode } = await params;

  return (
    <Suspense fallback={<RouteLoading message="Initializing feed..." />}>
      <WatchClient id={id} episode={episode} />
    </Suspense>
  );
}
