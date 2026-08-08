#!/usr/bin/env node
/**
 * MongoDB backup for MX-IX.
 *
 * Creates a timestamped gzip archive of the database using `mongodump` and
 * keeps the most recent N archives (older ones are pruned).
 *
 * Usage:
 *   node scripts/backup-db.js                 # backup using MONGODB_URI from .env
 *   BACKUP_DIR=/var/backups node scripts/backup-db.js
 *   BACKUP_KEEP=14 node scripts/backup-db.js  # keep last 14 archives
 *
 * Schedule it (recommended): cron (Linux) or Task Scheduler (Windows), e.g.
 *   0 2 * * *  cd /path/backend && node scripts/backup-db.js   # daily 02:00
 *
 * Restore (manual):
 *   mongorestore --uri="<MONGODB_URI>" --gzip --archive=/path/to/backup.gz --drop
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mx-ix-admin';
const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const keep = parseInt(process.env.BACKUP_KEEP || '7', 10);

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function hasMongodump() {
  const r = spawnSync('mongodump', ['--version'], { stdio: 'ignore', shell: true });
  return r.status === 0;
}

function prune() {
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('mx-ix-') && f.endsWith('.gz'))
    .map((f) => ({ f, t: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(keep)) {
    fs.unlinkSync(path.join(backupDir, old.f));
    console.log(`  pruned old backup: ${old.f}`);
  }
}

(function main() {
  if (!hasMongodump()) {
    console.error(
      '❌ `mongodump` not found. Install MongoDB Database Tools:\n' +
        '   https://www.mongodb.com/try/download/database-tools\n' +
        '   (or `brew install mongodb-database-tools` / apt package).'
    );
    process.exit(1);
  }

  ensureDir(backupDir);
  const archive = path.join(backupDir, `mx-ix-${stamp()}.gz`);
  console.log(`🗄️  Backing up database → ${archive}`);

  const res = spawnSync('mongodump', [`--uri=${uri}`, `--archive=${archive}`, '--gzip'], {
    stdio: 'inherit',
    shell: true,
  });

  if (res.status !== 0) {
    console.error('❌ Backup failed.');
    process.exit(res.status || 1);
  }

  const sizeMb = (fs.statSync(archive).size / 1_000_000).toFixed(2);
  console.log(`✅ Backup complete (${sizeMb} MB).`);
  prune();
  console.log(`📦 Keeping latest ${keep} archive(s) in ${backupDir}`);
})();
