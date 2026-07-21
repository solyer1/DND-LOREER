import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: "No valid IDs provided" }, { status: 400 });
    }

    // Perform bulk delete
    const result = await prisma.loreEntry.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error: any) {
    console.error("Error bulk deleting lore:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
