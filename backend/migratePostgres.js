// backend/migratePostgres.js - Migrates SQLite data to Neon PostgreSQL
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('Error: DATABASE_URL is not set in environment or backend/.env');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('Connecting to PostgreSQL database at Neon...');
    const client = await pool.connect();
    console.log('Connected to PostgreSQL successfully!');

    try {
        // 1. Run schema.postgres.sql
        console.log('\n[1/3] Creating PostgreSQL tables...');
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
        await client.query(schemaSql);
        console.log('All PostgreSQL tables created successfully.');

        // 2. Read SQLite database if present
        const sqlitePath = path.join(__dirname, 'lifelink.db');
        if (!fs.existsSync(sqlitePath)) {
            console.log('No local lifelink.db found to migrate.');
            return;
        }

        console.log('\n[2/3] Reading existing data from local SQLite database...');
        const sqlite = new DatabaseSync(sqlitePath);

        // Helper to insert safely
        // Users
        try {
            const users = sqlite.prepare('SELECT * FROM users').all();
            console.log(`Found ${users.length} users in SQLite.`);
            for (const u of users) {
                await client.query(`
                    INSERT INTO users (id, name, email, password_hash, health_id, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        health_id = EXCLUDED.health_id;
                `, [u.id, u.name, u.email, u.password_hash, u.health_id, u.created_at || new Date().toISOString()]);
            }
            await client.query("SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;");
        } catch (e) {
            console.warn('Users migration note:', e.message);
        }

        // Doctors
        try {
            const doctors = sqlite.prepare('SELECT * FROM doctors').all();
            console.log(`Found ${doctors.length} doctors in SQLite.`);
            for (const d of doctors) {
                await client.query(`
                    INSERT INTO doctors (
                        id, name, email, password_hash, license_number, hospital, specialization,
                        verification_status, verified_at, created_at, mfa_secret, mfa_enabled,
                        department, qualifications, experience_years, phone, avatar_url, bio
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        license_number = EXCLUDED.license_number,
                        hospital = EXCLUDED.hospital,
                        specialization = EXCLUDED.specialization,
                        verification_status = EXCLUDED.verification_status;
                `, [
                    d.id, d.name, d.email, d.password_hash, d.license_number, d.hospital || '', d.specialization || '',
                    d.verification_status || 'verified', d.verified_at, d.created_at || new Date().toISOString(),
                    d.mfa_secret || null, d.mfa_enabled || 0, d.department || '', d.qualifications || '',
                    d.experience_years || '', d.phone || '', d.avatar_url || '', d.bio || ''
                ]);
            }
            await client.query("SELECT setval(pg_get_serial_sequence('doctors', 'id'), COALESCE(MAX(id), 1)) FROM doctors;");
        } catch (e) {
            console.warn('Doctors migration note:', e.message);
        }

        // Profiles
        try {
            const profiles = sqlite.prepare('SELECT * FROM profiles').all();
            console.log(`Found ${profiles.length} profiles in SQLite.`);
            for (const p of profiles) {
                await client.query(`
                    INSERT INTO profiles (
                        id, user_id, full_name, date_of_birth, blood_group, emergency_contact_name,
                        emergency_contact_phone, organ_donor_status, previous_prescriptions, age,
                        weight, gender, chief_complaint, chronic_conditions, previous_surgeries,
                        allergies, current_medications, previous_treatments, lab_results,
                        kidney_liver_function, pregnancy_status, family_history, substance_use,
                        mental_health_status, medical_files, document_images, medication_images
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
                    )
                    ON CONFLICT (user_id) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        blood_group = EXCLUDED.blood_group,
                        allergies = EXCLUDED.allergies,
                        current_medications = EXCLUDED.current_medications;
                `, [
                    p.id, p.user_id, p.full_name, p.date_of_birth, p.blood_group, p.emergency_contact_name,
                    p.emergency_contact_phone, p.organ_donor_status || 'Not specified', p.previous_prescriptions,
                    p.age, p.weight, p.gender, p.chief_complaint, p.chronic_conditions, p.previous_surgeries,
                    p.allergies, p.current_medications, p.previous_treatments, p.lab_results,
                    p.kidney_liver_function, p.pregnancy_status, p.family_history, p.substance_use,
                    p.mental_health_status, p.medical_files, p.document_images || '[]', p.medication_images || '[]'
                ]);
            }
            await client.query("SELECT setval(pg_get_serial_sequence('profiles', 'id'), COALESCE(MAX(id), 1)) FROM profiles;");
        } catch (e) {
            console.warn('Profiles migration note:', e.message);
        }

        // Access logs
        try {
            const logs = sqlite.prepare('SELECT * FROM access_logs').all();
            console.log(`Found ${logs.length} access logs in SQLite.`);
            for (const l of logs) {
                await client.query(`
                    INSERT INTO access_logs (
                        id, health_id, doctor_id, doctor_name, doctor_email, doctor_license,
                        department, hospital, specialization, qualifications, experience_years,
                        phone, avatar_url, access_reason, accessed_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (id) DO NOTHING;
                `, [
                    l.id, l.health_id, l.doctor_id, l.doctor_name, l.doctor_email, l.doctor_license,
                    l.department || '', l.hospital || '', l.specialization || '', l.qualifications || '',
                    l.experience_years || '', l.phone || '', l.avatar_url || '', l.access_reason || '',
                    l.accessed_at || new Date().toISOString()
                ]);
            }
            await client.query("SELECT setval(pg_get_serial_sequence('access_logs', 'id'), COALESCE(MAX(id), 1)) FROM access_logs;");
        } catch (e) {
            console.warn('Access logs migration note:', e.message);
        }

        // Patient documents
        try {
            const docs = sqlite.prepare('SELECT * FROM patient_documents').all();
            console.log(`Found ${docs.length} patient documents in SQLite.`);
            for (const d of docs) {
                await client.query(`
                    INSERT INTO patient_documents (
                        id, user_id, health_id, file_name, file_key, file_size, mime_type,
                        category, extracted_text, page_count, rag_status, uploaded_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (id) DO NOTHING;
                `, [
                    d.id, d.user_id, d.health_id, d.file_name, d.file_key, d.file_size,
                    d.mime_type, d.category || 'General', d.extracted_text || '',
                    d.page_count || 1, d.rag_status || 'pending', d.uploaded_at || new Date().toISOString()
                ]);
            }
            await client.query("SELECT setval(pg_get_serial_sequence('patient_documents', 'id'), COALESCE(MAX(id), 1)) FROM patient_documents;");
        } catch (e) {
            console.warn('Documents migration note:', e.message);
        }

        // 3. Verify counts in PostgreSQL
        console.log('\n[3/3] Verifying PostgreSQL table row counts...');
        const userCount = await client.query('SELECT COUNT(*) FROM users');
        const docCount = await client.query('SELECT COUNT(*) FROM doctors');
        const profileCount = await client.query('SELECT COUNT(*) FROM profiles');
        const logCount = await client.query('SELECT COUNT(*) FROM access_logs');
        const documentCount = await client.query('SELECT COUNT(*) FROM patient_documents');

        console.log('----------------------------------------------------');
        console.log(`✓ Users in Postgres:       ${userCount.rows[0].count}`);
        console.log(`✓ Doctors in Postgres:     ${docCount.rows[0].count}`);
        console.log(`✓ Profiles in Postgres:    ${profileCount.rows[0].count}`);
        console.log(`✓ Access Logs in Postgres: ${logCount.rows[0].count}`);
        console.log(`✓ Documents in Postgres:   ${documentCount.rows[0].count}`);
        console.log('----------------------------------------------------');
        console.log('🎉 Data successfully migrated to Neon PostgreSQL!');

    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
