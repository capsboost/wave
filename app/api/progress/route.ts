import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { watchHistory } from "@/db/schema";
import { headers } from "next/headers";
import { eq, desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await db
      .select()
      .from(watchHistory)
      .where(eq(watchHistory.userId, session.user.id))
      .orderBy(desc(watchHistory.updatedAt));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { animeId, episodeNumber, progressSeconds, durationSeconds, title, imageUrl, language } = body;

    if (!animeId || episodeNumber == null) {
      return NextResponse.json({ error: "Missing animeId or episodeNumber" }, { status: 400 });
    }

    await db
      .insert(watchHistory)
      .values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        animeId: String(animeId),
        episodeNumber: Number(episodeNumber),
        progressSeconds: Number(progressSeconds) || 0,
        durationSeconds: Number(durationSeconds) || 0,
        title: title || null,
        imageUrl: imageUrl || null,
        language: language || "sub",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [watchHistory.userId, watchHistory.animeId],
        set: {
          episodeNumber: sql`excluded.episode_number`,
          progressSeconds: sql`excluded.progress_seconds`,
          durationSeconds: sql`excluded.duration_seconds`,
          title: sql`excluded.title`,
          imageUrl: sql`excluded.image_url`,
          language: sql`excluded.language`,
          updatedAt: sql`excluded.updated_at`,
        },
        setWhere: sql`
          excluded.episode_number > ${watchHistory.episodeNumber}
          OR (
            excluded.episode_number = ${watchHistory.episodeNumber}
            AND excluded.progress_seconds >= ${watchHistory.progressSeconds}
          )
        `,
      });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Progress upsert error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db
      .delete(watchHistory)
      .where(eq(watchHistory.userId, session.user.id));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Progress clear all error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
