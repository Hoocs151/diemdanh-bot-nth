# 🎮 BANG CHIEN BOT - User Guide

Discord bot for guild/event member registration and attendance tracking.

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Running the Bot](#running-the-bot)
5. [Discord Usage](#discord-usage)
6. [Database Schema](#database-schema)
7. [Code Architecture](#code-architecture)
8. [Docker](#docker)
9. [Tests](#tests)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Introduction

Bang Chien Bot helps guilds/games manage member attendance lists with features:

- ✅ Create attendance sessions via slash command with **preview before creation**
- ✅ Register/unregister/switch factions via buttons with **pagination**
- ✅ Real-time updates when users click (with debounce to prevent API spam)
- ✅ 7 Factions: Cửu Linh, Thần Tướng, Thiết Y, Toái Mộng, Long Ngâm, Tố Vấn, Huyết Hà
- ✅ Lock/unlock/close sessions via admin
- ✅ Export attendance lists in multiple formats (Discord, CSV, **Google Sheets**)
- ✅ Complete audit log for all actions
- ✅ Spam prevention & debounce, **rate limit slash commands**
- ✅ **3-tier Permission System**: Admin > Officer > Member
- ✅ **Auto-lock** + **persistence timer** (timers survive restarts)
- ✅ **Automatic backup** via cron schedule
- ✅ **Remove leavers** from attendance list
- ✅ **Docker** deployment & **Vitest** test coverage

### Tech Stack

- **Runtime:** Node.js >= 20
- **Discord.js:** v14 (ES Modules)
- **Database:** SQLite (better-sqlite3) with WAL mode
- **DateTime:** luxon
- **Test:** Vitest v2
- **Deploy:** Docker + Docker Compose

---

## Installation

### Requirements

- Node.js 20+
- npm or yarn

### Step 1: Clone/Copy Project

```bash
cd c:/Users/mcdro/Downloads/botdiemdanh
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Create .env File

```bash
copy .env.example .env
```

Then edit the `.env` file with required parameters:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
BOT_OWNER_ID=your_user_id
ADMIN_ROLE_IDS=role_id_1,role_id_2
OFFICER_ROLE_IDS=role_id_1,role_id_2
DB_PATH=./data/botdiemdanh.db
LOG_LEVEL=info
TIMEZONE=Asia/Ho_Chi_Minh
AUTO_LOCK_MINUTES=0
MAX_PER_FACTION=0
DEBOUNCE_MS=1000
```

### Step 4: Get Discord Bot Token

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new Application
3. Go to **Bot** tab
4. Copy **Token** to `DISCORD_BOT_TOKEN`
5. Enable these Intents:
   - `SERVER MEMBERS INTENT`
   - `MESSAGE CONTENT INTENT`
6. All Slash Commands will automatically register when the bot starts

---

## Configuration

### 3-Tier Permission System

| Level | Permissions |
|-------|-------------|
| **Admin** | All permissions (create, lock, close, export, reset, edit, delete, cleanup, backup) |
| **Officer** | Create, lock, close, export, reset sessions |
| **Member** | View lists, register for factions |
| **Bot Owner** | Highest permissions (regardless of role list) |

| Variable | Description |
|---------|-------------|
| `BOT_OWNER_ID` | Bot owner's User ID - auto has all permissions |
| `ADMIN_ROLE_IDS` | List of Role IDs with Admin permission (comma-separated) |
| `OFFICER_ROLE_IDS` | List of Role IDs with Officer permission (comma-separated) |

### Finding Role ID

1. Enable Developer Mode in Discord (Settings > Advanced > Developer Mode)
2. Right-click on Role > Copy Role ID

### Behavior

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_LOCK_MINUTES` | 0 | Minutes before/after expiry to auto-lock. 0 = disabled |
| `MAX_PER_FACTION` | 0 | Max members per faction. 0 = unlimited |
| `DEBOUNCE_MS` | 1000 | Minimum interval between same user's actions (ms) |
| `LOG_LEVEL` | info | debug/info/warn/error |

### Rate Limit Slash Commands

| Variable | Default | Description |
|----------|---------|-------------|
| `SLASH_RATE_LIMIT_COUNT` | 5 | Max commands per user in time window |
| `SLASH_RATE_LIMIT_WINDOW_MS` | 30000 | Rate limit time window (ms) |

### Automatic Backup

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_BACKUP_ENABLED` | false | Enable/disable automatic backup |
| `BACKUP_CRON_SCHEDULE` | 0 3 * * * | Cron schedule (3 AM daily) |
| `BACKUP_RETENTION_COUNT` | 7 | Number of backups to keep |
| `BACKUP_DIR` | ./backups | Backup directory |

### Google Sheets (Optional)

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to credentials.json from Google Cloud |
| `GOOGLE_SHEET_ID` | Google Sheet ID (from URL) |
| `GOOGLE_SHEET_NAME` | Sheet name to export to (default: Sheet1) |

---

## Running the Bot

### Development Mode (Auto-restart on Changes)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Initialize Database (Auto-runs on Start)

Database is automatically created on bot startup. To reset:

```bash
npm run db:init
```

---

## Discord Usage

### Commands for Everyone

**Command:** `/help`
```
/help
```
View usage guide and command list. Use `/help [command name]` for details.

**Command:** `/danh-sach`
```
/danh-sach trangthai:all
```

### Commands for Officer/Admin

| Command | Description |
|---------|-------------|
| `/tao-phien` | Create new attendance session (with preview before creation) |
| `/khoa-phien` | Lock or unlock session |
| `/datlai-phien` | Clear all registrations (keep session) |
| `/chot-phien` | Close session, no more registrations |
| `/xuat-phien` | Export attendance list |

> Export formats: `By Faction`, `Overview`, `Special (Zalo/Facebook)`, `Detailed`, `CSV File`, **`Google Sheets`**

### Commands for Admin

| Command | Description |
|---------|-------------|
| `/sua-phien` | Manually add/remove members |
| `/xoa-phien` | Delete closed session |
| `/cleanup` | Remove leavers from attendance list |
| `/backup` | Backup database |

```
/cleanup              # Check + remove leavers
/cleanup hanhdong:Kiem tra  # Check only, no removal
```

```
/backup              # Create backup now
/backup hanhdong:Xem danh sach  # View backup list
```

### Admin Buttons on Message

When a session is created, the message includes:

| Button | Function |
|--------|----------|
| 🔒 Khoa | Lock session |
| 🔓 Mo Khoa | Unlock session (when locked) |
| 🔄 Reset | Reset all registrations |
| ✅ Chot Dong | Close session |
| 📤 Xuat DS | Export list |
| 🗑️ Xoa Phien | Delete session (only when closed) |

### Pagination Buttons

When a faction has many members, pagination buttons appear:

| Button | Function |
|--------|----------|
| ◀️ Trang truoc | Previous page |
| Trang sau ▶️ | Next page |

---

## Database Schema

### Table `sessions`

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT (PK) | Session UUID |
| name | TEXT | Event name |
| description | TEXT | Description |
| start_time | TEXT | ISO timestamp start |
| end_time | TEXT | ISO timestamp end |
| notify_channel_id | TEXT | Notification channel |
| guild_id | TEXT | Server ID |
| guild_name | TEXT | Server name |
| channel_id | TEXT | Message channel |
| message_id | TEXT | Embed message ID |
| status | TEXT | open/locked/closed |
| created_by_id | TEXT | Creator ID |
| created_by_name | TEXT | Creator name |
| max_per_faction | INT | Per-faction limit |
| locked_at | TEXT | Lock timestamp |
| locked_by_id | TEXT | Locker ID |
| locked_by_name | TEXT | Locker name |
| closed_at | TEXT | Close timestamp |
| closed_by_id | TEXT | Closer ID |
| closed_by_name | TEXT | Closer name |
| created_at | TEXT | Create timestamp |
| updated_at | TEXT | Last update timestamp |

### Table `registrations`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto increment |
| session_id | TEXT (FK) | Session ID |
| user_id | TEXT | Discord user ID |
| user_name | TEXT | Display name |
| faction_id | TEXT | Faction ID |
| registered_at | TEXT | Registration timestamp |
| updated_at | TEXT | Update timestamp |

### Table `audit_log`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto increment |
| session_id | TEXT | Session ID |
| action | TEXT | register/unregister/switch/lock/... |
| actor_id | TEXT | Actor |
| actor_name | TEXT | Actor name |
| target_user_id | TEXT | Affected user |
| target_user_name | TEXT | Affected user name |
| faction_from | TEXT | Old faction |
| faction_to | TEXT | New faction |
| extra_data | TEXT | JSON extra data |
| created_at | TEXT | Timestamp |

---

## Code Architecture

```
src/
├── bot.js                    # Entry point, client, event handlers
├── config/
│   ├── index.js             # Config + ENV validation + schema
│   ├── factions.js          # 7 faction definitions
│   ├── constants.js         # Constants: status, button IDs, pagination
│   └── colors.js            # Embed colors
├── database/
│   ├── index.js             # Export repositories
│   ├── database.js          # SQLite wrapper (singleton) with transaction support
│   ├── schema.js            # CREATE TABLE statements
│   └── repositories/
│       ├── sessionRepository.js      # Session CRUD
│       ├── registrationRepository.js   # Registration + waitlist CRUD
│       └── auditLogRepository.js       # Action logging
├── middleware/
│   └── permissions.js        # 3-tier permission (admin/officer/member)
├── utils/
│   ├── logger.js            # Centralized logger + error handler
│   ├── helpers.js           # Utility functions + UserDebouncer
│   ├── rateLimiter.js       # Sliding window rate limiter
│   ├── embedBuilder.js      # Discord embed builder with pagination
│   └── buttonBuilder.js      # Button component builder + pagination buttons
├── services/
│   ├── backupService.js     # Backup + restore + retention
│   ├── cleanupService.js    # Remove guild leavers
│   └── sheetsService.js     # Google Sheets export
├── jobs/
│   └── scheduler.js         # Auto-backup + persistence timer
├── events/
│   ├── index.js             # Export event handlers
│   ├── guildMemberRemove.js  # Handle member leave
│   └── guildMemberAdd.js     # Handle member join
└── commands/
    └── slash/
        ├── tao.js           # Create attendance session (with preview)
        ├── ds.js            # List sessions
        ├── khoa.js          # Lock/unlock session
        ├── datlai.js        # Reset registrations
        ├── chot.js          # Close session
        ├── xuat.js          # Export list
        ├── xoa.js           # Delete closed session
        ├── sua.js           # Manual session edit
        ├── help.js          # Usage guide
        ├── cleanup.js        # Remove leavers
        └── backup.js         # Database backup
```

---

## Docker

### Docker Compose (Recommended)

```bash
# 1. Copy .env
cp .env.example .env
# 2. Fill in .env with your settings

# 3. Build and run
docker-compose up -d

# 4. View logs
docker-compose logs -f

# 5. Stop bot
docker-compose down
```

### Manual Docker

```bash
# Build image
docker build -t bang-chien-bot .

# Run
docker run -d \
  --name bang-chien-bot \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/backups:/app/backups \
  bang-chien-bot
```

### Docker Features

- Base image: `node:20-alpine`
- Rebuild `better-sqlite3` native binding
- Run as non-root user
- Health check interval 30s
- Mount volumes for `data/`, `logs/`, `backups/`

---

## Tests

### Running Tests

```bash
# Run all tests
npm test

# Run tests with watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Available Tests

| Test File | Description |
|-----------|-------------|
| `tests/config.test.js` | Config validation, ENV parsing |
| `tests/rateLimiter.test.js` | Sliding window algorithm |
| `tests/permissions.test.js` | 3-tier permission system |
| `tests/helpers.test.js` | Helper functions, debouncer |
| `tests/factions.test.js` | Faction config validation |

### Writing More Tests

Tests are in `tests/` directory. File naming: `*.test.js`.

```javascript
import { describe, it, expect } from 'vitest';

describe('Module name', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

---

## Troubleshooting

### Q: Bot won't start after update?
A: Delete `node_modules` and run `npm install` again.

### Q: "Cannot find module 'better-sqlite3'"
A: Run `npm install` again. If error on Windows:
```bash
npm install --build-from-source
```

### Q: Slash commands don't appear?
A:
1. Re-invite bot with `Application Commands` permission
2. Wait 1-2 minutes for Discord to sync commands

### Q: "You do not have permission"
A: Check `ADMIN_ROLE_IDS` / `OFFICER_ROLE_IDS` in `.env`.

### Q: Automatic backup not running?
A: Set `AUTO_BACKUP_ENABLED=true` in `.env` and check `BACKUP_CRON_SCHEDULE`.

### Q: Google Sheets export not working?
A: Ensure Google Sheets API is enabled, create Service Account, and share Sheet with Service Account email.

---

**Version:** 1.1.0
**Author:** Senior Discord Bot Engineer
**License:** MIT
