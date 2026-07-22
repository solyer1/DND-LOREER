import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages = [], settings = {} } = body;

    // Use user-provided settings if they exist, otherwise fallback to server defaults
    const useCustom = Boolean(settings.endpoint) || (process.env.AI_PROVIDER || "gemini").toLowerCase() === "custom";
    let endpoint = settings.endpoint || process.env.CUSTOM_AI_ENDPOINT || "http://localhost:1234/v1/chat/completions";
    
    // Sanitize endpoint URL using URL constructor to handle weird copy/pastes
    endpoint = endpoint.trim();
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "https://" + endpoint;
    }
    try {
      const urlObj = new URL(endpoint);
      if (urlObj.hostname.endsWith("https")) {
        urlObj.hostname = urlObj.hostname.slice(0, -5);
      }
      if (urlObj.pathname === "/" || urlObj.pathname === "") {
        urlObj.pathname = "/v1/chat/completions";
      } else if (urlObj.pathname === "/v1" || urlObj.pathname === "/v1/") {
        urlObj.pathname = "/v1/chat/completions";
      }
      // Upgrade http to https to prevent 301 redirects from dropping the POST body
      if (urlObj.protocol === "http:" && !["localhost", "127.0.0.1"].includes(urlObj.hostname)) {
        urlObj.protocol = "https:";
      }
      endpoint = urlObj.toString();
    } catch (e) {
      // If URL parsing fails, just leave it as is and let fetch handle the error
    }

    const apiKey = settings.apiKey || process.env.CUSTOM_AI_KEY || "";
    const model = settings.model || process.env.CUSTOM_AI_MODEL || "local-model";
    
    // Determine context limit
    const contextLimit = settings.contextLimit !== undefined ? Number(settings.contextLimit) : 50;

    // Fetch lore entries for context
    let loreContext = "";
    if (contextLimit > 0) {
      const entries = await prisma.loreEntry.findMany({
        orderBy: { createdAt: "desc" },
        take: contextLimit,
      });

      if (entries.length > 0) {
        loreContext = "Here is the lore from the King's Sanctuary Wiki:\n\n" + 
          entries.map(e => `[${e.title}] (ID: ${e.id})\nCategory: ${e.tags}\nContent: ${e.content}`).join("\n\n---\n\n");
      }
    }

    const systemPrompt = `You are the Keeper of Lore, an AI assistant for a D&D campaign wiki called "King's Sanctuary".

Your roles are:
1. A Lore Guide & Assistant: Answer the user's questions based on the lore provided below. If the answer is not in the lore, you may say you don't know or extrapolate reasonably based on D&D 5e knowledge, but clearly state when you are guessing outside the provided wiki lore.
2. A Skillset & Character Creation Assistant: Help players brainstorm, design, and balance new characters, classes, abilities, and synergistic builds tailored to the mechanics and lore of King's Sanctuary.
3. Source Citation: Whenever you draw upon the provided lore to answer a question, you must explicitly cite your sources using clickable markdown links. The format must be exactly \`[Lore Title](/?lore=ID)\` where ID is the provided database ID (e.g., "Sources: [The Fall of Sodom](/?lore=123)").

Keep your answers engaging, slightly in-character as a wise archivist, but readable and well-formatted using markdown.

${loreContext}`;

    let responseText = "";

    if (useCustom) {
      // OpenAI-compatible endpoint
      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }))
      ];

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: apiMessages,
          temperature: 0.3,
          stream: false
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom AI error (${endpoint}): ${response.status} - ${errorText}`);
      }
      
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
      responseText = data.choices?.[0]?.message?.content || data.choices?.[0]?.delta?.content || "";
      
    } else {
      // Gemini API
      // Setup the gemini client (fallback to env key)
      const genaiApiKey = settings.apiKey || process.env.GEMINI_API_KEY;
      if (!genaiApiKey) {
        throw new Error("Gemini API key is not configured.");
      }

      const ai = new GoogleGenAI({ apiKey: genaiApiKey });
      const geminiModel = settings.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

      const contents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
        }
      });
      
      responseText = response.text || "";
    }

    return NextResponse.json({ success: true, message: responseText });
  } catch (error: any) {
    console.error("AI API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
