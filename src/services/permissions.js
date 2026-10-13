const databaseModulePath = "../database/db";
const { query } = require(databaseModulePath);

/**
 * @param {string} commandName
 * @param {import("discord.js").Message} message
 * @returns {Promise<{allowed: boolean, errorKey: string | null}>}
 */
async function checkCommandPermission(commandName, message) {
  const result = await query(
    `SELECT user_id, role_id
     FROM command_permissions
     WHERE LOWER(command_name) = LOWER($1)`,
    [commandName]
  );

  if (result.rows.length === 0) {
    return {
      allowed: false,
      errorKey: "permission_unconfigured"
    };
  }

  for (const permission of result.rows) {
    if (
      permission.user_id &&
      permission.user_id === message.author.id
    ) {
      return { allowed: true, errorKey: null };
    }

    if (
      permission.role_id &&
      message.guild &&
      message.member &&
      message.member.roles.cache.has(permission.role_id)
    ) {
      return { allowed: true, errorKey: null };
    }
  }

  return {
    allowed: false,
    errorKey: "permission_denied"
  };
}

/**
 * @param {string} errorKey
 * @returns {Promise<string>}
 */
async function getCustomError(errorKey) {
  const result = await query(
    `SELECT error_message
     FROM custom_errors
     WHERE error_key = $1`,
    [errorKey]
  );

  if (result.rows.length > 0) {
    return result.rows[0].error_message;
  }

  return "You cannot use this command.";
}

module.exports = {
  checkCommandPermission,
  getCustomError
};