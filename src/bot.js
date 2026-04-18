/**
 * BANG CHIEN BOT - Entry Point v1.2
 * Bot Discord điểm danh thành viên tham gia bang chiến
 *
 * Stack: Node.js + discord.js v14 + better-sqlite3
 *
 * Tính năng:
 * - Slash commands: tạo, khóa, đặt lại, chốt, xuất, xóa, sửa, help, cleanup, backup
 * - Button interactions: đăng ký/hủy/chuyển phái
 * - SQLite database với WAL mode
 * - Audit log đầy đủ
 * - Chống spam & debounce + rate limit slash commands
 * - Phân quyền 3 cấp (admin/officer/member)
 * - Backup tự động theo cron
 * - Google Sheets export
 * - Xóa người rời guild
 */

import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  InteractionType,
  MessageFlags,
} from 'discord.js';

import { CONFIG, validateConfig, debugConfig } from './config/index.js';
import { SESSION_STATUS, BUTTON_IDS, PAGINATION } from './config/constants.js';
import { initDatabase, closeDatabase, getDb } from './database/index.js';
import { sessionRepo, regRepo, auditRepo } from './database/index.js';
import { logger, withErrorHandler } from './utils/logger.js';
import { buildRegistrationEmbed, buildActionEmbed } from './utils/embedBuilder.js';
import { buildAllComponents } from './utils/buttonBuilder.js';
import { parseButtonFaction, isAdminButton } from './utils/buttonBuilder.js';
import { UserDebouncer } from './utils/helpers.js';
import { SlashRateLimiter } from './utils/rateLimiter.js';
import { hasAdminRole } from './middleware/permissions.js';
import { getFactionName, getFactionEmoji } from './config/factions.js';
import { initScheduler, destroyScheduler } from './jobs/scheduler.js';
import { handleGuildMemberRemove } from './events/index.js';
import { handlePreviewButton, isTaoPhienButton } from './commands/slash/tao.js';

// ================================
// 1. TẠO DISCORD CLIENT
// ================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// ================================
// 2. STORE & STATE
// ================================

/** Debouncer chống spam click */
const userDebouncer = new UserDebouncer(CONFIG.DEBOUNCE_MS);

/** Rate limiter cho slash commands */
const slashRateLimiter = new SlashRateLimiter(
  CONFIG.SLASH_RATE_LIMIT_COUNT,
  CONFIG.SLASH_RATE_LIMIT_WINDOW_MS
);

/** Cache các command handlers */
const commandHandlers = new Collection();

/** Debouncer cho updateSessionMessage - tránh spam API khi nhiều user click cùng lúc */
const messageUpdateDebouncer = new Collection();

/** Cache pagination state cho từng message (key: messageId, value: currentPage) */
const paginationState = new Collection();

// ================================
// 3. KHỞI TẠO
// ================================

client.once('clientReady', withErrorHandler(async () => {
  logger.info('BOT', `Bot đã khởi động! Tên: ${client.user?.tag ?? 'Unknown'}`);

  // Validate config
  try {
    validateConfig();
    logger.info('CONFIG', 'Cấu hình hợp lệ');
    if (CONFIG.LOG_LEVEL === 'debug') {
      debugConfig();
    }
  } catch (err) {
    logger.error('CONFIG', err.message);
    process.exit(1);
  }

  // Khởi tạo database
  try {
    initDatabase();
    logger.info('BOT', 'Database đã sẵn sàng');
  } catch (err) {
    logger.error('BOT', `Lỗi khởi tạo database: ${err.message}`);
    process.exit(1);
  }

  // Khởi tạo scheduler jobs (backup tự động, persistence timer)
  initScheduler();

  // Đăng ký slash commands
  await registerCommands();

  logger.info('BOT', 'Sẵn sàng phục vụ!');
}, 'CLIENT_READY'));

// ================================
// 4. ĐĂNG KÝ SLASH COMMANDS
// ================================

