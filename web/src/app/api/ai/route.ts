import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: Request) {
  try {
    const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    const prompt = "Reply with 'Hello from the AI!' if you receive this message.";
    
    let responseText = "";

    if (aiProvider === "custom") {
      const response = await fetch(process.env.CUSTOM_AI_ENDPOINT || "http://localhost:1234/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.CUSTOM_AI_KEY || ""}`
        },
        body: JSON.stringify({
          model: process.env.CUSTOM_AI_MODEL || "local-model",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          stream: false
        })
      });
      
      if (!response.ok) throw new Error(`Custom AI error: ${response.statusText}`);
      
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        // Fallback for endpoints that ignore `stream: false` and return SSE anyway
        const dataLines = rawText.split('\n').filter(line => line.trim().startsWith('data: '));
        if (dataLines.length > 0) {
          const firstData = dataLines[0].replace('data: ', '').trim();
          data = JSON.parse(firstData);
        } else {
          throw new Error("Failed to parse JSON response from custom AI");
        }
      }
      responseText = data.choices[0]?.message?.content || data.choices[0]?.delta?.content || "";
    } else {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      responseText = response.text;
    }

    return NextResponse.json({ success: true, message: responseText });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
