"use client";

import { useEffect } from "react";
import type { AniListAnime } from "@/lib/api/anilist";

function setMetaContent(selector: string, content: string, attribute: "name" | "property") {
  let element = document.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, selector.match(/"([^"]+)"/)?.[1] || "");
    document.head.appendChild(element);
  }
  element.content = content;
}

export function useAnimePageMetadata(anime?: AniListAnime, episode?: string) {
  useEffect(() => {
    if (!anime) return;

    const title = anime.title.english || anime.title.romaji || "Anime";
    const year = anime.seasonYear ? ` (${anime.seasonYear})` : "";
    const cleanDescription = (anime.description || "")
      .replace(/<[^>]*>/g, "")
      .replace(/(\(|<i>)?Source:.*$/i, "")
      .trim()
      .slice(0, 160);
    const pageTitle = episode
      ? `Watch ${title} Episode ${episode} | Wave Anime`
      : `Watch ${title}${year} English Sub/Dub Online Free | Wave Anime`;
    const description = episode
      ? `Stream ${title}${year} Episode ${episode} online in HD with English subtitles and dubbing on Wave Anime.`
      : cleanDescription || `Watch ${title} with English subtitles and dubbing on Wave Anime.`;
    const cover = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large || "";

    document.title = pageTitle;
    setMetaContent('meta[name="description"]', description, "name");
    setMetaContent('meta[property="og:title"]', pageTitle, "property");
    setMetaContent('meta[property="og:description"]', description, "property");
    setMetaContent('meta[property="og:image"]', cover, "property");
    setMetaContent('meta[name="twitter:title"]', pageTitle, "name");
    setMetaContent('meta[name="twitter:description"]', description, "name");
    setMetaContent('meta[name="twitter:image"]', cover, "name");
  }, [anime, episode]);
}
