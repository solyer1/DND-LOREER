import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/lore/[id]/fix-title — Use AI to regenerate the title
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Fetch the entry
    const entry = await prisma.loreEntry.findUnique({ where: { id } });
    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Entry not found" },
        { status: 404 }
      );
    }

    const contentSnippet = entry.content.substring(0, 2000);

    const prompt = `Read the following D&D lore entry and generate a short, accurate 3-7 word title in English.
The title should be specific and descriptive — avoid generic titles like "A Tale" or "The Story".
Good examples: "The Fall of Nethervale Keep", "Zara's Pact with Asmodeus", "Mithral Mines of Khundrukar"

Content:
"""
${contentSnippet}
"""

Reply ONLY with the title string. No quotes, no explanation, no extra text.`;

    const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    let newTitle = "";

    if (aiProvider === "custom") {
      const response = await fetch(
        process.env.CUSTOM_AI_ENDPOINT ||
          "http://localhost:1234/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CUSTOM_AI_KEY || ""}`,
          },
          body: JSON.stringify({
            model: process.env.CUSTOM_AI_MODEL || "local-model",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
            stream: false,
          }),
        }
      );

      if (!response.ok)
        throw new Error(`AI error: ${response.status} ${response.statusText}`);

      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        const dataLines = rawText
          .split("\n")
          .filter(
            (line: string) =>
              line.trim().startsWith("data: ") &&
              line.trim() !== "data: [DONE]"
          );
        if (dataLines.length > 0) {
          data = JSON.parse(dataLines[0].replace("data: ", "").trim());
        } else {
          throw new Error("Failed to parse AI response");
        }
      }
      newTitle =
        data.choices[0]?.message?.content?.trim() ||
        data.choices[0]?.delta?.content?.trim() ||
        "";
    } else {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents: prompt,
      });
      newTitle = response.text || "";
    }

    // Clean up the title
    newTitle = newTitle.trim().replace(/^["']|["']$/g, "");

    if (!newTitle || newTitle.length < 2 || newTitle.length > 150) {
      return NextResponse.json(
        { success: false, error: "AI generated an invalid title" },
        { status: 422 }
      );
    }

    // Update the entry
    const updated = await prisma.loreEntry.update({
      where: { id },
      data: { title: newTitle },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Fix title error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
