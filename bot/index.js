require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events, ChannelType } = require("discord.js");
const { PrismaClient } = require("@prisma/client");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const { PrismaLibSql } = require("@prisma/adapter-libsql");

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ═══════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════

let isSyncing = false;
let cancelSync = false;

// ═══════════════════════════════════════════
// UTILITY: Exponential backoff retry
// ═══════════════════════════════════════════

async function withRetry(fn, { maxRetries = 3, baseDelayMs = 1000, label = "operation" } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable =
        error.message?.includes("429") ||
        error.message?.includes("rate") ||
        error.message?.includes("timeout") ||
        error.message?.includes("ECONNRESET") ||
        error.message?.includes("503") ||
        error.message?.includes("500");

      if (attempt === maxRetries || !isRetryable) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(`[Retry] ${label} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${Math.round(delay)}ms: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ═══════════════════════════════════════════
// UTILITY: Clean Discord message content
// ═══════════════════════════════════════════

function cleanContent(content) {
  if (!content) return "";
  return content
    // Remove Discord user mentions like <@123456>
    .replace(/<@!?\d+>/g, "")
    // Remove Discord channel mentions like <#123456>
    .replace(/<#\d+>/g, "")
    // Remove Discord role mentions like <@&123456>
    .replace(/<@&\d+>/g, "")
    // Remove custom emoji like <:name:123456> but keep the name
    .replace(/<a?:(\w+):\d+>/g, ":$1:")
    // Normalize excessive whitespace
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

// ═══════════════════════════════════════════
// UTILITY: Check if content is too short/trivial
// ═══════════════════════════════════════════

function isContentTrivial(content) {
  if (!content) return true;
  const cleaned = cleanContent(content);
  // Too short (less than 30 chars after cleaning)
  if (cleaned.length < 30) return true;
  // Dice roll only (e.g., "!roll 2d6" or just "nat 20")
  if (/^[!\/]?\s*(r(oll)?|d)\s*\d+d\d+/i.test(cleaned)) return true;
  // Just emojis / reactions
  if (/^[\s\p{Emoji}\p{Emoji_Component}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u.test(cleaned)) return true;
  // Bot commands
  if (/^[!\/](lore|help|roll|stats|ping|bot|cancel|fetch)/i.test(cleaned)) return true;
  return false;
}

// ═══════════════════════════════════════════
// AI: Classify if a message is D&D lore
// ═══════════════════════════════════════════

async function isMessageLore(content) {
  if (isContentTrivial(content)) return { isLore: false, tags: "" };

  const cleaned = cleanContent(content);

  const prompt = `You are an expert D&D Lore classification assistant with deep knowledge of tabletop RPGs.

TASK: Analyze the following message from a D&D Discord server and determine if it contains meaningful worldbuilding lore.

CLASSIFY AS LORE (isLore: true) if the message contains:
- Worldbuilding details (geography, politics, cultures, religions, cosmology)
- Character backstories, personalities, or development arcs
- Story events, plot points, or narrative developments
- NPC descriptions or interactions with story significance
- Item or artifact descriptions with narrative context
- Faction or organization lore
- Magical systems, spells, or supernatural phenomena explanations
- Historical events within the campaign world
- Rules or mechanics that are homebrew/custom to this campaign

CLASSIFY AS NOT LORE (isLore: false) if the message is:
- Out-of-character (OOC) chatter, jokes, or banter
- Dice rolls, combat math, or mechanical-only discussion
- Scheduling, logistics, or meta-discussion about the game
- Memes, reactions, or single-word responses
- Standard rules clarifications (not homebrew)
- Short acknowledgments like "ok", "sure", "nice", "lol"

RULES FOR OUTPUT:
1. "title" must be a concise, descriptive 3-7 word title that captures the core subject. Do NOT use generic titles like "A Story" or "Some Lore".
2. "mainCategory" MUST be exactly ONE of: Story, Character, Location, History, Item, Faction, Magic, Terminology, Event, Rule, CombatMechanic
3. "subTags" should be 1-3 specific, relevant tags (e.g., "Sword Coast", "Necromancy", "Dragon"). Do NOT repeat the main category.
4. Your confidence in the classification (0.0 to 1.0). Only classify as lore if confidence > 0.6.

MESSAGE:
"""
${cleaned}
"""

Reply ONLY with valid JSON (no markdown, no code blocks):
{"isLore": true, "title": "Descriptive Title Here", "mainCategory": "Location", "subTags": ["Sword Coast", "Tavern"], "confidence": 0.85}`;

  return await withRetry(
    async () => {
      const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

      let text = "";

      if (aiProvider === "custom") {
        const response = await fetch(process.env.CUSTOM_AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CUSTOM_AI_KEY || ""}`,
          },
          body: JSON.stringify({
            model: process.env.CUSTOM_AI_MODEL || "local-model",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            stream: false,
          }),
        });

        if (!response.ok) throw new Error(`Custom AI error: ${response.status} ${response.statusText}`);

        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          // Handle SSE format from endpoints that ignore stream: false
          const dataLines = rawText
            .split("\n")
            .filter((line) => line.trim().startsWith("data: ") && line.trim() !== "data: [DONE]");
          if (dataLines.length > 0) {
            data = JSON.parse(dataLines[0].replace("data: ", "").trim());
          } else {
            throw new Error("Failed to parse JSON response from custom AI");
          }
        }
        text = data.choices[0]?.message?.content?.trim() || data.choices[0]?.delta?.content?.trim() || "";
      } else {
        // Default to Gemini API
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          contents: prompt,
        });
        text = response.text().trim();
      }

      // Strip markdown code blocks if the AI wrapped the JSON
      text = text.replace(/```json\n?|\n?```/g, "").trim();

      const parsed = JSON.parse(text);

      // Confidence check — if AI is unsure, skip it
      if (parsed.confidence !== undefined && parsed.confidence < 0.6) {
        return { isLore: false, tags: "" };
      }

      // Build tags string: mainCategory first, then subTags
      const tags = [];
      if (parsed.mainCategory) tags.push(parsed.mainCategory);
      if (parsed.subTags && Array.isArray(parsed.subTags)) {
        tags.push(...parsed.subTags.filter((t) => t && t.toLowerCase() !== (parsed.mainCategory || "").toLowerCase()));
      }
      // Legacy fallback for old format
      if (!parsed.mainCategory && parsed.tags) {
        return { isLore: parsed.isLore === true, title: parsed.title || null, tags: parsed.tags.join(",") };
      }

      return {
        isLore: parsed.isLore === true,
        title: parsed.title || null,
        tags: tags.join(","),
      };
    },
    { maxRetries: 2, baseDelayMs: 1500, label: "AI classification" }
  );
}

