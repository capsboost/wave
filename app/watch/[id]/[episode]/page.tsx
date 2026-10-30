import type { Metadata } from "next";
import { Suspense } from "react";
import WatchClient from "./WatchClient";

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
    <Suspense fallback={<div className="min-h-screen bg-void-black flex items-center justify-center text-neon-crimson font-mono text-sm tracking-widest uppercase">INITIALIZING FEED...</div>}>
      <WatchClient id={id} episode={episode} />
    </Suspense>
  );
}
