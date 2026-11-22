const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let db = null;
let isPostgresMode = false;

function convertSql(sql) {
    let index = 1;
    let converted = sql.replace(/\?/g, () => `$${index++}`);
    converted = converted.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    return converted;
}

function createPgDb(pool) {
    return {
        isPostgres: true,
        async query(sql, params = []) {
            const converted = convertSql(sql);
            return await pool.query(converted, params);
        },
        prepare(sql) {
            const converted = convertSql(sql);
            return {
                async get(...params) {
                    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                    const res = await pool.query(converted, flat);
                    return res.rows[0] || null;
                },
                async all(...params) {
                    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                    const res = await pool.query(converted, flat);
                    return res.rows;
                },
                async run(...params) {
                    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
                    let finalSql = converted;
                    if (/^\s*INSERT\s+INTO/i.test(finalSql) && !/RETURNING/i.test(finalSql)) {
                        finalSql += ' RETURNING id';
                    }
                    const res = await pool.query(finalSql, flat);
                    return {
                        lastInsertRowid: res.rows[0]?.id || 0,
                        changes: res.rowCount || 0
                    };
                }
            };
        },
        async exec(sql) {
            return await pool.query(sql);
        }
    };
}

async function initDatabase() {
    const dbUrl = process.env.DATABASE_URL;

    if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
        const { Pool } = require('pg');
        const pool = new Pool({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false }
        });

        console.log('Connecting to PostgreSQL database at:', dbUrl.split('@')[1] || 'remote host');
        const client = await pool.connect();
        try {
            const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
            await client.query(schemaSql);
            console.log('PostgreSQL schema verified and ready.');
        } finally {
            client.release();
        }

        db = createPgDb(pool);
        isPostgresMode = true;
        console.log('PostgreSQL database initialized successfully!');
        return db;
    }

    // Fallback: Local SQLite
    const { DatabaseSync } = require('node:sqlite');
    const DB_PATH = process.env.DATABASE_PATH
        ? path.resolve(process.env.DATABASE_PATH)
        : path.join(__dirname, 'lifelink.db');

    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new DatabaseSync(DB_PATH);
    isPostgresMode = false;
    console.log('Connected to local SQLite database at:', DB_PATH);

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
            hospital             TEXT    NOT NULL DEFAULT '',
            specialization       TEXT    NOT NULL DEFAULT '',
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

    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_documents (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id          INTEGER NOT NULL,
            health_id        TEXT NOT NULL,
            file_name        TEXT NOT NULL,
            file_key         TEXT NOT NULL,
            file_size        INTEGER NOT NULL,
            mime_type        TEXT NOT NULL,
            category         TEXT DEFAULT 'General',
            uploaded_at      TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    console.log('All local SQLite database tables are ready!');
    return db;
}

function getDb() {
    if (!db) {
        throw new Error('Database not initialized! Call initDatabase() first.');
    }
    return db;
}

function isPostgres() {
    return isPostgresMode;
}

module.exports = { initDatabase, getDb, isPostgres };