// ═══════════════════════════════════════════
// AI: Generate a clean title for an entry
// ═══════════════════════════════════════════

async function generateTitle(content) {
  const cleaned = cleanContent(content).substring(0, 2000); // Limit context size

  const prompt = `Read the following D&D lore entry and generate a short, accurate 3-7 word title.
The title should be specific and descriptive — avoid generic titles like "A Tale" or "The Story".
Good examples: "The Fall of Nethervale Keep", "Zara's Pact with Asmodeus", "Mithral Mines of Khundrukar"

Content:
"""
${cleaned}
"""

Reply ONLY with the title string. No quotes, no explanation.`;

  return await withRetry(
    async () => {
      const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

      if (aiProvider === "custom") {
        const response = await fetch(process.env.CUSTOM_AI_ENDPOINT, {
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
        });
        if (!response.ok) throw new Error(`Custom AI error: ${response.status}`);
        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          const firstData = rawText.split("\n").filter((l) => l.includes("data:"))[0].replace("data: ", "");
          data = JSON.parse(firstData);
        }
        return (data.choices[0]?.message?.content?.trim() || "").replace(/['"]/g, "");
      } else {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          contents: prompt,
        });
        return response.text().trim().replace(/['"]/g, "");
      }
    },
    { maxRetries: 2, baseDelayMs: 1000, label: "title generation" }
  );
}

// ═══════════════════════════════════════════
// AI: Classify with timeout wrapper
// ═══════════════════════════════════════════

async function isMessageLoreWithTimeout(content, timeoutMs = 20000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI API request timed out")), timeoutMs)
  );
  try {
    return await Promise.race([isMessageLore(content), timeoutPromise]);
  } catch (error) {
    console.error("isMessageLore timeout or error:", error.message || error);
    return { isLore: false, tags: "" };
  }
}

// ═══════════════════════════════════════════
// AI: Auto-Coder for Mechanics Page
// ═══════════════════════════════════════════

