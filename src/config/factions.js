/**
 * Cấu hình các phái trong bang chiến
 * Mỗi phái có: id, tên hiển thị, emoji, màu button (Discord ButtonStyle)
 * ButtonStyle: 1=Primary(xanh dương), 2=Secondary(xám), 3=Success(xanh lá), 4=Danger(đỏ)
 */

export const FACTIONS = {
  CUU_LINH: {
    id: 'cuu_linh',
    name: 'Cửu Linh',
    emoji: '<:CuuLinh:1494729885892219040>',
    buttonStyle: 1,
    description: 'Phái Cửu Linh',
  },
  THAN_TUONG: {
    id: 'than_tuong',
    name: 'Thần Tương',
    emoji: '<:ThanTuong:1494729546610770180>',
    buttonStyle: 1,
    description: 'Phái Thần Tương',
  },
  THIET_Y: {
    id: 'thiet_y',
    name: 'Thiết Y',
    emoji: '<:ThietY:1494729763816870100>',
    buttonStyle: 2,
    description: 'Phái Thiết Y',
  },
  TOAI_MONG: {
    id: 'toai_mong',
    name: 'Toái Mộng',
    emoji: '<:ToaiMong:1494729720884101260>',
    buttonStyle: 2,
    description: 'Phái Toái Mộng',
  },
  LONG_NGAM: {
    id: 'long_ngam',
    name: 'Long Ngâm',
    emoji: '<:LongNgam:1494729814098055310>',
    buttonStyle: 3,
    description: 'Phái Long Ngâm',
  },
  TO_VAN: {
    id: 'to_van',
    name: 'Tố Vấn',
    emoji: '<:ToVan:1494729683265388706>',
    buttonStyle: 3,
    description: 'Phái Tố Vấn',
  },
  HUYET_HA: {
    id: 'huyet_ha',
    name: 'Huyết Hà',
    emoji: '<:HuyetHa:1494729627669631066>',
    buttonStyle: 4,
    description: 'Phái Huyết Hà',
  },
};

/** Danh sách mã phái theo thứ tự hiển thị */
export const FACTION_ORDER = [
  FACTIONS.CUU_LINH.id,
  FACTIONS.THAN_TUONG.id,
  FACTIONS.THIET_Y.id,
  FACTIONS.TOAI_MONG.id,
  FACTIONS.LONG_NGAM.id,
  FACTIONS.TO_VAN.id,
  FACTIONS.HUYET_HA.id,
];

/** Map nhanh id -> faction object */
export const FACTION_MAP = Object.fromEntries(
  Object.values(FACTIONS).map((f) => [f.id, f])
);

/** Lấy tên phái từ id */
export function getFactionName(factionId) {
  return FACTION_MAP[factionId]?.name ?? factionId;
}

/** Lấy emoji phái từ id */
export function getFactionEmoji(factionId) {
  return FACTION_MAP[factionId]?.emoji ?? '⚔️';
}
