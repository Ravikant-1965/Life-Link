const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, 'lifelink.db');

let db;

function ensureColumn(tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some((column) => column.name === columnName);

    if (!exists) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

function initDatabase() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    console.log('Connected to SQLite database at:', DB_PATH);

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL,
            email           TEXT    NOT NULL UNIQUE,
            password_hash   TEXT    NOT NULL,
            health_id       TEXT    NOT NULL UNIQUE,
            created_at      TEXT    DEFAULT (datetime('now'))
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS doctors (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            name                 TEXT    NOT NULL,
            email                TEXT    NOT NULL UNIQUE,
            password_hash        TEXT    NOT NULL,
            license_number       TEXT    NOT NULL UNIQUE,
            hospital             TEXT    NOT NULL,
            specialization       TEXT    NOT NULL,
            verification_status  TEXT    NOT NULL DEFAULT 'pending',
            verified_at          TEXT,
            created_at           TEXT    DEFAULT (datetime('now'))
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
            id                       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id                  INTEGER NOT NULL UNIQUE,
            full_name                TEXT,
            date_of_birth            TEXT,
            blood_group              TEXT,
            emergency_contact_name   TEXT,
            emergency_contact_phone  TEXT,
            organ_donor_status       TEXT DEFAULT 'Not specified',
            previous_prescriptions   TEXT,
            age                      INTEGER,
            weight                   TEXT,
            gender                   TEXT,
            chief_complaint          TEXT,
            chronic_conditions       TEXT,
            previous_surgeries       TEXT,
            allergies                TEXT,
            current_medications      TEXT,
            previous_treatments      TEXT,
            lab_results              TEXT,
            kidney_liver_function    TEXT,
            pregnancy_status         TEXT,
            family_history           TEXT,
            substance_use            TEXT,
            mental_health_status     TEXT,
            medical_files            TEXT,
            document_images          TEXT DEFAULT '[]',
            medication_images        TEXT DEFAULT '[]',
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS access_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            health_id       TEXT    NOT NULL,
            doctor_id       INTEGER,
            doctor_name     TEXT,
            doctor_email    TEXT,
            doctor_license  TEXT,
            accessed_at     TEXT    NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            email           TEXT    NOT NULL,
            token           TEXT    NOT NULL UNIQUE,
            expires_at      INTEGER NOT NULL,
            used            INTEGER NOT NULL DEFAULT 0
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS doctor_patient_sessions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id       INTEGER NOT NULL,
            health_id       TEXT    NOT NULL,
            started_at      INTEGER NOT NULL,
            expires_at      INTEGER NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS site_stats (
            key             TEXT PRIMARY KEY,
            value           INTEGER NOT NULL DEFAULT 0
        )
    `);

    const existingVisitors = db.prepare('SELECT value FROM site_stats WHERE key = ?').get('total_visitors');
    if (!existingVisitors) {
        db.prepare('INSERT INTO site_stats (key, value) VALUES (?, ?)').run('total_visitors', 1428);
    }

    ensureColumn('profiles', 'medical_files', 'TEXT');
    ensureColumn('profiles', 'document_images', "TEXT DEFAULT '[]'");
    ensureColumn('profiles', 'medication_images', "TEXT DEFAULT '[]'");
    ensureColumn('doctors', 'hospital', "TEXT NOT NULL DEFAULT ''");
    ensureColumn('doctors', 'specialization', "TEXT NOT NULL DEFAULT ''");
    ensureColumn('doctors', 'verification_status', "TEXT NOT NULL DEFAULT 'pending'");
    ensureColumn('doctors', 'verified_at', 'TEXT');
    ensureColumn('doctors', 'mfa_secret', 'TEXT');
    ensureColumn('doctors', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn('access_logs', 'doctor_id', 'INTEGER');
    ensureColumn('access_logs', 'doctor_name', 'TEXT');
    ensureColumn('access_logs', 'doctor_email', 'TEXT');
    ensureColumn('access_logs', 'doctor_license', 'TEXT');

    console.log('All database tables are ready!');
}

function getDb() {
    if (!db) {
        throw new Error('Database not initialized! Call initDatabase() first.');
    }

    return db;
}

module.exports = { initDatabase, getDb };
