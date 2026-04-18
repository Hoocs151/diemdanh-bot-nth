/**
 * Event: guildMemberRemove
 * Khi member rời guild - cảnh báo admin
 */

import { logger } from '../utils/logger.js';

/**
 * Xử lý khi một thành viên rời khỏi guild
 * @param {import('discord.js').GuildMember} member
 */
export async function handleGuildMemberRemove(member) {
  // Không cần làm gì ở đây vì cleanup là thủ công
  // Để lại hook cho tương lai mở rộng
  logger.debug('EVENT', `Member rời guild: ${member.user.tag} (${member.user.id})`);
}