async function updateMechanicsPage(newRuleContent) {
  const pagePath = path.join(__dirname, "../web/src/components/MechanicsPage.tsx");
  const backupPath = path.join(__dirname, "../web/src/components/MechanicsPage.backup.tsx");
  
  if (!fs.existsSync(pagePath)) {
    console.error("MechanicsPage.tsx not found at", pagePath);
    return false;
  }

  const currentCode = fs.readFileSync(pagePath, "utf-8");

  const prompt = `You are an expert React and TypeScript developer, and a D&D Dungeon Master.
Your task is to update the source code of the MechanicsPage.tsx React component to seamlessly integrate a new combat rule provided by the user.

CURRENT SOURCE CODE:
\`\`\`tsx
${currentCode}
\`\`\`

NEW RULE TO INTEGRATE:
"""
${newRuleContent}
"""

INSTRUCTIONS:
1. Carefully read the new rule. Determine which section of the page it belongs to (e.g., Calculation, Resistances, Status Conditions, Classes, or general).
2. Modify the React code to include this new rule. Use the existing UI components (like Accordion, ConditionCard, ClassCard, SubclassCard, MecTable) to make it look beautiful and fit the existing design.
3. If it's a new status condition, add a new <ConditionCard />. If it's a general rule, add it to the appropriate section using standard tailwind/styled HTML elements matching the current aesthetic.
4. Do NOT remove any existing features or rules unless the new rule explicitly replaces them.
5. Return the COMPLETE, fully functioning, updated TSX code. 
6. ONLY return the code inside a \`\`\`tsx block. Do not include any other conversational text.

Output the new TSX code:`;

  console.log("🤖 Sending MechanicsPage.tsx to AI for auto-updating...");

  return await withRetry(
    async () => {
      const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
      let text = "";

      if (aiProvider === "custom") {
        const response = await fetch(process.env.CUSTOM_AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CUSTOM_AI_KEY || ""}`,
          },
          body: JSON.stringify({
            model: process.env.CUSTOM_AI_MODEL || "local-model",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            stream: false,
          }),
        });

        if (!response.ok) throw new Error(`Custom AI error: ${response.status}`);
        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          const firstData = rawText.split("\\n").filter((l) => l.includes("data:"))[0].replace("data: ", "");
          data = JSON.parse(firstData);
        }
        text = data.choices[0]?.message?.content?.trim() || "";
      } else {
        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          contents: prompt,
        });
        text = response.text().trim();
      }

      // Extract code block
      const codeMatch = text.match(/\`\`\`(?:tsx|typescript|javascript)?([\s\S]*?)\`\`\`/);
      const finalCode = codeMatch ? codeMatch[1].trim() : text.replace(/\`\`\`/g, "").trim();

      if (!finalCode.includes("export default function MechanicsPage")) {
         throw new Error("AI generated invalid React code (missing default export)");
      }

      // Create backup and save
      fs.writeFileSync(backupPath, currentCode);
      fs.writeFileSync(pagePath, finalCode);
      console.log("✅ MechanicsPage.tsx successfully updated by AI!");
      return true;
    },
    { maxRetries: 1, baseDelayMs: 2000, label: "auto-update MechanicsPage" }
  );
}

// ═══════════════════════════════════════════
// UTILITY: Extract images from a message
// ═══════════════════════════════════════════

async function extractImages(message) {
  const urls = [];
  if (message.attachments?.size > 0) {
    const imgAttachments = message.attachments.filter(
      (a) => a.contentType && a.contentType.startsWith("image/")
    );
    if (imgAttachments.size > 0) urls.push(...imgAttachments.map((a) => a.url));
  }
  // Also check for image URLs in message content
  const urlRegex = /https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?/gi;
  const contentUrls = message.content?.match(urlRegex) || [];
  urls.push(...contentUrls);
  
  const uniqueUrls = [...new Set(urls)];
  const catboxUrls = [];

  for (const url of uniqueUrls) {
    try {
      // Don't re-upload if it's already a catbox link or not a discord link
      if ((!url.includes("discordapp.com") && !url.includes("discord.com")) || url.includes("catbox.moe")) {
        catboxUrls.push(url);
        continue;
      }
      
      const extMatch = url.match(/\.(png|jpg|jpeg|gif|webp)/i);
      const ext = extMatch ? extMatch[0] : ".jpg";
      const filename = `discord_image${ext}`;
      
      // 1. Download from Discord
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer]);
      
      // 2. Upload to Catbox
      const formData = new FormData();
      formData.append("reqtype", "fileupload");
      formData.append("fileToUpload", blob, filename);
      
      const uploadRes = await fetch("https://catbox.moe/user/api.php", {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error(`Catbox Upload failed: ${uploadRes.statusText}`);
      
      const catboxUrl = await uploadRes.text();
      catboxUrls.push(catboxUrl.trim());
    } catch (e) {
      console.error("Failed to upload image to Catbox:", url, e.message);
      catboxUrls.push(url); // Fallback to original URL
    }
  }

  return catboxUrls;
}

// ═══════════════════════════════════════════
// UTILITY: Merge tags without duplicates
// ═══════════════════════════════════════════

function mergeTags(existingTags, newTags) {
  const all = `${existingTags || ""},${newTags || ""}`
    .split(",")
    .map((t) => t.trim())
    .filter((v, i, a) => v !== "" && a.indexOf(v) === i);
  return all.join(",");
}

// ═══════════════════════════════════════════
// UTILITY: Merge image URLs without duplicates
// ═══════════════════════════════════════════

function mergeImageUrls(existingUrl, newUrls) {
  const existing = existingUrl ? existingUrl.split(",").map((u) => u.trim()) : [];
  const combined = [...new Set([...existing, ...newUrls])].filter(Boolean);
  return combined.length > 0 ? combined.join(",") : null;
}

// ═══════════════════════════════════════════
// CORE: Process a channel for lore entries
// ═══════════════════════════════════════════

async function processChannelForLore(targetChannel, limitDate, progressCallback) {
  let last_id = undefined;
  let totalSaved = 0;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let reachedLimit = false;

  while (!cancelSync) {
    const options = { limit: 100 };
    if (last_id) {
      options.before = last_id;
    }

    let messages;
    try {
      messages = await targetChannel.messages.fetch(options);
    } catch (err) {
      console.error(`Failed to fetch messages from ${targetChannel.name}:`, err.message);
      break;
    }
    if (messages.size === 0) break;

    for (const [id, oldMsg] of messages) {
      if (cancelSync) break;

      if (limitDate && oldMsg.createdAt < limitDate) {
        reachedLimit = true;
        break;
      }

      totalProcessed++;
      if (oldMsg.author.bot || !oldMsg.content) {
        totalSkipped++;
        continue;
      }

      // Skip trivial content early (before DB check = faster)
      if (isContentTrivial(oldMsg.content)) {
        totalSkipped++;
        continue;
      }

      const exists = await prisma.loreEntry.findUnique({
        where: { messageId: oldMsg.id },
      });

      if (!exists) {
        try {
          const result = await isMessageLoreWithTimeout(oldMsg.content);
          if (result.isLore) {
            const imageUrls = await extractImages(oldMsg);

            // Check for recent entry by same author in this channel (merge window)
            const fiveMinsAgo = new Date(oldMsg.createdAt.getTime() - 5 * 60000);
            const fiveMinsFuture = new Date(oldMsg.createdAt.getTime() + 5 * 60000);

            const recentEntry = await prisma.loreEntry.findFirst({
              where: {
                author: oldMsg.author.username,
                channelId: oldMsg.channelId,
                createdAt: {
                  gte: fiveMinsAgo,
                  lte: fiveMinsFuture,
                },
              },
              orderBy: { createdAt: "desc" },
            });

            if (recentEntry) {
              // Merge with existing entry
              const cleanedContent = cleanContent(oldMsg.content);
              let newContent;
              if (oldMsg.createdAt > recentEntry.createdAt) {
                newContent = recentEntry.content + "\n\n" + cleanedContent;
              } else {
                newContent = cleanedContent + "\n\n" + recentEntry.content;
              }

              await prisma.loreEntry.update({
                where: { id: recentEntry.id },
                data: {
                  content: newContent,
                  imageUrl: mergeImageUrls(recentEntry.imageUrl, imageUrls),
                  tags: mergeTags(recentEntry.tags, result.tags),
                },
              });
            } else {
              const cleanedContent = cleanContent(oldMsg.content);
              await prisma.loreEntry.create({
                data: {
                  title: result.title || cleanedContent.split("\n")[0].substring(0, 60) + "...",
                  content: cleanedContent,
                  author: oldMsg.author.username,
                  channelId: oldMsg.channelId,
                  channelName: targetChannel.name || "Unknown Thread",
                  messageId: oldMsg.id,
                  tags: result.tags,
                  imageUrl: imageUrls.length > 0 ? imageUrls.join(",") : null,
                  createdAt: oldMsg.createdAt,
                },
              });
            }
            totalSaved++;
            await oldMsg.react("📖").catch(() => {});
            
            if (result.tags.includes("CombatMechanic")) {
              await oldMsg.react("⚙️").catch(() => {});
              await updateMechanicsPage(cleanedContent).catch(err => console.error("Auto-coder failed:", err));
            }
          }
        } catch (err) {
          console.error(`Error processing message ${oldMsg.id}:`, err.message || err);
        }
      }
    }

    last_id = messages.last().id;
    if (reachedLimit) break;

    // Progress callback for periodic updates
    if (progressCallback && totalProcessed % 200 === 0) {
      await progressCallback(totalProcessed, totalSaved, totalSkipped);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return { totalProcessed, totalSaved, totalSkipped };
}

// ═══════════════════════════════════════════
// EVENT: Bot Ready
// ═══════════════════════════════════════════

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`📡 AI Provider: ${(process.env.AI_PROVIDER || "gemini").toUpperCase()}`);
  console.log(`🧠 Model: ${process.env.GEMINI_MODEL || process.env.CUSTOM_AI_MODEL || "gemini-2.5-flash"}`);
});

// ═══════════════════════════════════════════
// EVENT: Message Received
// ═══════════════════════════════════════════

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // ─── Help Command ───
  if (message.content === "!lorehelp") {
    const helpText = `**📖 D&D Lore Bot Commands**
- **Automatic Lore**: Just talk normally! The bot evaluates every message and automatically saves anything it considers lore.
- \`!fetcholdlore [channel] [YYYY-MM-DD]\`: Manually syncs past messages.
  - Example: \`!fetcholdlore\` (Syncs current channel)
  - Example: \`!fetcholdlore <#123456789>\` (Syncs a specific channel/forum)
  - Example: \`!fetcholdlore 2024-01-01\` (Syncs current channel back to Jan 1st, 2024)
- \`!cancel\`: Stop an ongoing \`!fetcholdlore\` sync.
- \`!lorestats\`: View stats about saved lore and scanned channels.
- \`!apitest\`: Ping the configured AI API to check connectivity.
- \`!redetectimages [channel]\`: Scans entries for missed images. Use 'all' for all channels.
- \`!simplifytags\`: Cleans up tags to keep only the primary Main Category.
- \`!fixtitles [channel]\`: Regenerates titles using AI. Use 'all' for all channels.
- \`!lorehelp\`: Shows this message.`;
    return message.reply(helpText);
  }

  // ─── Cancel Command ───
  if (message.content === "!cancel") {
    if (isSyncing) {
      cancelSync = true;
      return message.reply("🛑 Cancelling the current lore sync operation... please wait a moment for it to safely stop.");
    } else {
      return message.reply("No sync operation is currently running.");
    }
  }

  // ─── Stats Command ───
  if (message.content === "!lorestats") {
    try {
      const totalLore = await prisma.loreEntry.count();

      const channelStats = await prisma.loreEntry.groupBy({
        by: ["channelId", "channelName"],
        _count: { id: true },
        _min: { createdAt: true },
        _max: { createdAt: true },
      });

      let statsMessages = [
        `**📖 Lore Database Statistics**\n**Total Lore Entries:** ${totalLore}\n\n**Channel Breakdown:**\n`,
      ];
      let currentMsgIndex = 0;

      if (channelStats.length === 0) {
        statsMessages[0] += "No lore has been saved yet.";
      } else {
        channelStats.forEach((stat) => {
          const oldest = stat._min.createdAt ? new Date(stat._min.createdAt).toLocaleDateString() : "Unknown";
          const newest = stat._max.createdAt ? new Date(stat._max.createdAt).toLocaleDateString() : "Unknown";
          const line = `- **${stat.channelName}** (<#${stat.channelId}>): ${stat._count.id} entries (${oldest} to ${newest})\n`;

          if (statsMessages[currentMsgIndex].length + line.length > 1900) {
            currentMsgIndex++;
            statsMessages[currentMsgIndex] = "";
          }
          statsMessages[currentMsgIndex] += line;
        });
      }

      for (let i = 0; i < statsMessages.length; i++) {
        if (i === 0) {
          await message.reply(statsMessages[i]);
        } else {
          await message.channel.send(statsMessages[i]);
        }
      }
      return;
    } catch (e) {
      console.error("Stats error:", e);
      return message.reply("Failed to retrieve stats.");
    }
  }

  // ─── API Test Command ───
  if (message.content === "!apitest") {
    const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    const modelName = process.env.GEMINI_MODEL || process.env.CUSTOM_AI_MODEL || "gemini-2.5-flash";
    await message.reply(`🔄 Testing **${aiProvider.toUpperCase()}** API (model: \`${modelName}\`)...`);
    const start = Date.now();

    try {
      if (aiProvider === "custom") {
        const response = await fetch(process.env.CUSTOM_AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CUSTOM_AI_KEY || ""}`,
          },
          body: JSON.stringify({
            model: process.env.CUSTOM_AI_MODEL || "local-model",
            messages: [{ role: "user", content: "Ping! Say the word 'Pong'." }],
            temperature: 0.1,
            stream: false,
          }),
        });

        if (response.ok) {
          const time = Date.now() - start;
          message.channel.send(`✅ **Custom AI Endpoint is Online!**\nResponse time: ${time}ms`);
        } else {
          message.channel.send(`❌ **Custom AI Endpoint Error:** ${response.status} ${response.statusText}`);
        }
      } else {
        await ai.models.generateContent({
          model: modelName,
          contents: "Ping! Say the word 'Pong'.",
        });
        const time = Date.now() - start;
        message.channel.send(`✅ **Gemini API is Online!**\nResponse time: ${time}ms`);
      }
    } catch (e) {
      message.channel.send(
        `❌ **API Connection Failed:**\n\`\`\`${e.message}\`\`\`\n*Make sure your tunnel/LM Studio is running and the URL in your .env is correct!*`
      );
    }
    return;
  }

  // ─── Redetect Images Command ───
  if (message.content.startsWith("!redetectimages")) {
    const args = message.content.split(" ").slice(1);
    let targetChannelId = message.channelId;
    let isAll = false;

    if (args[0]) {
      if (args[0] === "all") {
        isAll = true;
        targetChannelId = null;
      } else if (args[0].startsWith("<#") && args[0].endsWith(">")) {
        targetChannelId = args[0].slice(2, -1);
      } else if (args[0].match(/^\d+$/)) {
        targetChannelId = args[0];
      }
    }

    const whereClause = isAll ? {} : { channelId: targetChannelId };

    await message.reply(
      `🖼️ Starting image redetection for ${isAll ? "all channels" : `<#${targetChannelId}>`}...`
    );
    try {
      const entries = await prisma.loreEntry.findMany({ where: whereClause });
      let updatedCount = 0;

      for (const entry of entries) {
        if (!entry.channelId || !entry.messageId) continue;

        try {
          const channel = await client.channels.fetch(entry.channelId);
          if (!channel) continue;

          const messages = await channel.messages.fetch({ limit: 20, around: entry.messageId });
          const originalMsg = await channel.messages.fetch(entry.messageId).catch(() => null);

          let foundImageUrls = [];

          // Check original message
          if (originalMsg) {
            const imgs = await extractImages(originalMsg);
            foundImageUrls.push(...imgs);

            // Check nearby messages within 5 minutes by same author
            const fiveMinsBefore = originalMsg.createdAt.getTime() - 5 * 60000;
            const fiveMinsAfter = originalMsg.createdAt.getTime() + 5 * 60000;
            const nearbyMsgs = messages.filter(
              (m) =>
                m.author.username === entry.author &&
                m.createdAt.getTime() >= fiveMinsBefore &&
                m.createdAt.getTime() <= fiveMinsAfter &&
                m.attachments.size > 0
            );
            
            for (const [id, msg] of nearbyMsgs) {
              const nearbyImgs = await extractImages(msg);
              foundImageUrls.push(...nearbyImgs);
            }
          }

          const finalImageUrl = [...new Set(foundImageUrls)].filter(Boolean).join(",") || null;

          if (finalImageUrl && entry.imageUrl !== finalImageUrl) {
            await prisma.loreEntry.update({
              where: { id: entry.id },
              data: { imageUrl: finalImageUrl },
            });
            updatedCount++;
          }
        } catch (err) {
          // Channel or message might be deleted, skip
        }
      }

      await message.reply(`✅ Image redetection complete. Updated ${updatedCount} entries.`);
    } catch (e) {
      console.error("Redetect images error:", e);
      await message.reply("❌ Error during image redetection.");
    }
    return;
  }

  // ─── Simplify Tags Command ───
  if (message.content === "!simplifytags") {
    await message.reply("🏷️ Simplifying tags (keeping only Main Category)...");
    try {
      const entries = await prisma.loreEntry.findMany();
      let updatedCount = 0;

      for (const entry of entries) {
        if (!entry.tags) continue;
        const tagsArray = entry.tags.split(",").map((t) => t.trim()).filter(Boolean);
        if (tagsArray.length > 1) {
          await prisma.loreEntry.update({
            where: { id: entry.id },
            data: { tags: tagsArray[0] },
          });
          updatedCount++;
        }
      }

      await message.reply(`✅ Simplified tags for ${updatedCount} entries.`);
    } catch (e) {
      console.error("Simplify tags error:", e);
      await message.reply("❌ Error during tag simplification.");
    }
    return;
  }

  // ─── Fix Titles Command ───
  if (message.content.startsWith("!fixtitles")) {
    const args = message.content.split(" ").slice(1);
    let targetChannelId = message.channelId;
    let isAll = false;

    if (args[0]) {
      if (args[0] === "all") {
        isAll = true;
        targetChannelId = null;
      } else if (args[0].startsWith("<#") && args[0].endsWith(">")) {
        targetChannelId = args[0].slice(2, -1);
      } else if (args[0].match(/^\d+$/)) {
        targetChannelId = args[0];
      }
    }

    const whereClause = isAll ? {} : { channelId: targetChannelId };
    await message.reply(
      `✨ Generating AI titles for ${isAll ? "all channels" : `<#${targetChannelId}>`}... This may take a while.`
    );

    try {
      const entries = await prisma.loreEntry.findMany({ where: whereClause });
      let updatedCount = 0;
      let errorCount = 0;

      for (const entry of entries) {
        // Process entries with bad titles (too long, ends in ..., or generic)
        const needsFix =
          entry.title.endsWith("...") ||
          entry.title.length > 50 ||
          entry.title.length < 3 ||
          /^(test|untitled|no title)/i.test(entry.title);

        if (needsFix) {
          try {
            const newTitle = await generateTitle(entry.content);

            if (newTitle && newTitle.length > 2 && newTitle.length < 120) {
              await prisma.loreEntry.update({
                where: { id: entry.id },
                data: { title: newTitle },
              });
              updatedCount++;
            }

            // Respect rate limits
            await new Promise((resolve) => setTimeout(resolve, 1200));
          } catch (err) {
            errorCount++;
            console.error(`Error fixing title for ${entry.id}:`, err.message);
          }
        }
      }

      let resultMsg = `✅ Updated ${updatedCount} titles.`;
      if (errorCount > 0) resultMsg += ` (${errorCount} errors)`;
      await message.reply(resultMsg);
    } catch (e) {
      console.error("Fix titles error:", e);
      await message.reply("❌ Error while fixing titles.");
    }
    return;
  }

  // ─── Fetch Old Lore Command ───
  if (message.content.startsWith("!fetcholdlore")) {
    const args = message.content.split(" ").slice(1);
    let targetChannel = message.channel;
    let limitDate = null;

    // Parse arguments
    for (const arg of args) {
      if (arg.startsWith("<#") && arg.endsWith(">")) {
        const channelId = arg.slice(2, -1);
        try {
          const fetchedChannel = await client.channels.fetch(channelId);
          if (fetchedChannel) targetChannel = fetchedChannel;
        } catch (e) {
          return message.reply("Could not find that channel.");
        }
      } else if (arg.match(/^\d+$/)) {
        try {
          const fetchedChannel = await client.channels.fetch(arg);
          if (fetchedChannel) targetChannel = fetchedChannel;
        } catch (e) {
          return message.reply("Could not find that channel ID.");
        }
      } else if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
        limitDate = new Date(arg);
        if (isNaN(limitDate.getTime())) {
          return message.reply("Invalid date format. Use YYYY-MM-DD.");
        }
      }
    }

    if (isSyncing) {
      return message.reply("⚠️ A sync is already running! Use `!cancel` to stop it first.");
    }

    isSyncing = true;
    cancelSync = false;

    const limitStr = limitDate ? ` back to ${limitDate.toDateString()}` : "";
    await message.reply(
      `📡 Fetching old messages in ${targetChannel.toString()}${limitStr}... This might take a while.`
    );

    // Progress callback — sends updates every 200 messages
    const progressCallback = async (processed, saved, skipped) => {
      await message.channel.send(
        `📊 Progress: ${processed} messages processed, ${saved} lore saved, ${skipped} skipped...`
      ).catch(() => {});
    };

    try {
      let totalSaved = 0;
      let totalProcessed = 0;
      let totalSkipped = 0;

      if (targetChannel.type === ChannelType.GuildForum) {
        const activeThreads = await targetChannel.threads.fetchActive();
        const archivedThreads = await targetChannel.threads.fetchArchived();
        const threads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];

        await message.channel.send(`Found ${threads.length} threads in ${targetChannel.toString()}. Processing...`);
        for (const thread of threads) {
          if (cancelSync) break;
          const stats = await processChannelForLore(thread, limitDate, progressCallback);
          totalProcessed += stats.totalProcessed;
          totalSaved += stats.totalSaved;
          totalSkipped += stats.totalSkipped;
        }
      } else {
        const stats = await processChannelForLore(targetChannel, limitDate, progressCallback);
        totalProcessed += stats.totalProcessed;
        totalSaved += stats.totalSaved;
        totalSkipped += stats.totalSkipped;
      }

      isSyncing = false;
      if (cancelSync) {
        message.channel.send(
          `🛑 Sync cancelled! Processed ${totalProcessed} messages. Saved ${totalSaved} lore, skipped ${totalSkipped}.`
        );
      } else {
        message.channel.send(
          `✅ Sync complete for ${targetChannel.toString()}! Processed ${totalProcessed} messages. Saved ${totalSaved} lore, skipped ${totalSkipped}.`
        );
      }
    } catch (error) {
      console.error("Fetch old lore error:", error);
      isSyncing = false;
      message.channel.send("❌ An error occurred while fetching old lore.");
    }
    return;
  }

  // ═══════════════════════════════════════════
  // NORMAL LISTENER: Process every new message
  // ═══════════════════════════════════════════

  // Skip trivial content before hitting the AI
  if (isContentTrivial(message.content)) return;

  const result = await isMessageLoreWithTimeout(message.content);

  if (result.isLore) {
    try {
      let imageUrls = await extractImages(message);

      // Look back 5 minutes for images the user posted before the lore message
      try {
        const pastMsgs = await message.channel.messages.fetch({ limit: 10, before: message.id });
        const fiveMinsAgoMs = message.createdAt.getTime() - 5 * 60000;
        const validPastMsgs = pastMsgs.filter(
          (m) =>
            m.author.id === message.author.id &&
            m.createdAt.getTime() >= fiveMinsAgoMs &&
            m.attachments.some((a) => a.contentType && a.contentType.startsWith("image/"))
        );
        for (const [id, msg] of validPastMsgs) {
          const imgs = await extractImages(msg);
          imageUrls.push(...imgs);
        }
        imageUrls = [...new Set(imageUrls)];
      } catch (e) {
        console.error("Error fetching past messages for images:", e.message);
      }

      const fiveMinsAgo = new Date(message.createdAt.getTime() - 5 * 60000);
      const recentEntry = await prisma.loreEntry.findFirst({
        where: {
          author: message.author.username,
          channelId: message.channelId,
          createdAt: { gte: fiveMinsAgo },
        },
        orderBy: { createdAt: "desc" },
      });

      const cleanedContent = cleanContent(message.content);

      if (recentEntry) {
        await prisma.loreEntry.update({
          where: { id: recentEntry.id },
          data: {
            content: recentEntry.content + "\n\n" + cleanedContent,
            imageUrl: mergeImageUrls(recentEntry.imageUrl, imageUrls),
            tags: mergeTags(recentEntry.tags, result.tags),
          },
        });
      } else {
        await prisma.loreEntry.create({
          data: {
            title: result.title || cleanedContent.split("\n")[0].substring(0, 60) + "...",
            content: cleanedContent,
            author: message.author.username,
            channelId: message.channelId,
            channelName: message.channel.name || "Unknown Thread",
            messageId: message.id,
            tags: result.tags,
            imageUrl: imageUrls.length > 0 ? imageUrls.join(",") : null,
            createdAt: message.createdAt,
          },
        });
      }
      await message.react("📖").catch(() => {});
      
      if (result.tags.includes("CombatMechanic")) {
        await message.react("⚙️").catch(() => {});
        await updateMechanicsPage(cleanedContent).catch(err => console.error("Auto-coder failed:", err));
      }
    } catch (err) {
      console.error("Error saving lore:", err.message || err);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
