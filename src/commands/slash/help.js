/**
 * Lệnh /help - Hiển thị hướng dẫn sử dụng bot
 */

import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { COLORS } from '../../config/colors.js';
import { getPermissionLevel } from '../../middleware/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Xem hướng dẫn sử dụng bot và danh sách lệnh')
  .addStringOption((opt) =>
    opt
      .setName('command')
      .setDescription('Xem hướng dẫn cho lệnh cụ thể')
      .setRequired(false)
      .addChoices(
        { name: 'tao-phien', value: 'tao-phien' },
        { name: 'danh-sach', value: 'danh-sach' },
        { name: 'khoa-phien', value: 'khoa-phien' },
        { name: 'datlai-phien', value: 'datlai-phien' },
        { name: 'chot-phien', value: 'chot-phien' },
        { name: 'xuat-phien', value: 'xuat-phien' },
        { name: 'sua-phien', value: 'sua-phien' },
        { name: 'xoa-phien', value: 'xoa-phien' },
        { name: 'cleanup', value: 'cleanup' },
        { name: 'backup', value: 'backup' },
      )
  );

const COMMAND_DOCS = {
  'tao-phien': {
    name: '/tao-phien',
    desc: 'Tạo một phiên điểm danh bang chiến mới (mặc định 24 giờ)',
    usage: '/tao-phien [tên] [mô tả] [kênh] [giới hạn]',
    fields: [
      { name: 'Tên phiên', value: 'Tên sự kiện / phiên điểm danh (bắt buộc)' },
      { name: 'Mô tả', value: 'Mô tả thêm về sự kiện (tùy chọn, tối đa 500 ký tự)' },
      { name: 'Kênh', value: 'Kênh gửi thông báo, mặc định là kênh hiện tại (tùy chọn)' },
      { name: 'Giới hạn/phái', value: 'Số người tối đa mỗi phái, 0 = không giới hạn (tùy chọn)' },
      { name: 'Thời gian', value: 'Tự động kết thúc sau 24 giờ kể từ lúc tạo' },
    ],
    required: 'Officer trở lên',
  },
  'danh-sach': {
    name: '/danh-sach',
    desc: 'Xem danh sách các phiên điểm danh',
    usage: '/danh-sach',
    fields: [
      { name: 'Trạng thái', value: 'Lọc theo trạng thái: all, open, locked, closed' },
    ],
    required: 'Tất cả mọi người',
  },
  'khoa-phien': {
    name: '/khoa-phien',
    desc: 'Khóa hoặc mở khóa phiên điểm danh',
    usage: '/khoa-phien',
    fields: [
      { name: 'Tên phiên', value: 'Tên phiên cần khóa/mở khóa' },
    ],
    required: 'Officer trở lên',
  },
  'datlai-phien': {
    name: '/datlai-phien',
    desc: 'Xóa toàn bộ đăng ký của phiên (giữ lại phiên)',
    usage: '/datlai-phien',
    fields: [
      { name: 'Tên phiên', value: 'Tên phiên cần đặt lại' },
    ],
    required: 'Officer trở lên',
  },
  'chot-phien': {
    name: '/chot-phien',
    desc: 'Chốt đóng phiên điểm danh - không cho đăng ký thêm',
    usage: '/chot-phien',
    fields: [
      { name: 'Tên phiên', value: 'Tên phiên cần chốt' },
    ],
    required: 'Officer trở lên',
  },
  'xuat-phien': {
    name: '/xuat-phien',
    desc: 'Xuất danh sách điểm danh với nhiều định dạng',
    usage: '/xuat-phien [tên phiên] [định dạng]',
    fields: [
      { name: 'Tên phiên', value: 'Tên phiên cần xuất' },
      { name: 'Định dạng', value: 'theo_phai | tong_quan | zalo | chi_tiet | csv | sheets' },
    ],
    required: 'Officer trở lên',
  },
  'sua-phien': {
    name: '/sua-phien',
    desc: 'Thêm hoặc xóa thành viên thủ công',
    usage: '/sua-phien',
    fields: [
      { name: 'Tên phiên', value: 'Tên phiên cần sửa' },
      { name: 'Hành động', value: 'them | xoa' },
      { name: 'Discord', value: 'Tag người dùng @' },
      { name: 'Phái', value: 'Chọn phái cần thêm/xóa' },
    ],
    required: 'Admin',
  },
  'xoa-phien': {
    name: '/xoa-phien',
    desc: 'Xóa vĩnh viễn phiên đã chốt',
    usage: '/xoa-phien [tên phiên]',
    fields: [
      { name: 'Tên phiên', value: 'Tên phiên đã chốt cần xóa' },
    ],
    required: 'Admin',
  },
  'cleanup': {
    name: '/cleanup',
    desc: 'Xóa người đã rời khỏi server khỏi danh sách đăng ký',
    usage: '/cleanup',
    fields: [],
    required: 'Admin',
  },
  'backup': {
    name: '/backup',
    desc: 'Sao lưu database ngay lập tức',
    usage: '/backup',
    fields: [],
    required: 'Admin',
  },
};