async function registerCommands() {
  // Tất cả command files (thêm help, cleanup, backup)
  const commandFiles = [
    './commands/slash/tao.js',
    './commands/slash/ds.js',
    './commands/slash/khoa.js',
    './commands/slash/datlai.js',
    './commands/slash/chot.js',
    './commands/slash/xuat.js',
    './commands/slash/xoa.js',
    './commands/slash/sua.js',
    './commands/slash/help.js',     // [NEW] Lệnh help
    './commands/slash/cleanup.js',  // [NEW] Cleanup người rời guild
    './commands/slash/backup.js',   // [NEW] Backup thủ công
  ];

  const commands = [];

  for (const file of commandFiles) {
    try {
      const mod = await import(file);
      const cmd = mod.data;
      if (cmd) {
        commandHandlers.set(cmd.name, mod);
        commands.push(cmd);
      }
    } catch (err) {
      logger.error('CMD', `Lỗi load command ${file}: ${err.message}`);
    }
  }

  // Đăng ký commands (xóa commands cũ trước rồi set lại)
  try {
    await client.application.commands.set([]);
    await client.application.commands.set(commands);
    logger.info('CMD', `Đã đăng ký ${commands.length} slash commands`);
  } catch (err) {
    logger.error('CMD', `Lỗi đăng ký commands: ${err.message}`);
  }
}

// ================================
// 5. XỬ LÝ INTERACTIONS
// ================================

