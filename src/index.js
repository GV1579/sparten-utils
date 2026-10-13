
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
} = require("discord.js");

const path = require("node:path");

const { initializeDatabase, closeDatabase } = require("./database/db");
const { checkCommandPermission, getCustomError } = require("./services/permissions");
const { logCommand } = require("./services/command-logger");

const commands = [
  require("./commands/embed"),
  require("./commands/id"),
  require("./commands/ping"),
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = process.env.PREFIX || "!";
const COMMAND_COOLDOWN_MS = Number(
  process.env.COMMAND_COOLDOWN_MS || 1000
);

const cooldowns = new Map();
const commandMap = new Map(
  commands.map((command) => [command.name.toLowerCase(), command])
);

function getCommandErrorKey(error) {
  const message = String(error?.message || "");

  if (/invalid json|json is invalid/i.test(message)) {
    return "invalid_json";
  }

  if (/usage:|arguments|required|channel id is invalid/i.test(message)) {
    return "invalid_arguments";
  }

  return "command_failed";
}

async function sendCommandError(message, errorKey, fallback) {
  let response = fallback;

  try {
    response = await getCustomError(errorKey) || fallback;
  } catch (databaseError) {
    console.error("Could not retrieve custom command error:", databaseError);
  }

  await message.reply({
    content: String(response).slice(0, 1900),
    allowedMentions: { repliedUser: false },
  });
}

async function handleMessage(message) {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  // Keep this bot restricted to the configured test server.
  if (
    process.env.SPARTEN_GUILD_ID &&
    message.guild.id !== process.env.SPARTEN_GUILD_ID
  ) {
    return;
  }

  const content = message.content.slice(PREFIX.length).trim();
  if (!content) return;

  const firstSpace = content.search(/\s/);
  const commandName = (
    firstSpace === -1 ? content : content.slice(0, firstSpace)
  ).toLowerCase();

  const args = firstSpace === -1
    ? []
    : content.slice(firstSpace).trim().split(/\s+/).filter(Boolean);

  const command = commandMap.get(commandName);
  if (!command) return;

  const startedAt = Date.now();
  let status = "success";
  let details = "Command completed successfully.";

  try {
    const permission = await checkCommandPermission({
      commandName,
      userId: message.author.id,
      roleIds: [...message.member.roles.cache.keys()],
    });

    if (!permission.allowed) {
      status = "denied";
      details = "Permission denied.";

      await sendCommandError(
        message,
        "permission_denied",
        "You do not have permission to use this command."
      );

      return;
    }

    const cooldownKey = `${message.guild.id}:${message.author.id}:${commandName}`;
    const now = Date.now();
    const lastUsed = cooldowns.get(cooldownKey) || 0;
    const remaining = COMMAND_COOLDOWN_MS - (now - lastUsed);

    if (remaining > 0) {
      status = "denied";
      details = "Command cooldown triggered.";

      await message.reply({
        content: `Please wait ${Math.ceil(remaining / 1000)} second(s) before using this command again.`,
        allowedMentions: { repliedUser: false },
      });

      return;
    }

    cooldowns.set(cooldownKey, now);

    await command.execute(message, args);
  } catch (error) {
    status = "failed";
    details = String(error?.message || "Unknown error").slice(0, 500);

    console.error(`Command "${commandName}" failed:`, error);

    try {
      await sendCommandError(
        message,
        getCommandErrorKey(error),
        "An unexpected error occurred while running that command."
      );
    } catch (replyError) {
      console.error("Could not send command error response:", replyError);
    }
  } finally {
    try {
      await logCommand({
        client,
        guildId: message.guild.id,
        channelId: message.channel.id,
        userId: message.author.id,
        username: message.author.tag,
        commandName,
        status,
        details,
        durationMs: Date.now() - startedAt,
        timestamp: new Date(),
      });
    } catch (loggingError) {
      console.error("Command logging failed:", loggingError);
    }
  }
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`Prefix: ${PREFIX}`);
  console.log(`Loaded ${commandMap.size} commands.`);
});

client.on(Events.MessageCreate, (message) => {
  handleMessage(message).catch((error) => {
    console.error("Message handler failed:", error);
  });
});

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down...`);

  client.destroy();

  try {
    await closeDatabase();
  } catch (error) {
    console.error("Database shutdown failed:", error);
  }

  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

async function start() {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error("Missing DISCORD_TOKEN in your .env file.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL in your .env file.");
  }

  await initializeDatabase();
  await client.login(process.env.DISCORD_TOKEN);
}

start().catch((error) => {
  console.error("Failed to start Sparten Systems:", error);
  process.exitCode = 1;
});