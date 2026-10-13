const {
  MessageFlags,
  WebhookClient
} = require("discord.js");

const MAX_LENGTH = Number(
  process.env.MAX_EMBED_JSON_LENGTH || 25000
);

/**
 * @param {string} json
 * @returns {Record<string, any>}
 */
function parsePayload(json) {
  if (json.length > MAX_LENGTH) {
    throw new Error("The JSON payload is too large.");
  }

  let payload;

  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error("The supplied JSON is invalid.");
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error("The JSON must be an object.");
  }

  if (
    "allowed_mentions" in payload ||
    "allowedMentions" in payload
  ) {
    throw new Error(
      "Custom allowed-mentions settings are not permitted."
    );
  }

  return payload;
}

/**
 * @param {string} value
 * @returns {string}
 */
function validateWebhookUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error("The webhook URL is invalid.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "discord.com" ||
    url.port ||
    !/^\/api\/webhooks\/\d+\/[\w.-]+\/?$/.test(url.pathname)
  ) {
    throw new Error("Only official Discord webhook URLs are allowed.");
  }

  return url.toString();
}

/**
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 * @returns {Promise<void>}
 */
async function execute(message, args) {
  const prefix = process.env.PREFIX || "!";

  const commandText = message.content
    .slice(prefix.length)
    .trim();

  const separator = commandText.indexOf(" ");

  if (separator === -1) {
    throw new Error(
      'Usage: !embed {"embeds":[...]} | CHANNEL_ID'
    );
  }

  const rawArguments = commandText.slice(separator).trim();

  const parts = rawArguments
    .split("|")
    .map(/** @param {string} part */ (part) => part.trim());

  if (parts.length < 2 || parts.length > 3) {
    throw new Error(
      'Usage: !embed {"embeds":[...]} | CHANNEL_ID | WEBHOOK_URL'
    );
  }

  const payload = parsePayload(parts[0]);

  const channelId =
    parts[1].toLowerCase() === "null"
      ? null
      : parts[1];

  const webhookUrl =
    parts[2] && parts[2].toLowerCase() !== "null"
      ? validateWebhookUrl(parts[2])
      : null;

  if (!channelId && !webhookUrl) {
    throw new Error("A channel ID or webhook URL is required.");
  }

  const outgoing = /** @type {Record<string, any>} */ ({
    ...payload,
    allowedMentions: {
      parse: []
    }
  });

  if (outgoing.flags === 32768) {
    outgoing.flags = MessageFlags.IsComponentsV2;
  }

  if (webhookUrl) {
    const webhook = new WebhookClient({
      url: webhookUrl
    });

    try {
      await webhook.send(outgoing);
    } finally {
      webhook.destroy();
    }

    await message.reply("Payload sent through the webhook.");
    return;
  }

  if (!channelId) {
    throw new Error("A channel ID is required.");
  }

  if (!/^\d{17,20}$/.test(channelId)) {
    throw new Error("The channel ID is invalid.");
  }

  const channel = await message.client.channels.fetch(channelId);

  if (
    !channel ||
    !channel.isTextBased() ||
    !("send" in channel)
  ) {
    throw new Error("The target channel is not a supported text channel.");
  }

  await channel.send(outgoing);

  await message.reply("Payload sent to the requested channel.");
}

module.exports = {
  name: "embed",
  execute
};