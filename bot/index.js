require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Events, ChannelType } = require("discord.js");
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

// Global State for Syncing
let isSyncing = false;
let cancelSync = false;

// Function to classify if a message is D&D lore
async function isMessageLore(content) {
  if (!content || content.length < 20) return false; // Ignore very short messages
  
  const prompt = `You are a D&D Lore classification assistant.
Read the following message from a D&D Discord server.
Decide if this message contains actual worldbuilding lore, story events, character backstories, or important campaign information that should be saved to a lore database. 
If it is just casual conversation, out-of-character chat, memes, or dice rolls, set "isLore" to false.
If it is lore, set "isLore" to true.
If it is lore, generate a short, accurate 3-5 word "title" summarizing the entry.
If it is lore, you MUST assign it to exactly ONE of these 10 Main Categories: Story, Character, Location, History, Item, Faction, Magic, Terminology, Event, Rule.
This Main Category MUST be the FIRST item in your tags array.
You may then add up to 2 additional custom tags of your own choosing.

Message: "${content}"

Reply ONLY with valid JSON in this exact format:
{
  "isLore": true,
  "title": "A Short Accurate Title",
  "tags": ["Location", "Sword Coast", "Tavern"]
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
      return { isLore: parsed.isLore === true, title: parsed.title || null, tags: parsed.tags ? parsed.tags.join(",") : "" };
      
    } else {
      // Default to Gemini API
      const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: prompt,
      });
      let text = response.text().trim();
      text = text.replace(/```json\n?|\n?```/g, '');
      const parsed = JSON.parse(text);
      return { isLore: parsed.isLore === true, title: parsed.title || null, tags: parsed.tags ? parsed.tags.join(",") : "" };
    }
  } catch (error) {
    console.error("Error calling AI API:", error);
    return { isLore: false, tags: "" }; // Fail safe
  }
}

// Timeout Wrapper for AI Processing
async function isMessageLoreWithTimeout(content, timeoutMs = 15000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI API request timed out")), timeoutMs)
  );
  try {
    return await Promise.race([
      isMessageLore(content),
      timeoutPromise
    ]);
  } catch (error) {
    console.error("isMessageLore timeout or error:", error.message || error);
    return { isLore: false, tags: "" };
  }
}

// Event: Bot is ready
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Event: Message received
async function processChannelForLore(targetChannel, limitDate) {
  let last_id = undefined;
  let totalSaved = 0;
  let totalProcessed = 0;
  let reachedLimit = false;

  while (!cancelSync) {
    const options = { limit: 100 };
    if (last_id) {
        options.before = last_id;
    }

    const messages = await targetChannel.messages.fetch(options);
    if (messages.size === 0) break;

    for (const [id, oldMsg] of messages) {
      if (cancelSync) break;
      
      if (limitDate && oldMsg.createdAt < limitDate) {
        reachedLimit = true;
        break;
      }
      
      totalProcessed++;
      if (oldMsg.author.bot || !oldMsg.content) continue;

      const exists = await prisma.loreEntry.findUnique({
        where: { messageId: oldMsg.id }
      });
      
      if (!exists) {
         try {
           const result = await isMessageLoreWithTimeout(oldMsg.content);
           if (result.isLore) {
           let imageUrl = null;
           if (oldMsg.attachments.size > 0) {
             const imageAttachment = oldMsg.attachments.find(a => a.contentType && a.contentType.startsWith("image/"));
             if (imageAttachment) imageUrl = imageAttachment.url;
           }

           // Check for recent entry by same author in this channel
           const fiveMinsAgo = new Date(oldMsg.createdAt.getTime() - 5 * 60000);
           const fiveMinsFuture = new Date(oldMsg.createdAt.getTime() + 5 * 60000);
           
           const recentEntry = await prisma.loreEntry.findFirst({
             where: {
               author: oldMsg.author.username,
               channelId: oldMsg.channelId,
               createdAt: {
                 gte: fiveMinsAgo,
                 lte: fiveMinsFuture
               }
             },
             orderBy: { createdAt: 'desc' }
           });

           if (recentEntry) {
             // Merge
             let newContent;
             if (oldMsg.createdAt > recentEntry.createdAt) {
               newContent = recentEntry.content + "\n\n" + oldMsg.content;
             } else {
               newContent = oldMsg.content + "\n\n" + recentEntry.content;
             }
             
             await prisma.loreEntry.update({
               where: { id: recentEntry.id },
               data: {
                 content: newContent,
                 imageUrl: imageUrl || recentEntry.imageUrl,
                 // Simple union of tags
                 tags: (recentEntry.tags + "," + result.tags).split(",").filter((v, i, a) => a.indexOf(v) === i && v.trim() !== "").join(",")
               }
             });
           } else {
             await prisma.loreEntry.create({
               data: {
                 title: result.title || oldMsg.content.split("\n")[0].substring(0, 50) + "...",
                 content: oldMsg.content,
                 author: oldMsg.author.username,
                 channelId: oldMsg.channelId,
                 channelName: targetChannel.name || "Unknown Thread",
                 messageId: oldMsg.id,
                 tags: result.tags,
                 imageUrl: imageUrl,
                 createdAt: oldMsg.createdAt,
               }
             });
           }
           totalSaved++;
           await oldMsg.react("📖").catch(() => {});
         }
         } catch (err) {
           console.error(`Error processing message ${oldMsg.id}:`, err);
         }
      }
    }
    
    last_id = messages.last().id;
    if (reachedLimit) break;
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return { totalProcessed, totalSaved };
}

// Event: Message received
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (message.content === "!lorehelp") {
    const helpText = `**📖 D&D Lore Bot Commands**
- **Automatic Lore**: Just talk normally! The bot will evaluate every message sent and automatically save anything it considers lore.
- \`!fetcholdlore [channel] [YYYY-MM-DD]\`: Manually syncs past messages.
  - Example: \`!fetcholdlore\` (Syncs current channel)
  - Example: \`!fetcholdlore <#123456789>\` (Syncs a specific channel/forum)
  - Example: \`!fetcholdlore 2024-01-01\` (Syncs current channel back to Jan 1st, 2024)
- \`!cancel\`: Stop an ongoing \`!fetcholdlore\` sync.
- \`!lorestats\`: View stats about how much lore is saved and which channels have been scanned.
- \`!apitest\`: Ping the configured AI API (Custom or Gemini) to check if it's online and responding.
- \`!lorehelp\`: Shows this message.`;
    return message.reply(helpText);
  }

  // Cancel Command
  if (message.content === "!cancel") {
    if (isSyncing) {
      cancelSync = true;
      return message.reply("🛑 Cancelling the current lore sync operation... please wait a moment for it to safely stop.");
    } else {
      return message.reply("No sync operation is currently running.");
    }
  }

  // Stats Command
  if (message.content === "!lorestats") {
    try {
      const totalLore = await prisma.loreEntry.count();
      
      const channelStats = await prisma.loreEntry.groupBy({
        by: ['channelId', 'channelName'],
        _count: { id: true },
        _min: { createdAt: true },
        _max: { createdAt: true }
      });
      
      let statsMessages = [`**📖 Lore Database Statistics**\n**Total Lore Entries:** ${totalLore}\n\n**Channel Breakdown:**\n`];
      let currentMsgIndex = 0;
      
      if (channelStats.length === 0) {
        statsMessages[0] += "No lore has been saved yet.";
      } else {
        channelStats.forEach(stat => {
           const oldest = stat._min.createdAt ? new Date(stat._min.createdAt).toLocaleDateString() : "Unknown";
           const newest = stat._max.createdAt ? new Date(stat._max.createdAt).toLocaleDateString() : "Unknown";
           const line = `- **${stat.channelName}** (<#${stat.channelId}>): ${stat._count.id} entries (Scanned Range: ${oldest} to ${newest})\n`;
           
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
      console.error(e);
      return message.reply("Failed to retrieve stats.");
    }
  }

  // API Test Command
  if (message.content === "!apitest") {
    const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    await message.reply(`🔄 Testing connection to **${aiProvider.toUpperCase()}** AI API...`);
    const start = Date.now();
    
    try {
      if (aiProvider === "custom") {
        const response = await fetch(process.env.CUSTOM_AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CUSTOM_AI_KEY || ""}`
          },
          body: JSON.stringify({
            model: process.env.CUSTOM_AI_MODEL || "local-model",
            messages: [{ role: "user", content: "Ping! Say the word 'Pong'." }],
            temperature: 0.1,
            stream: false
          })
        });
        
        if (response.ok) {
           const time = Date.now() - start;
           message.channel.send(`✅ **Custom AI Endpoint is Online!**\nResponse time: ${time}ms`);
        } else {
           message.channel.send(`❌ **Custom AI Endpoint returned an error:** ${response.status} ${response.statusText}`);
        }
      } else {
        // Test Gemini
        await ai.models.generateContent({
           model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
           contents: "Ping! Say the word 'Pong'."
        });
        const time = Date.now() - start;
        message.channel.send(`✅ **Gemini API is Online!**\nResponse time: ${time}ms`);
      }
    } catch (e) {
       message.channel.send(`❌ **API Connection Failed:**\n\`\`\`${e.message}\`\`\`\n*Make sure your tunnel/LM Studio is running and the URL in your .env is correct!*`);
    }
    return;
  }

  // Redetect Images Command
  if (message.content === "!redetectimages") {
    await message.reply("🖼️ Starting image redetection for all lore entries... (Searching up to 5 minutes after the original message)");
    try {
      const entries = await prisma.loreEntry.findMany();
      let updatedCount = 0;
      
      for (const entry of entries) {
        if (!entry.channelId || !entry.messageId) continue;
        
        try {
          const channel = await client.channels.fetch(entry.channelId);
          if (!channel) continue;
          
          // Fetch the original message and a few messages after it
          const messages = await channel.messages.fetch({ limit: 10, after: entry.messageId });
          const originalMsg = await channel.messages.fetch(entry.messageId).catch(() => null);
          
          let foundImageUrl = null;
          
          // 1. Check original message
          if (originalMsg && originalMsg.attachments.size > 0) {
            const imgAttachment = originalMsg.attachments.find(a => a.contentType && a.contentType.startsWith("image/"));
            if (imgAttachment) foundImageUrl = imgAttachment.url;
          }
          
          // 2. Check subsequent messages within 5 minutes by the same author
          if (!foundImageUrl && originalMsg) {
            const fiveMinsAfter = originalMsg.createdAt.getTime() + 5 * 60000;
            const subsequentMsgs = messages.filter(m => 
              m.author.username === entry.author && 
              m.createdAt.getTime() <= fiveMinsAfter &&
              m.attachments.size > 0
            );
            
            // Sort by earliest first
            const sorted = subsequentMsgs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            if (sorted.size > 0) {
              const imgAttachment = sorted.first().attachments.find(a => a.contentType && a.contentType.startsWith("image/"));
              if (imgAttachment) foundImageUrl = imgAttachment.url;
            }
          }
          
          if (foundImageUrl && entry.imageUrl !== foundImageUrl) {
            await prisma.loreEntry.update({
              where: { id: entry.id },
              data: { imageUrl: foundImageUrl }
            });
            updatedCount++;
          }
        } catch (err) {
          // Channel or message might be deleted, skip
        }
      }
      
      await message.reply(`✅ Finished redetecting images. Updated ${updatedCount} entries with new images.`);
    } catch (e) {
      console.error(e);
      await message.reply("❌ Error occurred during image redetection.");
    }
    return;
  }

  // Simplify Tags Command
  if (message.content === "!simplifytags") {
    await message.reply("🏷️ Simplifying tags... (Keeping only the Main Category tag for each entry)");
    try {
      const entries = await prisma.loreEntry.findMany();
      let updatedCount = 0;
      
      for (const entry of entries) {
        if (!entry.tags) continue;
        
        const tagsArray = entry.tags.split(",").map(t => t.trim()).filter(Boolean);
        if (tagsArray.length > 1) {
          // Keep only the first tag
          const simplifiedTags = tagsArray[0];
          await prisma.loreEntry.update({
            where: { id: entry.id },
            data: { tags: simplifiedTags }
          });
          updatedCount++;
        }
      }
      
      await message.reply(`✅ Finished simplifying tags. Cleaned up ${updatedCount} entries.`);
    } catch (e) {
      console.error(e);
      await message.reply("❌ Error occurred during tag simplification.");
    }
    return;
  }
  
  // Fix Titles Command
  if (message.content === "!fixtitles") {
    await message.reply("✨ Starting AI title generation for all existing entries... This will take a while.");
    try {
      const entries = await prisma.loreEntry.findMany();
      let updatedCount = 0;
      
      for (const entry of entries) {
        // Simple heuristic to detect bad titles: if it's longer than 50 chars, ends in ..., or contains a lot of newlines
        // But for a full fix, we can just process all of them. To save API calls, maybe process ones that end in "..."
        if (entry.title.endsWith("...") || entry.title.length > 45) {
          try {
            const prompt = `Read the following D&D lore entry and generate a short, accurate 3-5 word title for it. Reply ONLY with the title string, no quotes.
            
Content: "${entry.content}"`;

            let newTitle = "";
            const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
            
            if (aiProvider === "custom") {
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
               if (response.ok) {
                 const rawText = await response.text();
                 let data;
                 try { data = JSON.parse(rawText); } catch(e) {
                   const firstData = rawText.split('\n').filter(l => l.includes('data:'))[0].replace('data: ', '');
                   data = JSON.parse(firstData);
                 }
                 newTitle = (data.choices[0]?.message?.content?.trim() || data.choices[0]?.delta?.content?.trim() || "").replace(/['"]/g, '');
               }
            } else {
               const response = await ai.models.generateContent({
                   model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                   contents: prompt,
               });
               newTitle = response.text().trim().replace(/['"]/g, '');
            }
            
            if (newTitle && newTitle.length > 2) {
              await prisma.loreEntry.update({
                where: { id: entry.id },
                data: { title: newTitle.substring(0, 100) }
              });
              updatedCount++;
            }
            
            // Sleep slightly to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Error generating title for ${entry.id}:`, err);
          }
        }
      }
      
      await message.reply(`✅ Finished fixing titles. Updated ${updatedCount} entries with AI generated titles.`);
    } catch (e) {
      console.error(e);
      await message.reply("❌ Error occurred while fixing titles.");
    }
    return;
  }

  // Command to process old messages in the current channel
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
        // Raw Channel ID
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
      return message.reply("⚠️ A sync operation is already running! Please wait for it to finish or use `!cancel`.");
    }
    
    isSyncing = true;
    cancelSync = false;

    const limitStr = limitDate ? ` back to ${limitDate.toDateString()}` : "";
    await message.reply(`Fetching old messages in ${targetChannel.toString()}${limitStr}... This might take a while.`);
    
    try {
      let totalSaved = 0;
      let totalProcessed = 0;
      
      if (targetChannel.type === ChannelType.GuildForum) {
        const activeThreads = await targetChannel.threads.fetchActive();
        const archivedThreads = await targetChannel.threads.fetchArchived();
        const threads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
        
        await message.channel.send(`Found ${threads.length} threads in ${targetChannel.toString()}. Processing...`);
        for (const thread of threads) {
          if (cancelSync) break;
          const stats = await processChannelForLore(thread, limitDate);
          totalProcessed += stats.totalProcessed;
          totalSaved += stats.totalSaved;
        }
      } else {
        const stats = await processChannelForLore(targetChannel, limitDate);
        totalProcessed += stats.totalProcessed;
        totalSaved += stats.totalSaved;
      }
      
      isSyncing = false;
      if (cancelSync) {
        message.channel.send(`🛑 Sync was cancelled! Processed ${totalProcessed} messages. Saved ${totalSaved} new lore entries.`);
      } else {
        message.channel.send(`✅ Finished syncing ${targetChannel.toString()}! Processed ${totalProcessed} messages. Saved ${totalSaved} new lore entries.`);
      }
    } catch (error) {
      console.error(error);
      isSyncing = false;
      message.channel.send("An error occurred while fetching old lore.");
    }
    return;
  }

  // Normal listener: Process every new message
  const result = await isMessageLoreWithTimeout(message.content);
  
  if (result.isLore) {
    try {
      let imageUrl = null;
      if (message.attachments.size > 0) {
        const imageAttachment = message.attachments.find(a => a.contentType && a.contentType.startsWith("image/"));
        if (imageAttachment) imageUrl = imageAttachment.url;
      }

      const fiveMinsAgo = new Date(message.createdAt.getTime() - 5 * 60000);
      const recentEntry = await prisma.loreEntry.findFirst({
        where: {
          author: message.author.username,
          channelId: message.channelId,
          createdAt: { gte: fiveMinsAgo }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentEntry) {
        await prisma.loreEntry.update({
          where: { id: recentEntry.id },
          data: {
            content: recentEntry.content + "\n\n" + message.content,
            imageUrl: imageUrl || recentEntry.imageUrl,
            tags: (recentEntry.tags + "," + result.tags).split(",").filter((v, i, a) => a.indexOf(v) === i && v.trim() !== "").join(",")
          }
        });
      } else {
        await prisma.loreEntry.create({
          data: {
            title: result.title || message.content.split("\n")[0].substring(0, 50) + "...",
            content: message.content,
            author: message.author.username,
            channelId: message.channelId,
            channelName: message.channel.name || "Unknown Thread",
            messageId: message.id,
            tags: result.tags,
            imageUrl: imageUrl,
            createdAt: message.createdAt,
          }
        });
      }
      await message.react("📖").catch(() => {});
    } catch (err) {
      console.error("Error saving lore:", err);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