async function execute(interaction) {
  const specificCommand = interaction.options.getString('command');
  const userLevel = getPermissionLevel(interaction);

  if (specificCommand) {
    // Hiển thị chi tiết lệnh cụ thể
    const doc = COMMAND_DOCS[specificCommand];
    if (!doc) {
      return interaction.reply({
        content: `Không tìm thấy lệnh: \`${specificCommand}\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(doc.name)
      .setDescription(doc.desc)
      .setColor(COLORS.INFO)
      .addFields({ name: 'Cú pháp', value: '```' + doc.usage + '```', inline: false });

    if (doc.fields && doc.fields.length > 0) {
      for (const field of doc.fields) {
        embed.addFields({ name: field.name, value: field.value, inline: false });
      }
    }

    embed.addFields({
      name: 'Yêu cầu quyền',
      value: '🔑 ' + doc.required,
      inline: false,
    });

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  // Hiển thị danh sách lệnh tổng hợp
  const memberCommands = ['/help', '/danh-sach'];
  const officerCommands = ['/tao-phien', '/khoa-phien', '/datlai-phien', '/chot-phien', '/xuat-phien'];
  const adminCommands = ['/sua-phien', '/xoa-phien', '/cleanup', '/backup'];

  const buildCmdList = (cmds) =>
    cmds.map((c) => '`' + c + '`').join(', ') || '_Không có_';

  const embed = new EmbedBuilder()
    .setTitle('📖 Hướng dẫn sử dụng Bot Điểm Danh Bang Chiến')
    .setColor(COLORS.PRIMARY)
    .setDescription(
      `Chào mừng bạn đến với Bot Điểm Danh!\n\n` +
      `**Cách sử dụng:** Bấm vào nút phái bên dưới message điểm danh để đăng ký.\n` +
      `**Chuyển phái:** Bấm nút phái khác để chuyển.\n` +
      `**Hủy đăng ký:** Bấm lại nút phái đang đăng ký.`
    )
    .addFields(
      {
        name: '📌 Lệnh cho mọi người',
        value: buildCmdList(memberCommands),
        inline: false,
      },
      {
        name: '🔑 Lệnh cho Officer/Admin',
        value: buildCmdList(officerCommands),
        inline: false,
      },
      {
        name: '⚙️ Lệnh cho Admin',
        value: buildCmdList(adminCommands),
        inline: false,
      }
    )
    .addFields({
      name: '📝 Phân quyền',
      value:
        '• **Admin**: Quản lý hoàn toàn (tạo, khóa, chốt, xóa, sửa, cleanup, backup)\n' +
        '• **Officer**: Tạo, khóa, chốt, xuất, đặt lại phiên\n' +
        '• **Member**: Xem danh sách, đăng ký phái',
      inline: false,
    })
    .addFields({
      name: '💡 Mẹo',
      value:
        '• Dùng `/help [tên lệnh]` để xem chi tiết từng lệnh\n' +
        '• Khi phái đầy, bạn sẽ được thêm vào danh sách dự bị\n' +
        '• Khi có người hủy, người đầu tiên trong dự bị sẽ tự động được thêm vào',
      inline: false,
    })
    .setFooter({ text: `Bot Điểm Danh Bang Chiến • Yêu cầu: /help [lệnh] để xem chi tiết` });

  // Nếu là admin thì hiển thị thêm nút backup
  const components = [];

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export { execute };