client.on('interactionCreate', withErrorHandler(async (interaction) => {
  // === SLASH COMMAND ===
  if (interaction.type === InteractionType.ApplicationCommand) {
    const cmdName = interaction.commandName;
    const handler = commandHandlers.get(cmdName);

    if (!handler?.execute) {
      logger.warn('INTERACTION', `Command không có handler: ${cmdName}`);
      return;
    }

    // === RATE LIMIT SLASH COMMANDS ===
    const rateLimitResult = slashRateLimiter.try(interaction.user.id);
    if (!rateLimitResult.allowed) {
      const seconds = Math.ceil(rateLimitResult.resetIn / 1000);
      await interaction.reply({
        content: `⚠️ Bạn thao tác quá nhanh! Vui lòng chờ **${seconds}s**.\n(Còn ${rateLimitResult.remaining} lệnh trong ${Math.round(CONFIG.SLASH_RATE_LIMIT_WINDOW_MS / 1000)}s)`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
      return;
    }

    try {
      await handler.execute(interaction);
    } catch (err) {
      logger.error('CMD', `Lỗi thực hiện ${cmdName}: ${err.message}`, { stack: err.stack });

      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Đã xảy ra lỗi khi thực hiện lệnh. Vui lòng thử lại.\n\`${err.message}\``,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: `❌ Đã xảy ra lỗi: \`${err.message}\``,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
    return;
  }

  // === BUTTON INTERACTION ===
  if (interaction.type === InteractionType.MessageComponent) {
    if (!interaction.isButton()) return;
    await handleButtonInteraction(interaction);
    return;
  }
}, 'INTERACTION'));

// ================================
// 6. BUTTON HANDLER - LOGIC CHÍNH
// ================================

async function handleButtonInteraction(interaction) {
  const { customId } = interaction;

  // === TAO PHIEN PREVIEW BUTTONS ===
  if (isTaoPhienButton(customId)) {
    await handlePreviewButton(interaction);
    return;
  }

  // === PAGINATION BUTTONS ===
  if (customId === PAGINATION.PREV_PAGE || customId === PAGINATION.NEXT_PAGE) {
    await handlePaginationButton(interaction, customId);
    return;
  }

  // === ADMIN BUTTONS ===
  if (isAdminButton(customId)) {
    await handleAdminButton(interaction);
    return;
  }

  // === REGISTRATION BUTTONS ===
  const factionId = parseButtonFaction(customId);
  if (!factionId) {
    logger.warn('BUTTON', `Custom ID không nhận diện: ${customId}`);
    return;
  }

  await handleRegistrationButton(interaction, factionId);
}

/**
 * Xử lý button đăng ký / hủy / chuyển phái
 */
async function handleRegistrationButton(interaction, factionId) {
  const { user, message, channel } = interaction;

  // === CHỐNG SPAM DEBOUNCE ===
  if (!userDebouncer.try(user.id)) {
    await interaction.reply({
      embeds: [
        buildActionEmbed('rate_limit', null, null),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Tìm session từ message
  let session;
  if (message?.id) {
    const dbSession = sessionRepo.getSessionByMessageId(message.id);
    session = dbSession;
  }

  // Nếu không tìm thấy, thử tìm bằng channel_id + guild
  if (!session) {
    const sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);
    session = sessions.find(
      (s) =>
        s.channel_id === channel.id &&
        (s.status === 'open' || s.status === 'locked')
    );
  }

  if (!session) {
    await interaction.reply({
      content: 'Không tìm thấy phiên điểm danh.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // === KIỂM TRA TRẠNG THÁI PHIÊN ===
  if (session.status === SESSION_STATUS.LOCKED) {
    await interaction.reply({
      embeds: [buildActionEmbed('locked', null, null)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (session.status === SESSION_STATUS.CLOSED) {
    await interaction.reply({
      content: 'Phiên đã kết thúc. Không thể đăng ký.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const factionName = getFactionName(factionId);
  const factionEmoji = getFactionEmoji(factionId);

  // === KIỂM TRA ĐĂNG KÝ HIỆN TẠI ===
  const existingReg = regRepo.getRegistration(session.id, user.id);
  const existingWaitlist = regRepo.getWaitlistEntry(session.id, user.id);

  // === NẾU USER ĐANG ĐĂNG KÝ Ở PHÁI KHÁC ===
  if (existingReg && existingReg.faction_id !== factionId) {
    // Xóa đăng ký cũ
    regRepo.unregisterUser(session.id, user.id);

    // Thử đăng ký phái mới
    const currentCount = regRepo.countFactionMembers(session.id, factionId);
    const max = session.max_per_faction || 0;

    if (max > 0 && currentCount >= max) {
      // Phái đầy -> thêm vào waitlist
      const waitlistPos = regRepo.addToWaitlist(session.id, user.id, user.displayName, factionId);
      await interaction.reply({
        embeds: [buildActionEmbed('waitlist', factionName, factionEmoji, waitlistPos.position)],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // Phái còn chỗ -> đăng ký bình thường
      regRepo.registerUser(session.id, user.id, user.displayName, factionId);
      await interaction.reply({
        embeds: [buildActionEmbed('switched', factionName, factionEmoji)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await updateSessionMessage(session, interaction.guild);
    logger.info('BUTTON', `${user.displayName} chuyển phái ${existingReg.faction_id} -> ${factionId} (phiên ${session.id.slice(0, 8)})`);
    return;
  }

  // === NẾU USER ĐANG Ở WAITLIST ===
  if (existingWaitlist) {
    if (existingWaitlist.faction_id === factionId) {
      // Click đúng phái đang chờ -> xóa khỏi waitlist
      regRepo.removeFromWaitlist(session.id, user.id, user.id, user.displayName);
      await interaction.reply({
        embeds: [buildActionEmbed('waitlist_cancelled', factionName, factionEmoji)],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // Click phái khác -> chuyển waitlist sang phái mới
      regRepo.removeFromWaitlist(session.id, user.id, user.id, user.displayName);
      regRepo.addToWaitlist(session.id, user.id, user.displayName, factionId);
      await interaction.reply({
        embeds: [buildActionEmbed('waitlist_moved', factionName, factionEmoji)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await updateSessionMessage(session, interaction.guild);
    logger.info('BUTTON', `${user.displayName} cập nhật waitlist phái ${factionId} (phiên ${session.id.slice(0, 8)})`);
    return;
  }

  // === NẾU USER ĐANG ĐĂNG KÝ Ở PHÁI NÀY ===
  if (existingReg && existingReg.faction_id === factionId) {
    // Click đúng phái -> hủy đăng ký
    regRepo.unregisterUser(session.id, user.id);

    // Kiểm tra waitlist để tự động thêm người từ waitlist
    const waitlistFirst = regRepo.popFromWaitlist(session.id, factionId);
    if (waitlistFirst) {
      regRepo.registerUser(session.id, waitlistFirst.userId, waitlistFirst.userName, factionId);
      logger.info('WAITLIST', `${waitlistFirst.userName} được thêm từ waitlist vào phái ${factionId}`);
    }

    await interaction.reply({
      embeds: [buildActionEmbed('unregistered', factionName, factionEmoji)],
      flags: MessageFlags.Ephemeral,
    });

    await updateSessionMessage(session, interaction.guild);
    logger.info('BUTTON', `${user.displayName} hủy đăng ký phái ${factionId} (phiên ${session.id.slice(0, 8)})`);
    return;
  }

  // === USER CHƯA ĐĂNG KÝ -> ĐĂNG KÝ MỚI ===
  const currentCount = regRepo.countFactionMembers(session.id, factionId);
  const max = session.max_per_faction || 0;

  if (max > 0 && currentCount >= max) {
    // Phái đầy -> thêm vào waitlist
    const waitlistPos = regRepo.addToWaitlist(session.id, user.id, user.displayName, factionId);
    await interaction.reply({
      embeds: [buildActionEmbed('waitlist', factionName, factionEmoji, waitlistPos.position)],
      flags: MessageFlags.Ephemeral,
    });
  } else {
    // Phái còn chỗ -> đăng ký bình thường
    regRepo.registerUser(session.id, user.id, user.displayName, factionId);
    await interaction.reply({
      embeds: [buildActionEmbed('registered', factionName, factionEmoji)],
      flags: MessageFlags.Ephemeral,
    });
  }

  await updateSessionMessage(session, interaction.guild);
  logger.info('BUTTON', `${user.displayName} đăng ký phái ${factionId} (phiên ${session.id.slice(0, 8)})`);
}

/**
 * Xử lý nút phân trang
 */
async function handlePaginationButton(interaction, buttonId) {
  const { message } = interaction;

  // Lấy session từ message
  let session;
  if (message?.id) {
    session = sessionRepo.getSessionByMessageId(message.id);
  }

  if (!session) {
    await interaction.reply({
      content: '❌ Không tìm thấy phiên.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Lấy trang hiện tại hoặc mặc định là 0
  const currentPage = paginationState.get(message.id) || 0;
  const membersPerPage = PAGINATION.MEMBERS_PER_PAGE;

  // Tính trang mới
  let newPage = currentPage;
  if (buttonId === PAGINATION.NEXT_PAGE) {
    newPage = currentPage + 1;
  } else if (buttonId === PAGINATION.PREV_PAGE) {
    newPage = Math.max(0, currentPage - 1);
  }

  // Kiểm tra trang có hợp lệ không
  const registrations = regRepo.getRegistrationsBySession(session.id);
  const maxPage = Object.values(registrations).reduce((max, arr) => {
    const pages = Math.ceil(arr.length / membersPerPage) - 1;
    return Math.max(max, pages);
  }, 0);

  if (newPage > maxPage) {
    newPage = maxPage;
  }

  // Cập nhật pagination state
  paginationState.set(message.id, newPage);

  // Defer để update message
  await interaction.deferUpdate();

  // Lấy waitlists và build embed mới
  const waitlists = regRepo.getAllWaitlists(session.id);
  const embed = buildRegistrationEmbed(session, registrations, interaction.guild, waitlists, newPage);
  const components = buildAllComponents(session, registrations, newPage);

  await message.edit({ embeds: [embed], components });
  logger.info('PAGINATION', `Chuyển trang -> ${newPage + 1} (phiên ${session.id.slice(0, 8)})`);
}

/**
 * Xử lý các nút admin trên message
 */
async function handleAdminButton(interaction) {
  const { customId, message, channel } = interaction;

  // Chỉ admin/officer mới được bấm
  if (!hasAdminRole(interaction)) {
    await interaction.reply({
      content: '❌ Bạn không có quyền sử dụng nút này.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Tìm session
  let session;
  if (message?.id) {
    session = sessionRepo.getSessionByMessageId(message.id);
  }
  if (!session) {
    const sessions = sessionRepo.getSessionsByGuild(interaction.guild.id);
    session = sessions.find((s) => s.channel_id === channel.id);
  }

  if (!session) {
    await interaction.reply({ content: '❌ Không tìm thấy phiên.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Defer để có thời gian xử lý
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  switch (customId) {
    case BUTTON_IDS.KHOA:
      await actionLock(interaction, session);
      break;
    case BUTTON_IDS.MOKHOA:
      await actionUnlock(interaction, session);
      break;
    case BUTTON_IDS.RESET:
      await actionReset(interaction, session);
      break;
    case BUTTON_IDS.CHOT:
      await actionClose(interaction, session);
      break;
    case BUTTON_IDS.XUAT:
      await actionExport(interaction, session);
      break;
    case BUTTON_IDS.XOA:
      await actionDelete(interaction, session);
      break;
    default:
      await interaction.editReply({ content: '❌ Hành động không hỗ trợ.' });
  }
}

// ================================
// 7. ADMIN ACTIONS
// ================================

async function actionLock(interaction, session) {
  if (session.status === SESSION_STATUS.LOCKED) {
    return interaction.editReply({ content: '⚠️ Phiên đã bị khóa.' });
  }

  sessionRepo.updateSessionStatus(session.id, SESSION_STATUS.LOCKED, interaction.user.id, interaction.user.displayName);
  auditRepo.logLock(session.id, interaction.user.id, interaction.user.displayName, true);

  const updatedSession = { ...session, status: SESSION_STATUS.LOCKED };
  await updateSessionMessage(updatedSession, interaction.guild);

  await interaction.editReply({ content: '🔒 Phiên đã bị khóa.' });
  logger.info('ADMIN', `${interaction.user.displayName} khóa phiên ${session.id.slice(0, 8)}`);
}

async function actionUnlock(interaction, session) {
  if (session.status !== SESSION_STATUS.LOCKED) {
    return interaction.editReply({ content: '⚠️ Phiên không bị khóa.' });
  }

  sessionRepo.updateSessionStatus(session.id, SESSION_STATUS.OPEN, interaction.user.id, interaction.user.displayName);
  auditRepo.logLock(session.id, interaction.user.id, interaction.user.displayName, false);

  const updatedSession = { ...session, status: SESSION_STATUS.OPEN };
  await updateSessionMessage(updatedSession, interaction.guild);

  await interaction.editReply({ content: '🔓 Phiên đã được mở khóa.' });
  logger.info('ADMIN', `${interaction.user.displayName} mở khóa phiên ${session.id.slice(0, 8)}`);
}

async function actionReset(interaction, session) {
  if (session.status === SESSION_STATUS.CLOSED) {
    return interaction.editReply({ content: 'Phiên đã kết thúc, không thể đặt lại.' });
  }

  const total = regRepo.getTotalRegistrations(session.id);

  sessionRepo.resetSessionRegistrations(session.id);
  auditRepo.logReset(session.id, interaction.user.id, interaction.user.displayName);

  await updateSessionMessage(session, interaction.guild);

  await interaction.editReply({
    content: 'Đã đặt lại danh sách. Đã xóa ' + total + ' người đăng ký và danh sách dự bị.',
  });
  logger.info('ADMIN', `${interaction.user.displayName} đặt lại phiên ${session.id.slice(0, 8)}, xóa ${total} người`);
}

async function actionClose(interaction, session) {
  if (session.status === SESSION_STATUS.CLOSED) {
    return interaction.editReply({ content: '⚠️ Phiên đã được chốt.' });
  }

  sessionRepo.updateSessionStatus(session.id, SESSION_STATUS.CLOSED, interaction.user.id, interaction.user.displayName);
  auditRepo.logClose(session.id, interaction.user.id, interaction.user.displayName);

  const closedSession = { ...session, status: SESSION_STATUS.CLOSED };
  const registrations = regRepo.getRegistrationsBySession(session.id);

  // Cập nhật message chính
  await updateSessionMessage(closedSession, interaction.guild);

  // Gửi DM cho user đã đăng ký (non-blocking)
  const { FACTION_ORDER, FACTION_MAP } = await import('./config/factions.js');
  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);

  let summary = `📊 **PHIÊN ĐÃ CHỐT - ${session.name}**\n`;
  summary += `Tổng: **${total} người**\n\n`;

  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    if (members.length === 0) continue;
    summary += `${f.emoji} ${f.name}: ${members.length}\n`;
    summary += `   ${members.map((m) => m.userName).join(', ')}\n`;
  }

  await interaction.editReply({ content: `✅ Phiên đã được chốt đóng.\n${summary}` });
  logger.info('ADMIN', `${interaction.user.displayName} chốt phiên ${session.id.slice(0, 8)}, ${total} người`);
}

async function actionExport(interaction, session) {
  const registrations = regRepo.getRegistrationsBySession(session.id);
  const waitlists = regRepo.getAllWaitlists(session.id);
  const total = Object.values(registrations).reduce((sum, arr) => sum + arr.length, 0);
  const waitlistTotal = Object.values(waitlists).reduce((sum, arr) => sum + arr.length, 0);
  const { FACTION_ORDER, FACTION_MAP } = await import('./config/factions.js');

  let text = 'DANH SÁCH - ' + session.name + '\n';
  text += 'Tổng: ' + total + ' người\n';

  for (const fid of FACTION_ORDER) {
    const f = FACTION_MAP[fid];
    const members = registrations[fid] || [];
    const wlist = waitlists[fid] || [];
    text += f.emoji + ' **' + f.name + '** (' + members.length + '):\n';
    if (members.length === 0) {
      text += '   _trống_\n';
    } else {
      for (let i = 0; i < members.length; i++) {
        text += '   ' + (i + 1) + '. ' + members[i].userName + '\n';
      }
    }
    if (wlist.length > 0) {
      text += '   (Dự bị: ';
      text += wlist.map((w) => w.position + '. ' + w.userName).join(', ');
      text += ')\n';
    }
    text += '\n';
  }

  if (waitlistTotal > 0) {
    text += 'Tổng dự bị: ' + waitlistTotal + ' người\n';
  }

  auditRepo.logExport(session.id, interaction.user.id, interaction.user.displayName, 'button');

  await interaction.editReply({ content: text || 'Chưa có người đăng ký.' });
  logger.info('ADMIN', `${interaction.user.displayName} xuất danh sách phiên ${session.id.slice(0, 8)}`);
}

async function actionDelete(interaction, session) {
  if (session.status !== SESSION_STATUS.CLOSED) {
    return interaction.editReply({ content: '❌ Chỉ có thể xóa phiên đã chốt.' });
  }

  // Xóa message
  if (session.message_id) {
    try {
      const ch = interaction.guild.channels.cache.get(session.channel_id);
      if (ch) {
        const msg = await ch.messages.fetch(session.message_id);
        await msg.delete();
      }
    } catch {
      // Message có thể đã bị xóa
    }
  }

  sessionRepo.deleteSession(session.id);
  auditRepo.logDelete(session.id, interaction.user.id, interaction.user.displayName);

  await interaction.editReply({ content: '🗑️ Phiên đã được xóa.' });
  logger.info('ADMIN', `${interaction.user.displayName} xóa phiên ${session.id.slice(0, 8)}`);
}

// ================================
// 8. HELPER: CẬP NHẬT MESSAGE
// ================================

/** Thời gian debounce cho updateSessionMessage (ms) */
const MESSAGE_UPDATE_DEBOUNCE_MS = 2000;

/**
 * Cập nhật message với debounce - tránh spam API khi nhiều user click cùng lúc
 */
async function updateSessionMessage(session, guild) {
  const key = session.id;

  // Nếu đang có timer cho session này, hủy và đặt lại
  if (messageUpdateDebouncer.has(key)) {
    clearTimeout(messageUpdateDebouncer.get(key));
  }

  // Đặt timer debounce
  const timer = setTimeout(async () => {
    messageUpdateDebouncer.delete(key);
    await doUpdateSessionMessage(session, guild);
  }, MESSAGE_UPDATE_DEBOUNCE_MS);

  messageUpdateDebouncer.set(key, timer);
}

async function doUpdateSessionMessage(session, guild) {
  let channel;
  let messageId;

  if (session.message_id) {
    const ch = guild.channels.cache.get(session.channel_id);
    channel = ch;
    messageId = session.message_id;
  } else {
    // Không tìm được message - log lỗi để debug
    logger.warn('UPDATE', `Phiên ${session.id.slice(0, 8)} không có message_id, bỏ qua cập nhật`);
    return;
  }

  try {
    const message = await channel.messages.fetch(messageId);
    const registrations = regRepo.getRegistrationsBySession(session.id);
    const waitlists = regRepo.getAllWaitlists(session.id);
    const currentPage = paginationState.get(messageId) || 0;
    const embed = buildRegistrationEmbed(session, registrations, guild, waitlists, currentPage);
    const components = buildAllComponents(session, registrations, currentPage);
    await message.edit({ embeds: [embed], components });
  } catch (err) {
    logger.warn('UPDATE', `Không thể cập nhật message ${messageId}: ${err.message}`);
  }
}

// ================================
// 9. AUTO-LOCK SCHEDULER
// ================================

// ================================
// 10. EVENTS
// ================================

/**
 * Xử lý khi thành viên rời guild
 */
client.on('guildMemberRemove', withErrorHandler(async (member) => {
  await handleGuildMemberRemove(member);
}, 'GUILD_MEMBER_REMOVE'));

// ================================
// 11. XỬ LÝ LỖI
// ================================

process.on('uncaughtException', (err) => {
  logger.error('PROCESS', `Uncaught Exception: ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('PROCESS', `Unhandled Rejection: ${reason}`);
});

/**
 * WAL Checkpoint trước khi tắt - đảm bảo data an toàn
 */
async function gracefulCheckpoint() {
  try {
    const db = getDb();
    db.pragma('wal_checkpoint(TRUNCATE)');
    logger.info('BOT', 'WAL checkpoint hoàn tất trước khi tắt');
  } catch (err) {
    logger.warn('BOT', `WAL checkpoint thất bại: ${err.message}`);
  }
}

process.on('SIGINT', async () => {
  logger.info('BOT', 'Đang tắt bot...');
  userDebouncer.destroy();
  slashRateLimiter.destroy();
  for (const timer of messageUpdateDebouncer.values()) {
    clearTimeout(timer);
  }
  messageUpdateDebouncer.clear();
  destroyScheduler();
  await gracefulCheckpoint();
  closeDatabase();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('BOT', 'Đang tắt bot...');
  userDebouncer.destroy();
  slashRateLimiter.destroy();
  for (const timer of messageUpdateDebouncer.values()) {
    clearTimeout(timer);
  }
  messageUpdateDebouncer.clear();
  destroyScheduler();
  await gracefulCheckpoint();
  closeDatabase();
  client.destroy();
  process.exit(0);
});

// ================================
// 12. ĐĂNG NHẬP
// ================================

try {
  client.login(CONFIG.DISCORD_BOT_TOKEN).catch((err) => {
    logger.error('BOT', `Lỗi đăng nhập Discord: ${err.message}`);
    process.exit(1);
  });
} catch (err) {
  logger.error('BOT', `Lỗi khởi tạo bot: ${err.message}`);
  process.exit(1);
}
