/**
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */
async function execute(message, args) {
  if (args[0]?.toLowerCase() !== "ms") {
    await message.reply("Pong!");
    return;
  }

  const start = Date.now();

  const reply = await message.reply("Pong!");

  const responseTime = Date.now() - start;
  const gatewayLatency = Math.round(message.client.ws.ping);

  await reply.edit({
    content:
      "## Pong!\n" +
      `**Response time:** ${responseTime} ms\n` +
      `**Gateway latency:** ${gatewayLatency} ms`
  });
}

module.exports = {
  name: "ping",
  execute
};