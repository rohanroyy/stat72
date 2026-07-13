import { TelegramClient, sessions } from "telegram";
import fs from "fs";
import path from "path";
import readline from "readline";

// Helper to prompt user in terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// File paths
const envPath = path.resolve(process.cwd(), ".env");
const outputPath = path.resolve(process.cwd(), "public/telegram_history.json");

// Direct file URL resolver
async function fetchFileUrl(botToken, fileId) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ok || !data.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
  } catch {
    return null;
  }
}

// Drive helpers replica for formatting
function getFileType(mime) {
  const m = String(mime).toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('image')) return 'image';
  if (m.includes('video')) return 'video';
  if (m.includes('audio') || m.includes('ogg')) return 'audio';
  return 'file';
}

function getTypeLabel(type) {
  if (type === 'pdf') return 'PDF';
  if (type === 'image') return 'IMG';
  if (type === 'video') return 'MP4';
  if (type === 'audio') return 'AUD';
  return 'FILE';
}

function formatSize(bytes) {
  if (!bytes) return '-';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function main() {
  console.log("=========================================");
  console.log("  StudyDock Telegram History Sync Tool");
  console.log("=========================================\n");

  // Read current .env
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`${name}=(.*)`));
    return match ? match[1].trim() : "";
  };

  // 1. Get credentials
  let apiIdStr = getEnvVar("TELEGRAM_API_ID") || process.env.TELEGRAM_API_ID;
  let apiHash = getEnvVar("TELEGRAM_API_HASH") || process.env.TELEGRAM_API_HASH;
  let botToken = getEnvVar("TELEGRAM_BOT_TOKEN") || "8887541572:AAGTpmJcFkWk27BCyCYCRQzkYg8hac1U_Q8";
  let chatId = getEnvVar("TELEGRAM_CHAT_ID") || "";

  if (!apiIdStr || !apiHash) {
    console.log("To fetch historical messages, you need an API ID and API Hash.");
    console.log("Get them in 1 minute from: https://my.telegram.org (under API development tools)\n");
    
    if (!apiIdStr) {
      apiIdStr = await question("Enter your Telegram API ID: ");
    }
    if (!apiHash) {
      apiHash = await question("Enter your Telegram API Hash: ");
    }
  }

  if (!chatId) {
    chatId = await question("Enter your Telegram Group Chat ID (e.g. -1002244668800): ");
  }

  const apiId = parseInt(apiIdStr.trim(), 10);
  apiHash = apiHash.trim();
  botToken = botToken.trim();
  chatId = chatId.trim();

  if (isNaN(apiId) || !apiHash || !botToken || !chatId) {
    console.error("\n[Error] Invalid inputs. Please check your credentials and run again.");
    rl.close();
    process.exit(1);
  }

  // Update .env with variables
  const updatedVars = {
    TELEGRAM_API_ID: apiId,
    TELEGRAM_API_HASH: apiHash,
    TELEGRAM_BOT_TOKEN: botToken,
    TELEGRAM_CHAT_ID: chatId
  };

  let newEnv = envContent;
  for (const [k, v] of Object.entries(updatedVars)) {
    const regex = new RegExp(`^${k}=.*$`, "m");
    if (newEnv.match(regex)) {
      newEnv = newEnv.replace(regex, `${k}=${v}`);
    } else {
      newEnv += `\n${k}=${v}`;
    }
  }
  fs.writeFileSync(envPath, newEnv.trim() + "\n", "utf-8");
  console.log("\n✓ Settings saved to .env");

  // 2. Run Sync
  console.log("\nConnecting to Telegram MTProto servers...");
  const client = new TelegramClient(new sessions.StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      botAuthToken: botToken,
    });
    console.log("✓ Authenticated successfully!");

    console.log(`Fetching message history from group ${chatId} (this may take a few seconds)...`);
    
    // Fetch up to 1000 messages (supports full group history)
    const messages = await client.getMessages(chatId, { limit: 1000 });
    console.log(`✓ Fetched ${messages.length} messages from Telegram.`);

    const folders = [];
    const files = [];
    const topicsMap = {};

    // First, scan messages to identify all topics/folders
    for (const msg of messages) {
      const threadId = msg.replyTo?.replyToMsgId ? String(msg.replyTo.replyToMsgId) : "topic-general";
      
      // If we see a thread id and don't have it, add it
      if (threadId !== "topic-general" && !topicsMap[threadId]) {
        // Fallback name
        topicsMap[threadId] = `Thread ${threadId}`;
      }
    }

    // Try to get actual forum topic names (if API permits)
    try {
      const result = await client.invoke({
        className: 'messages.GetForumTopics',
        channel: chatId,
        offsetDate: 0,
        offsetId: 0,
        offsetTopic: 0,
        limit: 100,
      });
      if (result && result.topics) {
        for (const t of result.topics) {
          topicsMap[String(t.id)] = t.title;
        }
      }
    } catch (e) {
      console.log("Note: Could not fetch exact topic titles directly (bot permissions), falling back to Thread IDs.");
    }

    // Build folder list
    folders.push({
      id: "topic-general",
      name: "General Announcements",
      type: "folder",
      folderId: "topic-general",
    });

    for (const [tid, name] of Object.entries(topicsMap)) {
      folders.push({
        id: tid,
        name: name,
        type: "folder",
        folderId: tid,
      });
    }

    // Extract attachments/files
    console.log("Processing attachments and resolving download URLs...");
    for (const msg of messages) {
      if (!msg.media) continue;

      let fileObj = null;
      const threadId = msg.replyTo?.replyToMsgId ? String(msg.replyTo.replyToMsgId) : "topic-general";

      if (msg.media.document) {
        const doc = msg.media.document;
        const nameAttr = doc.attributes?.find(a => a.className === 'DocumentAttributeFilename');
        fileObj = {
          id: doc.id.toString(),
          uniqueId: doc.accessHash.toString(),
          name: nameAttr?.fileName || `document_${msg.id}`,
          mimeType: doc.mimeType || 'application/octet-stream',
          size: doc.size.toNumber ? doc.size.toNumber() : Number(doc.size),
          date: msg.date,
          msgId: msg.id
        };
      } else if (msg.media.photo) {
        const photo = msg.media.photo;
        fileObj = {
          id: photo.id.toString(),
          uniqueId: photo.accessHash.toString(),
          name: `photo_${msg.id}.jpg`,
          mimeType: 'image/jpeg',
          size: 0, // photos don't always expose file size directly in msg
          date: msg.date,
          msgId: msg.id
        };
      }

      if (fileObj) {
        // Resolve URL using Bot API's file ID or set null if too large
        // We will generate the classic Bot API file ID structure or fetch it
        // To be safe, we can fetch it or reference msg.id
        const directUrl = await fetchFileUrl(botToken, fileObj.id);

        const fileType = getFileType(fileObj.mimeType);
        const modifiedTime = new Date(fileObj.date * 1000).toISOString();

        files.push({
          id: fileObj.id,
          uniqueId: fileObj.uniqueId,
          name: fileObj.name,
          fileType,
          typeLabel: getTypeLabel(fileType),
          size: fileObj.size,
          formattedSize: formatSize(fileObj.size),
          modifiedTime,
          formattedDate: new Date(modifiedTime).toLocaleDateString(),
          extension: fileObj.name.split('.').pop() || '',
          url: directUrl,
          tgFileId: fileObj.id,
          messageId: fileObj.msgId,
          parents: [threadId],
        });
      }
    }

    // Save to src/data/telegram_history.json
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify({ folders, files }, null, 2), "utf-8");
    console.log(`\n✓ Successfully synced history! Saved ${files.length} files and ${folders.length} topics to:`);
    console.log(`  ${outputPath}`);

  } catch (err) {
    console.error("\n[Error] Sync failed:", err);
  } finally {
    await client.disconnect();
    rl.close();
  }
}

main();
