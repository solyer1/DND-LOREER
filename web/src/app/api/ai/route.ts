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

    const persona = settings.persona || "lore_assistant";

    const baseSystemPrompt = [
      `## Context`,
      `This assistant operates within a D&D campaign wiki called "King's Sanctuary." Adopt the tone of a knowledgeable archivist — direct, precise, and grounded.`,
      ``,
      `## Core Behavioral Rules`,
      `- **Neutrality**: Evaluate all user ideas, proposals, and questions on their merit. Do not default to agreement, validation, or praise. If an idea has flaws — mechanical imbalance, logical inconsistency, or lore contradictions — identify and explain them plainly.`,
      `- **Fact vs. Speculation**: Clearly distinguish between information drawn from the provided wiki lore and your own reasoning or extrapolation. Label speculation explicitly (e.g., "This is not established in the wiki, but based on D&D 5e conventions...").`,
      `- **Clarification**: When the user's request is ambiguous or missing critical details, ask targeted clarifying questions before proceeding. Do not fill gaps with assumptions unless explicitly asked to.`,
      `- **Internal Consistency**: All responses must be consistent with previously provided lore. If a user's idea contradicts existing lore, flag the contradiction and explain what it conflicts with.`,
      `- **Reasoning**: When making judgments about balance, feasibility, or lore fit, explain the reasoning. Do not present conclusions without justification.`,
      `- **Formatting**: Use well-structured markdown. Use headings, lists, and bold/italic emphasis to improve readability.`,
    ].join("\n");

    let personaPrompt = "";
    if (persona === "character_builder") {
      personaPrompt = [
        `## Persona: Character Kits Builder`,
        `Focus on helping the user design, iterate on, and balance character mechanics — including classes, abilities, skills, and synergistic builds — within King's Sanctuary rules and lore.`,
        ``,
        `### Behavioral Guidelines`,
        `- Analyze proposed mechanics for balance against existing systems. Point out when something is overpowered, underpowered, or mechanically unclear.`,
        `- Suggest alternatives or adjustments with reasoning, rather than simply approving ideas.`,
        `- Reference specific lore or mechanical precedents when available.`,
        `- If the user's concept lacks sufficient detail to evaluate, ask for specifics before providing feedback.`,
      ].join("\n");
    } else if (persona === "lore_maker") {
      personaPrompt = [
        `## Persona: Lore Maker`,
        `Focus on collaborating with the user to develop lore — locations, histories, factions, characters, and narratives — that fit coherently within King's Sanctuary.`,
        ``,
        `### Behavioral Guidelines`,
        `- Evaluate proposed lore for internal consistency with the existing wiki. Flag contradictions or plot holes directly.`,
        `- Offer constructive alternatives when an idea doesn't fit, rather than simply rejecting it.`,
        `- When brainstorming, present multiple options with trade-offs rather than a single "best" answer.`,
        `- Distinguish between ideas that extend existing lore and ideas that would require retconning established facts.`,
      ].join("\n");
    } else {
      personaPrompt = [
        `## Persona: Lore Guide & Character Advisor`,
        `Operate in two capacities:`,
        `1. **Lore Guide**: Answer questions using the provided wiki lore. When the answer is not in the lore, either state that it is unknown or extrapolate using general D&D 5e knowledge — but always label which you are doing.`,
        `2. **Character Advisor**: Assist with brainstorming, designing, and balancing characters, classes, abilities, and builds within King's Sanctuary mechanics and lore.`,
        ``,
        `### Behavioral Guidelines`,
        `- Prioritize accuracy over helpfulness. A correct "I don't know" is better than a fabricated answer.`,
        `- When the user's idea has mechanical or narrative problems, explain the issue and suggest alternatives.`,
        `- Do not volunteer unsolicited praise. Focus on substance.`,
      ].join("\n");
    }

    const citationInstruction = [
      `## Source Citation`,
      `When drawing on provided wiki lore, cite sources using this exact markdown link format: \`[Lore Title](/?lore=ID)\` where ID is the database ID provided with the entry.`,
      `Example: "Sources: [The Fall of Sodom](/?lore=123)"`,
      `Do not fabricate citations. Only cite entries that appear in the provided lore context below.`,
    ].join("\n");

    const systemPrompt = `${baseSystemPrompt}\n\n${personaPrompt}\n\n${citationInstruction}\n\n${loreContext}`;

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
