import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { comments, user } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { notifications } from "@/db/schema";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const animeId = url.searchParams.get("animeId");
  const episodeNumber = url.searchParams.get("episodeNumber");

  if (!animeId || !episodeNumber) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

  try {
    const fetchedComments = await db
      .select({
        id: comments.id,
        content: comments.content,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
        user: {
          id: user.id,
          name: user.name,
          image: user.image,
        }
      })
      .from(comments)
      .innerJoin(user, eq(comments.userId, user.id))
      .where(and(eq(comments.animeId, animeId), eq(comments.episodeNumber, Number(episodeNumber))))
      .orderBy(desc(comments.createdAt));

    return NextResponse.json(
      { comments: fetchedComments },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { animeId, episodeNumber, content, parentId } = await req.json();

    if (!animeId || !episodeNumber || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const trimmedContent = String(content).trim();
    if (trimmedContent.length === 0 || trimmedContent.length > 500) {
      return NextResponse.json({ error: "Comment must be between 1 and 500 characters" }, { status: 400 });
    }

    const newComment = await db.insert(comments).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      animeId: String(animeId),
      episodeNumber: Number(episodeNumber),
      content: String(content),
      parentId: parentId ? String(parentId) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Trigger notification if this is a reply
    if (parentId) {
      const parentComment = await db.select().from(comments).where(eq(comments.id, String(parentId))).limit(1);
      
      if (parentComment.length > 0 && parentComment[0].userId !== session.user.id) {
        const truncatedContent = String(content).length > 50 ? String(content).substring(0, 47) + "..." : String(content);
        
        await db.insert(notifications).values({
          id: crypto.randomUUID(),
          userId: parentComment[0].userId,
          type: "comment_reply",
          title: "New reply to your comment",
          message: `${session.user.name} replied: "${truncatedContent}"`,
          linkUrl: `/watch/${animeId}/${episodeNumber}`,
          linkLabel: "View conversation",
          actorName: session.user.name,
          createdAt: new Date(),
        });
      }
    }

    return NextResponse.json({ comment: newComment[0] });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
