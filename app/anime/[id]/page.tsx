import type { Metadata } from "next";
import AnimeClient from "./AnimeClient";

export const metadata: Metadata = {
  title: "Anime Details",
  description: "Anime details, episodes, and recommendations on Wave Anime.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnimeClient id={id} />;
}
