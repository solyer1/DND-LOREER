import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/lore
// Customizable query API. Supports:
// ?limit=10 & ?skip=0 & ?author=Name & ?channel=ChannelName & ?search=keyword
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const author = searchParams.get("author");
    const channelName = searchParams.get("channel");
    const search = searchParams.get("search");

    // Build the Prisma 'where' clause dynamically
    const whereClause: any = {};
    if (author) whereClause.author = { equals: author };
    if (channelName) whereClause.channelName = { equals: channelName };
    if (search) {
      whereClause.OR = [
        { title: { contains: search } },
        { content: { contains: search } }
      ];
    }

    // Fetch from database
    const lore = await prisma.loreEntry.findMany({
      where: whereClause,
      take: limit,
      skip: skip,
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({
      success: true,
      count: lore.length,
      data: lore,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/lore
// API to manually add custom lore entries directly to the database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, author, channelName } = body;

    if (!title || !content || !author) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: title, content, author" },
        { status: 400 }
      );
    }

    const newLore = await prisma.loreEntry.create({
      data: {
        title,
        content,
        author,
        channelName: channelName || "API Submission",
      },
    });

    return NextResponse.json({ success: true, data: newLore }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
