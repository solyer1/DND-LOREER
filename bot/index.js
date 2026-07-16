require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");
const { PrismaClient } = require("@prisma/client");
const { GoogleGenAI } = require("@google/genai");

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

// Function to classify if a message is D&D lore
async function isMessageLore(content) {
  if (!content || content.length < 20) return false; // Ignore very short messages
  
  const prompt = `You are a D&D Lore classification assistant.
Read the following message from a D&D Discord server.
Decide if this message contains actual worldbuilding lore, story events, character backstories, or important campaign information that should be saved to a lore database. 
If it is just casual conversation, out-of-character chat, memes, or dice rolls, set "isLore" to false.
If it is lore, set "isLore" to true.
If it is lore, also provide a list of up to 3 relevant tags (e.g., "Location", "NPC", "History", "Deity").

Message: "${content}"

Reply ONLY with valid JSON in this exact format:
{
  "isLore": true,
  "tags": ["Tag1", "Tag2"]
}`;

  try {
    const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    
    if (aiProvider === "custom") {
      // Use custom OpenAI-compatible endpoint (e.g. Local LM Studio, Ollama, or third party)
      const response = await fetch(process.env.CUSTOM_AI_ENDPOINT, {
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
        const dataLines = rawText.split('\n').filter(line => line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]');
        if (dataLines.length > 0) {
          const firstData = dataLines[0].replace('data: ', '').trim();
          data = JSON.parse(firstData);
        } else {
          throw new Error("Failed to parse JSON response from custom AI");
        }
      }
      let text = data.choices[0]?.message?.content?.trim() || data.choices[0]?.delta?.content?.trim() || "";
      // Strip markdown code blocks if the AI added them
      text = text.replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(text);
      return { isLore: parsed.isLore === true, tags: parsed.tags ? parsed.tags.join(",") : "" };
      
    } else {
      // Default to Gemini API
      const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: prompt,
      });
      let text = response.text().trim();
      text = text.replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(text);
      return { isLore: parsed.isLore === true, tags: parsed.tags ? parsed.tags.join(",") : "" };
    }
  } catch (error) {
    console.error("Error calling AI API:", error);
    return { isLore: false, tags: "" }; // Fail safe
  }
}

// Event: Bot is ready
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Event: Message received
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Command to process old messages in the current channel
  if (message.content === "!fetcholdlore") {
    if (!message.member?.permissions.has("Administrator")) {
      return message.reply("You need Administrator permissions to use this command.");
    }
    
    await message.reply("Fetching old messages in this channel... This might take a while.");
    
    try {
      let last_id = undefined;
      let totalSaved = 0;
      let totalProcessed = 0;

      while (true) {
        const options = { limit: 100 };
        if (last_id) {
            options.before = last_id;
        }

        const messages = await message.channel.messages.fetch(options);
        if (messages.size === 0) break;

        for (const [id, oldMsg] of messages) {
          totalProcessed++;
          if (oldMsg.author.bot || !oldMsg.content) continue;

          // Check if already in DB
          const exists = await prisma.loreEntry.findUnique({
            where: { messageId: oldMsg.id }
          });
          
          if (!exists) {
             const result = await isMessageLore(oldMsg.content);
             if (result.isLore) {
               await prisma.loreEntry.create({
                 data: {
                   title: oldMsg.content.split("\n")[0].substring(0, 50) + "...", // Use first line as title
                   content: oldMsg.content,
                   author: oldMsg.author.username,
                   channelId: oldMsg.channelId,
                   channelName: oldMsg.channel.name || "Unknown Thread",
                   messageId: oldMsg.id,
                   tags: result.tags,
                   createdAt: oldMsg.createdAt,
                 }
               });
               totalSaved++;
             }
          }
        }
        
        last_id = messages.last().id;
        
        // Safety break to not hit rate limits too hard
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      message.channel.send(`Finished! Processed ${totalProcessed} messages. Saved ${totalSaved} new lore entries.`);
    } catch (error) {
      console.error(error);
      message.channel.send("An error occurred while fetching old lore.");
    }
    return;
  }

  // Normal listener: Process every new message
  const result = await isMessageLore(message.content);
  
  if (result.isLore) {
    try {
      await prisma.loreEntry.create({
        data: {
          title: message.content.split("\n")[0].substring(0, 50) + "...",
          content: message.content,
          author: message.author.username,
          channelId: message.channelId,
          channelName: message.channel.name || "Unknown Thread",
          messageId: message.id,
          tags: result.tags,
        }
      });
      // Optionally add a reaction to let the users know it was saved
      await message.react("📖");
    } catch (err) {
      console.error("Error saving lore:", err);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
