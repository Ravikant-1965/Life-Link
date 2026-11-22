-- LifeLink PostgreSQL Schema
-- Compatible with Neon.tech, Supabase, AWS RDS, and local PostgreSQL

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    health_id       TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id                   SERIAL PRIMARY KEY,
    name                 TEXT NOT NULL,
    email                TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    license_number       TEXT NOT NULL UNIQUE,
    hospital             TEXT NOT NULL DEFAULT '',
    specialization       TEXT NOT NULL DEFAULT '',
    verification_status  TEXT NOT NULL DEFAULT 'pending',
    verified_at          TEXT,
    created_at           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    mfa_secret           TEXT,
    mfa_enabled          INTEGER NOT NULL DEFAULT 0,
    department           TEXT NOT NULL DEFAULT '',
    qualifications       TEXT NOT NULL DEFAULT '',
    experience_years     TEXT NOT NULL DEFAULT '',
    phone                TEXT NOT NULL DEFAULT '',
    avatar_url           TEXT NOT NULL DEFAULT '',
    bio                  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS profiles (
    id                       SERIAL PRIMARY KEY,
    user_id                  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
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
    medication_images        TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS access_logs (
    id                  SERIAL PRIMARY KEY,
    health_id           TEXT NOT NULL,
    doctor_id           INTEGER,
    doctor_name         TEXT,
    doctor_email        TEXT,
    doctor_license      TEXT,
    department          TEXT,
    hospital            TEXT,
    specialization      TEXT,
    qualifications      TEXT,
    experience_years    TEXT,
    phone               TEXT,
    avatar_url          TEXT,
    access_reason       TEXT,
    accessed_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id              SERIAL PRIMARY KEY,
    email           TEXT NOT NULL,
    token           TEXT NOT NULL UNIQUE,
    expires_at      BIGINT NOT NULL,
    used            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doctor_patient_sessions (
    id              SERIAL PRIMARY KEY,
    doctor_id       INTEGER NOT NULL,
    health_id       TEXT NOT NULL,
    started_at      BIGINT NOT NULL,
    expires_at      BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS site_stats (
    key             TEXT PRIMARY KEY,
    value           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patient_documents (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    health_id        TEXT NOT NULL,
    file_name        TEXT NOT NULL,
    file_key         TEXT NOT NULL,
    file_size        BIGINT NOT NULL,
    mime_type        TEXT NOT NULL,
    category         TEXT DEFAULT 'General',
    extracted_text   TEXT,
    page_count       INTEGER DEFAULT 1,
    rag_status       TEXT DEFAULT 'pending',
    uploaded_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO site_stats (key, value)
VALUES ('total_visitors', 1428)
ON CONFLICT (key) DO NOTHING;
