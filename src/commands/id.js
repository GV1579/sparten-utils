/**
 * @param {import("discord.js").Message} message
 * @param {string[]} args
 */

async function execute(message, args) {
  const target = message.mentions.users.first();
  const user = target || message.author;

  await message.reply({
    content: [
      `**User:** <@${user.id}>`,
      `**User ID:** \`${user.id}\``
    ].join("\n"),
    allowedMentions: { parse: [] }
  });
}

module.exports = {
  name: "id",
  execute
};