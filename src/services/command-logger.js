const path = require("node:path");
const { query } = require(path.join(__dirname, "../database/db.js"));

/**
 * @param {import("discord.js").Client} client
 * @param {import("discord.js").Message} message
 * @param {string} commandName
 * @param {string} status
 * @param {Record<string, unknown>} [details]
 */
async function logCommand(
  client,
  message,
  commandName,
  status,
  details = {}
) {
  const timezone = process.env.TIMEZONE || "UTC";
  const guildId = message.guild?.id || null;
  const guildName = message.guild?.name || null;
  const channelId = message.channelId || null;
  const channelName =
    message.channel && "name" in message.channel
      ? message.channel.name
      : null;

  const result = await query(
    `INSERT INTO command_logs (
       command_name,
       user_id,
       user_mention,
       guild_id,
       guild_name,
       channel_id,
       channel_name,
       timezone_name,
       status,
       details
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     RETURNING id, executed_at`,
    [
      commandName,
      message.author.id,
      `<@${message.author.id}>`,
      guildId,
      guildName,
      channelId,
      channelName,
      timezone,
      status,
      JSON.stringify(details)
    ]
  );

  const record = result.rows[0];
  const timestamp = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "long",
    hour12: false
  }).format(new Date(record.executed_at));

  const logChannelId = process.env.LOGS_CHANNEL_ID;

  if (!logChannelId) {
    console.error("[Logger] LOGS_CHANNEL_ID is not configured.");
    return;
  }

  const logChannel = await client.channels
    .fetch(logChannelId)
    .catch(() => null);

  if (
    !logChannel ||
    !logChannel.isTextBased() ||
    !("send" in logChannel)
  ) {
    console.error("[Logger] Configured logs channel is unavailable.");
    return;
  }

  const safeDetails = JSON.stringify(details, null, 2)
    .slice(0, 1200);

  const logMessage = [
    "## Sparten Systems — Command Log",
    `**Log ID:** ${record.id}`,
    `**Command:** \`${commandName}\``,
    `**User:** <@${message.author.id}> (\`${message.author.id}\`)`,
    `**Server:** ${guildName || "Direct Message"} (\`${guildId || "N/A"}\`)`,
    `**Channel:** ${channelName || "Unknown"} (\`${channelId || "N/A"}\`)`,
    `**Timestamp:** ${timestamp} (${timezone})`,
    `**Status:** ${status}`,
    "```json",
    safeDetails || "{}",
    "```"
  ].join("\n");

  await logChannel.send({
    content: logMessage,
    allowedMentions: { parse: [] }
  });
}

module.exports = { logCommand };