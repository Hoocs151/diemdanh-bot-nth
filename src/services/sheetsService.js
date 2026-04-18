/**
 * Google Sheets Export Service
 * Xuất danh sách điểm danh trực tiếp vào Google Sheets
 *
 * Yêu cầu:
 * 1. Enable Google Sheets API trong Google Cloud Console
 * 2. Tạo Service Account và tải credentials.json
 * 3. Chia sẻ Google Sheet với email của Service Account
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { FACTION_ORDER, FACTION_MAP } from '../config/factions.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

let sheetsClient = null;

/**
 * Khởi tạo Google Sheets client
 * @returns {Promise<object|null>}
 */
async function getSheetsClient() {
  if (!CONFIG.GOOGLE_APPLICATION_CREDENTIALS) {
    return null;
  }

  if (sheetsClient) return sheetsClient;

  try {
    // Dynamic import để không lỗi khi chưa cài googleapis
    const { google } = await import('googleapis');
    const { readFileSync } = await import('node:fs');

    const credentialsPath = join(__dirname, '../../..', CONFIG.GOOGLE_APPLICATION_CREDENTIALS);

    // Nếu credentials là JSON string thay vì file path
    let credentials;
    try {
      credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    } catch {
      // Có thể credentials được đặt trực tiếp trong env (base64)
      try {
        credentials = JSON.parse(Buffer.from(CONFIG.GOOGLE_APPLICATION_CREDENTIALS, 'base64').toString('utf8'));
      } catch {
        credentials = JSON.parse(CONFIG.GOOGLE_APPLICATION_CREDENTIALS);
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    logger.info('SHEETS', 'Đã khởi tạo Google Sheets client');
    return sheetsClient;
  } catch (err) {
    logger.error('SHEETS', `Lỗi khởi tạo Google Sheets: ${err.message}`);
    return null;
  }
}

/**
 * Kiểm tra Google Sheets đã được cấu hình chưa
 */
export function isSheetsConfigured() {
  return !!(CONFIG.GOOGLE_APPLICATION_CREDENTIALS && CONFIG.GOOGLE_SHEET_ID);
}

/**
 * Chuyển đổi dữ liệu điểm danh thành rows cho Sheets
 * @param {object} session
 * @param {object} registrations - { factionId: [ { userId, userName }, ... ] }
 * @param {object} waitlists
 */
function buildSheetsData(session, registrations, waitlists) {
  const rows = [];

  // --- Header ---
  rows.push([session.name]);
  rows.push([`Tạo: ${new Date(session.created_at).toLocaleString('vi-VN')}`]);
  rows.push([`Trạng thái: ${session.status}`]);
  rows.push([]); // Empty row

  // --- Tổng quan ---
  rows.push(['=== TỔNG QUAN ===']);
  rows.push(['Phái', 'Đã đăng ký', 'Dự bị', 'Tổng cộng']);

  let totalRegistered = 0;
  let totalWaitlist = 0;

  for (const factionId of FACTION_ORDER) {
    const faction = FACTION_MAP[factionId];
    if (!faction) continue;

    const members = registrations[factionId] || [];
    const waitlist = waitlists[factionId] || [];

    totalRegistered += members.length;
    totalWaitlist += waitlist.length;

    rows.push([
      `${faction.emoji} ${faction.name}`,
      members.length,
      waitlist.length,
      members.length + waitlist.length,
    ]);
  }

  rows.push(['TỔNG CỘNG', totalRegistered, totalWaitlist, totalRegistered + totalWaitlist]);
  rows.push([]);

  // --- Chi tiết từng phái ---
  rows.push(['=== CHI TIẾT THEO PHÁI ===']);

  for (const factionId of FACTION_ORDER) {
    const faction = FACTION_MAP[factionId];
    if (!faction) continue;

    const members = registrations[factionId] || [];
    const waitlist = waitlists[factionId] || [];

    if (members.length === 0 && waitlist.length === 0) continue;

    rows.push([]);
    rows.push([`${faction.emoji} ${faction.name} - Đã đăng ký (${members.length})`]);
    rows.push(['STT', 'Tên', 'Discord ID', 'Thời gian đăng ký']);

    members.forEach((m, i) => {
      rows.push([i + 1, m.userName, m.userId, new Date(m.registeredAt).toLocaleString('vi-VN')]);
    });

    if (waitlist.length > 0) {
      rows.push([]);
      rows.push([`Dự bị (${waitlist.length})`]);
      rows.push(['Vị trí', 'Tên', 'Discord ID', 'Thời gian vào danh sách chờ']);

      waitlist.forEach((w) => {
        rows.push([w.position, w.userName, w.userId, new Date(w.joinedAt).toLocaleString('vi-VN')]);
      });
    }
  }

  return rows;
}

/**
 * Xuất dữ liệu lên Google Sheets
 * @param {object} session
 * @param {object} registrations
 * @param {object} waitlists
 * @returns {Promise<{ success: boolean, url?: string, error?: string }>}
 */
export async function exportToSheets(session, registrations, waitlists) {
  if (!isSheetsConfigured()) {
    return {
      success: false,
      error: 'Google Sheets chưa được cấu hình. Cần đặt GOOGLE_APPLICATION_CREDENTIALS và GOOGLE_SHEET_ID trong .env',
    };
  }

  try {
    const sheets = await getSheetsClient();
    if (!sheets) {
      return { success: false, error: 'Không thể khởi tạo Google Sheets client' };
    }

    const data = buildSheetsData(session, registrations, waitlists);
    const range = `${CONFIG.GOOGLE_SHEET_NAME}!A1`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: data },
    });

    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}`;

    logger.info('SHEETS', `Đã xuất dữ liệu lên Google Sheets: ${session.name}`);

    return { success: true, url };
  } catch (err) {
    logger.error('SHEETS', `Lỗi xuất Google Sheets: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Xuất nhiều phiên vào các sheet riêng biệt
 * @param {Array} sessions - [{ session, registrations, waitlists }]
 */
export async function exportMultipleSessionsToSheets(sessions) {
  if (!isSheetsConfigured()) {
    return { success: false, error: 'Google Sheets chưa được cấu hình' };
  }

  try {
    const sheets = await getSheetsClient();
    if (!sheets) {
      return { success: false, error: 'Không thể khởi tạo Google Sheets client' };
    }

    // Tạo batch update để thêm nhiều sheet
    const requests = [];

    for (const item of sessions) {
      const safeName = item.session.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      requests.push({
        addSheet: {
          properties: { title: safeName },
        },
      });
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
        requestBody: { requests },
      });
    }

    // Xuất dữ liệu vào từng sheet
    const results = [];
    for (let i = 0; i < sessions.length; i++) {
      const item = sessions[i];
      const safeName = item.session.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      const data = buildSheetsData(item.session, item.registrations, item.waitlists);

      await sheets.spreadsheets.values.update({
        spreadsheetId: CONFIG.GOOGLE_SHEET_ID,
        range: `${safeName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: data },
      });

      results.push({ name: item.session.name, sheet: safeName });
    }

    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.GOOGLE_SHEET_ID}`;

    return { success: true, url, results };
  } catch (err) {
    logger.error('SHEETS', `Lỗi xuất nhiều phiên: ${err.message}`);
    return { success: false, error: err.message };
  }
}
