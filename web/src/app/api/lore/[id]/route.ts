import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    await prisma.loreEntry.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting lore:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();
    
    const updatedEntry = await prisma.loreEntry.update({
      where: { id },
      data: {
        title: body.title,
        content: body.content,
        tags: body.tags,
      },
    });
    
    return NextResponse.json({ success: true, data: updatedEntry });
  } catch (error: any) {
    console.error("Error updating lore:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
