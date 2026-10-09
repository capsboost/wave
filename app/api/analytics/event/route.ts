import { NextResponse } from "next/server";
import { db } from "@/db";
import { pageViews } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const headersList = await headers();
    
    // Get IP address (handling proxies)
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    
    // Get User Agent
    const userAgent = headersList.get("user-agent") || "unknown";

    // Create a unique hash for this visitor (IP + UserAgent)
    // We use crypto.subtle to create a SHA-256 hash
    const textData = new TextEncoder().encode(`${ip}-${userAgent}`);
    const hashBuffer = await crypto.subtle.digest("SHA-256", textData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const visitorHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Check for user session (only if an auth session cookie exists, avoiding unnecessary DB queries for guests)
    const cookieHeader = headersList.get("cookie") || "";
    const hasAuthCookie = cookieHeader.includes("better-auth.session_token") || cookieHeader.includes("__Secure-better-auth.session_token");
    const session = hasAuthCookie
      ? await auth.api.getSession({ headers: headersList }).catch(() => null)
      : null;

    // Insert the page view event
    await db.insert(pageViews).values({
      id: crypto.randomUUID(),
      path: String(body.path),
      visitorHash,
      animeId: body.animeId ? String(body.animeId) : null,
      userId: session?.user?.id || null,
      createdAt: new Date(),
    });

    return new NextResponse(null, { status: 204 }); // 204 No Content
  } catch (error) {
    console.error("Failed to log analytics event:", error);
    // Return 204 anyway so we don't block or error on the client for analytics failures
    return new NextResponse(null, { status: 204 }); 
  }
}
