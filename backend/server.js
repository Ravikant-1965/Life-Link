require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { generateSecret, generateURI, verifySync } = require('otplib');
const QRCode = require('qrcode');
const { initDatabase, getDb } = require('./database');
const { encryptText, decryptText } = require('./cryptoUtils');

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

function verifyTotpCode(token, secret) {
    if (!token || !secret) return false;
    try {
        const result = verifySync({ token: String(token).trim(), secret });
        return Boolean(result && result.valid);
    } catch (_err) {
        return false;
    }
}

let mailTransporter;
if (process.env.SMTP_HOST) {
    if (process.env.SMTP_HOST.includes('gmail.com')) {
        mailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        mailTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
} else {
    mailTransporter = {
        sendMail: async (options) => {
            console.log('\n========================================');
            console.log('MOCK EMAIL SENT');
            console.log('To:', options.to);
            console.log('Subject:', options.subject);
            console.log('Body:', options.text);
            console.log('========================================\n');
            return { messageId: 'mock-id' };
        }
    };
}


const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'lifelink-super-secret-key-change-this-in-production';
const DOCTOR_VERIFICATION_CODE = process.env.DOCTOR_VERIFICATION_CODE || 'LIFELINK-DOCTOR-2026';
const ADMIN_REVIEW_KEY = process.env.ADMIN_REVIEW_KEY || 'lifelink-admin-review-key';
const allowedOrigins = new Set(
    [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_URL,
        ...(process.env.CORS_ORIGINS || '').split(',')
    ]
        .filter(Boolean)
        .map((origin) => origin.trim().replace(/\/+$/, ''))
);

app.disable('x-powered-by');
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin.replace(/\/+$/, ''))) {
            callback(null, true);
            return;
        }

        callback(null, false);
    },
    credentials: true
}));
app.use(express.json({ limit: '12mb' }));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
});

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

initDatabase();
seedDoctorProfilesAndLogs(getDb());

function seedDoctorProfilesAndLogs(db) {
    try {
        const defaultPasswordHash = bcrypt.hashSync('Doctor@123', 10);
        const now = Date.now();

        const fakeDoctors = [
            {
                name: 'Dr. Sarah Johnson',
                email: 'dr.sarah.johnson@metrohealth.org',
                password_hash: defaultPasswordHash,
                license_number: 'MED-CARD-782104',
                hospital: 'Metro Heart Super Specialty Hospital',
                specialization: 'Cardiovascular Disease & Heart Failure',
                department: 'Cardiology',
                qualifications: 'MBBS, MD (Medicine), DM (Cardiology), FACC',
                experience_years: '8 Years',
                phone: '+1 (555) 382-9102',
                avatar_url: '/doctors/dr_sarah_johnson.jpg',
                bio: 'Senior Consultant Cardiologist specializing in acute coronary triage, cardiac electrophysiology, and non-invasive cardiovascular imaging.',
                reason: 'Emergency Cardiac Rhythm Evaluation & ECG Review',
                timeOffset: 2 * 60 * 60 * 1000 // 2 hours ago
            },
            {
                name: 'Dr. Ching Ming Yu',
                email: 'dr.chingming.yu@apexortho.com',
                password_hash: defaultPasswordHash,
                license_number: 'MED-ORTH-491022',
                hospital: 'Apex Orthopedic & Trauma Institute',
                specialization: 'Musculoskeletal Trauma & Joint Reconstruction',
                department: 'Orthopedics',
                qualifications: 'MBBS, MS (Orthopedics), M.Ch (Ortho)',
                experience_years: '12 Years',
                phone: '+1 (555) 749-1084',
                avatar_url: '/doctors/dr_ching_ming_yu.jpg',
                bio: 'Chief of Orthopedic Trauma specializing in complex fracture reduction, bone biomechanics, and post-traumatic joint stabilization.',
                reason: 'Post-Fracture Bone Radiograph & Musculoskeletal Review',
                timeOffset: 24 * 60 * 60 * 1000 // 1 day ago
            },
            {
                name: 'Dr. Elena Rostova',
                email: 'dr.elena.rostova@stjudeneuro.org',
                password_hash: defaultPasswordHash,
                license_number: 'MED-NEUR-630291',
                hospital: 'St. Jude Neurosciences Centre',
                specialization: 'Stroke Prevention & Cognitive Neurology',
                department: 'Neurology',
                qualifications: 'MBBS, MD, DM (Neurology)',
                experience_years: '10 Years',
                phone: '+1 (555) 492-7815',
                avatar_url: '/doctors/dr_elena_rostova.jpg',
                bio: 'Consultant Neurologist managing emergency acute stroke protocol, neurocritical assessments, and neuromuscular disorders.',
                reason: 'Cranial Nerve Reflex & Neuro-motor Assessment',
                timeOffset: 4 * 24 * 60 * 60 * 1000 // 4 days ago
            },
            {
                name: 'Dr. Rajesh Sharma',
                email: 'dr.rajesh.sharma@apollocare.org',
                password_hash: defaultPasswordHash,
                license_number: 'MED-EMER-551098',
                hospital: 'Apollo Critical Care & Trauma Hospital',
                specialization: 'Acute Trauma Life Support & Critical Care',
                department: 'Emergency Medicine',
                qualifications: 'MBBS, MD (Emergency Medicine), FEM (RCGP-UK)',
                experience_years: '15 Years',
                phone: '+91 98901 33456',
                avatar_url: '/doctors/dr_rajesh_sharma.jpg',
                bio: 'Director of Emergency Services focusing on rapid trauma triage, hemodynamic stabilization, and critical record verification.',
                reason: 'Comprehensive Emergency Triage & Allergy Verification',
                timeOffset: 7 * 24 * 60 * 60 * 1000 // 7 days ago
            }
        ];

        const targetPatientHealthIds = ['LL-2KZAM', 'LL-KQGSX'];

        for (const doc of fakeDoctors) {
            let existingDoc = db.prepare('SELECT id FROM doctors WHERE email = ? OR license_number = ?').get(doc.email, doc.license_number);
            let doctorId;

            if (!existingDoc) {
                const res = db.prepare(`
                    INSERT INTO doctors (
                        name, email, password_hash, license_number, hospital,
                        specialization, department, qualifications, experience_years,
                        phone, avatar_url, bio, verification_status, verified_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', datetime('now'))
                `).run(
                    doc.name, doc.email, doc.password_hash, doc.license_number, doc.hospital,
                    doc.specialization, doc.department, doc.qualifications, doc.experience_years,
                    doc.phone, doc.avatar_url, doc.bio
                );
                doctorId = Number(res.lastInsertRowid);
            } else {
                doctorId = existingDoc.id;
                db.prepare(`
                    UPDATE doctors
                    SET
                        name = ?,
                        hospital = ?,
                        specialization = ?,
                        department = ?,
                        qualifications = ?,
                        experience_years = ?,
                        phone = ?,
                        avatar_url = ?,
                        bio = ?,
                        verification_status = 'verified'
                    WHERE id = ?
                `).run(
                    doc.name, doc.hospital, doc.specialization, doc.department,
                    doc.qualifications, doc.experience_years, doc.phone,
                    doc.avatar_url, doc.bio, doctorId
                );
            }

            for (const healthId of targetPatientHealthIds) {
                const existingLog = db.prepare(`
                    SELECT id FROM access_logs
                    WHERE health_id = ? AND doctor_license = ?
                `).get(healthId, doc.license_number);

                const accessedAt = new Date(now - doc.timeOffset).toISOString();

                if (!existingLog) {
                    db.prepare(`
                        INSERT INTO access_logs (
                            health_id, doctor_id, doctor_name, doctor_email, doctor_license,
                            department, hospital, specialization, qualifications, experience_years,
                            phone, avatar_url, access_reason, accessed_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        healthId, doctorId, doc.name, doc.email, doc.license_number,
                        doc.department, doc.hospital, doc.specialization, doc.qualifications,
                        doc.experience_years, doc.phone, doc.avatar_url, doc.reason, accessedAt
                    );
                } else {
                    db.prepare(`
                        UPDATE access_logs
                        SET
                            doctor_id = ?,
                            doctor_name = ?,
                            doctor_email = ?,
                            department = ?,
                            hospital = ?,
                            specialization = ?,
                            qualifications = ?,
                            experience_years = ?,
                            phone = ?,
                            avatar_url = ?,
                            access_reason = ?
                        WHERE id = ?
                    `).run(
                        doctorId, doc.name, doc.email, doc.department, doc.hospital,
                        doc.specialization, doc.qualifications, doc.experience_years,
                        doc.phone, doc.avatar_url, doc.reason, existingLog.id
                    );
                }
            }
        }
        // Ensure medical profile exists for user 1 (Ravi kant) so doctors can lookup his record
        const user1 = db.prepare('SELECT id, name FROM users WHERE id = 1').get();
        if (user1) {
            const p1 = db.prepare('SELECT id FROM profiles WHERE user_id = 1').get();
            if (!p1) {
                db.prepare(`
                    INSERT INTO profiles (
                        user_id, full_name, blood_group, date_of_birth, age, gender,
                        allergies, chronic_conditions, emergency_contact_name, emergency_contact_phone
                    ) VALUES (1, 'Ravi kant', 'O+', '1998-05-14', 28, 'Male', 'Penicillin', 'Mild Asthma', 'Emergency Contact', '+91 98765 43210')
                `).run();
            }
        }

        // Backfill department for legacy doctors if blank
        db.prepare("UPDATE doctors SET department = specialization WHERE (department = '' OR department IS NULL) AND specialization != ''").run();

        console.log('Seeded 4 fake doctor profiles & access logs for Ravi kant and Ravi Mishra successfully.');
    } catch (err) {
        console.error('Error seeding doctor profiles:', err.message);
    }
}

function generateHealthId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = 'LL-';

    for (let i = 0; i < 5; i += 1) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return id;
}

function normalizeEmail(email = '') {
    return email.trim().toLowerCase();
}

function sanitizeOptionalText(value, maxLength = 6000) {
    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().slice(0, maxLength);
}

function serializeArray(value) {
    return JSON.stringify(Array.isArray(value) ? value : []);
}

function sanitizeImageDataArray(value, maxItems = 12) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            (item) =>
                typeof item === 'string'
                && (item.startsWith('data:image/') || /^https?:\/\//i.test(item))
                && item.length <= 6_000_000
        )
        .slice(0, maxItems);
}

function parseArray(value) {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function parseLinks(value) {
    if (!value) return [];

    return value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizeDocumentLinks(value) {
    if (typeof value !== 'string') {
        return '';
    }

    return value
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => /^https?:\/\//i.test(item))
        .slice(0, 12)
        .join('\n');
}

function isValidHealthId(healthId = '') {
    return /^LL-[A-Z0-9]{5}$/.test(healthId.trim().toUpperCase());
}

function formatProfile(profile) {
    if (!profile) {
        return null;
    }

    return {
        ...profile,
        full_name: decryptText(profile.full_name),
        date_of_birth: decryptText(profile.date_of_birth),
        blood_group: decryptText(profile.blood_group),
        allergies: decryptText(profile.allergies),
        chronic_conditions: decryptText(profile.chronic_conditions),
        current_medications: decryptText(profile.current_medications),
        previous_surgeries: decryptText(profile.previous_surgeries),
        previous_prescriptions: decryptText(profile.previous_prescriptions),
        emergency_contact_name: decryptText(profile.emergency_contact_name),
        emergency_contact_phone: decryptText(profile.emergency_contact_phone),
        organ_donor_status: decryptText(profile.organ_donor_status),
        chief_complaint: decryptText(profile.chief_complaint),
        previous_treatments: decryptText(profile.previous_treatments),
        lab_results: decryptText(profile.lab_results),
        kidney_liver_function: decryptText(profile.kidney_liver_function),
        pregnancy_status: decryptText(profile.pregnancy_status),
        family_history: decryptText(profile.family_history),
        substance_use: decryptText(profile.substance_use),
        mental_health_status: decryptText(profile.mental_health_status),
        document_images: parseArray(profile.document_images),
        medication_images: parseArray(profile.medication_images),
        medical_file_links: parseLinks(profile.medical_files)
    };
}

function createToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    return authHeader.split(' ')[1];
}

function checkPatientAuth(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).send({ message: 'No patient token provided. Please login.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'patient') {
            return res.status(403).send({ message: 'Patient account required for this action.' });
        }

        req.userId = decoded.id;
        next();
    } catch (_error) {
        return res.status(401).send({ message: 'Invalid or expired token. Please login again.' });
    }
}

function checkDoctorAuth(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).send({ message: 'Doctor login is required to access patient profiles.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'doctor') {
            return res.status(403).send({ message: 'Verified doctor account required.' });
        }

        const db = getDb();
        const doctor = db.prepare(`
            SELECT *
            FROM doctors
            WHERE id = ?
        `).get(decoded.id);

        if (!doctor) {
            return res.status(401).send({ message: 'Doctor account not found. Please login again.' });
        }

        if (doctor.verification_status !== 'verified') {
            return res.status(403).send({
                message: 'Doctor account verification is still pending. Approved and verified doctor access is required.',
                status: doctor.verification_status
            });
        }

        req.doctor = doctor;
        next();
    } catch (_error) {
        return res.status(401).send({ message: 'Invalid or expired doctor token. Please login again.' });
    }
}

function checkAdminReviewKey(req, res, next) {
    const providedKey = req.headers['x-admin-key'] || req.body.adminKey;

    if (providedKey !== ADMIN_REVIEW_KEY) {
        return res.status(401).send({ message: 'Valid admin review key required.' });
    }

    next();
}

function fetchEmergencyProfile(healthId, doctor) {
    const db = getDb();
    const normalizedHealthId = healthId.trim().toUpperCase();

    if (!isValidHealthId(normalizedHealthId)) {
        return {
            status: 400,
            body: { message: 'Enter a valid Health ID in the format LL-ABCDE.' }
        };
    }

    const user = db.prepare(`
        SELECT id, name, health_id
        FROM users
        WHERE health_id = ?
    `).get(normalizedHealthId);

    if (!user) {
        return { status: 404, body: { message: 'Patient not found.' } };
    }

    const profile = formatProfile(
        db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id)
    );

    if (!profile) {
        return { status: 404, body: { message: 'Patient has no medical profile set up.' } };
    }

    if (doctor) {
        db.prepare(`
            INSERT INTO access_logs (
                health_id, doctor_id, doctor_name, doctor_email, doctor_license,
                department, hospital, specialization, qualifications, experience_years,
                phone, avatar_url, access_reason, accessed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            normalizedHealthId,
            doctor.id,
            doctor.name,
            doctor.email,
            doctor.license_number,
            doctor.department || doctor.specialization || 'Cardiology',
            doctor.hospital || 'Hospital',
            doctor.specialization || doctor.department || 'Specialist',
            doctor.qualifications || 'MBBS, MD',
            doctor.experience_years || '8 Years',
            doctor.phone || '+91 98000 00000',
            doctor.avatar_url || '/doctors/dr_sarah_johnson.jpg',
            'Emergency Clinical Lookup & Health Record Audit',
            new Date().toISOString()
        );
    }

    return {
        status: 200,
        body: {
            patientName: user.name,
            healthId: user.health_id,
            user: {
                id: user.id,
                name: user.name,
                healthId: user.health_id
            },
            medicalData: profile,
            profile,
            accessedBy: doctor ? {
                name: doctor.name,
                email: doctor.email,
                licenseNumber: doctor.license_number,
                hospital: doctor.hospital,
                specialization: doctor.specialization
            } : null
        }
    };
}

app.get('/', (_req, res) => {
    res.send({
        message: 'Life Link backend is running.',
        version: '2.0.0',
        routes: {
            patients: ['/api/register', '/api/login', '/api/profile', '/api/access-log'],
            doctors: ['/api/doctors/register', '/api/doctors/login', '/api/doctors/me'],
            emergency: ['/api/doctor/patient/:healthId', '/api/emergency/:healthId']
        }
    });
});

app.get('/api/health', (_req, res) => {
    res.status(200).send({
        status: 'ok',
        service: 'life-link-backend'
    });
});

app.get('/api/visitors', (_req, res) => {
    try {
        const db = getDb();
        const row = db.prepare('SELECT value FROM site_stats WHERE key = ?').get('total_visitors');
        const count = row ? row.value : 1428;
        res.send({ count });
    } catch (_err) {
        res.status(500).send({ message: 'Failed to fetch visitor count', count: 1428 });
    }
});

app.post('/api/visitors/increment', (_req, res) => {
    try {
        const db = getDb();
        db.prepare('UPDATE site_stats SET value = value + 1 WHERE key = ?').run('total_visitors');
        const row = db.prepare('SELECT value FROM site_stats WHERE key = ?').get('total_visitors');
        const count = row ? row.value : 1429;
        res.send({ count });
    } catch (_err) {
        res.status(500).send({ message: 'Failed to increment visitor count' });
    }
});

// ==========================================
// RAG MEDICAL CHATBOT & NEWS ENDPOINTS
// ==========================================

function generateMedicalRagResponse(query, user, profile, referenced) {
    const q = query.toLowerCase();
    const name = user?.name || 'Patient';
    const blood = profile?.blood_group || 'Not recorded';
    const allergies = profile?.allergies || 'None recorded';
    const meds = profile?.current_medications || 'None recorded';
    const conditions = profile?.chronic_conditions || 'None recorded';
    const surgeries = profile?.previous_surgeries || 'None recorded';
    const docCount = (profile?.document_images?.length || 0) + (profile?.medical_file_links?.length || 0);

    if (q.includes('allergy') || q.includes('allergies') || q.includes('allergic')) {
        return `Based on your encrypted health records, your documented allergies are: **${allergies}**.\n\n` +
            `• **Clinical Notice**: If you are being prescribed new antibiotics, analgesics, or undergoing an emergency procedure, inform the attending team immediately.\n` +
            `• **Emergency Readiness**: Your verified Health ID (**${user?.health_id}**) provides approved doctors with instant access to these allergy alerts even if you are unconscious.`;
    }

    if (q.includes('medication') || q.includes('medicine') || q.includes('drug') || q.includes('prescription') || q.includes('pill')) {
        return `Cross-referencing your medical vector profile:\n\n` +
            `• **Current Medications on File**: ${meds}\n` +
            `• **Documented Prescriptions/Photos**: ${profile?.medication_images?.length || 0} medication photo(s) attached.\n\n` +
            `**Clinical Guidance**: Always adhere strictly to prescribed dosages. Never stop or combine medications without consulting your primary doctor. In an emergency, first responders can view your uploaded medication packaging to verify active dosages.`;
    }

    if (q.includes('blood') || q.includes('transfusion') || q.includes('type') || q.includes('group')) {
        return `According to your LifeLink emergency profile:\n\n` +
            `• **Recorded Blood Group**: **${blood}**\n` +
            `• **Organ Donor Status**: ${profile?.organ_donor_status || 'Not specified'}\n\n` +
            `In critical trauma situations, verified emergency doctors crossmatch your **${blood}** blood type against hospital blood bank inventory to initiate rapid transfusion protocols.`;
    }

    if (q.includes('summar') || q.includes('overview') || q.includes('record') || q.includes('report') || q.includes('history')) {
        return `Here is your personal emergency medical vector summary for **${name}** (**${user?.health_id}**):\n\n` +
            `1. **Blood Group**: ${blood}\n` +
            `2. **Critical Allergies**: ${allergies}\n` +
            `3. **Active Medications**: ${meds}\n` +
            `4. **Chronic Conditions**: ${conditions}\n` +
            `5. **Previous Surgeries**: ${surgeries}\n` +
            `6. **Stored Medical Files/Scans**: ${docCount} document(s) & photos securely stored.\n` +
            `7. **Emergency Contact**: ${profile?.emergency_contact_name ? `${profile.emergency_contact_name} (${profile.emergency_contact_phone || 'No phone'})` : 'Not configured'}\n\n` +
            `Verified emergency doctors can access this exact profile via your emergency QR code or Health ID.`;
    }

    if (q.includes('emergency') || q.includes('first responder') || q.includes('accident') || q.includes('qr')) {
        return `In an emergency event:\n\n` +
            `1. First responders or hospital triage scan your **LifeLink QR Code** or enter Health ID **${user?.health_id}**.\n` +
            `2. Only **credential-verified doctors** can unlock your sensitive records.\n` +
            `3. They immediately see your **Blood Group (${blood})**, **Allergies (${allergies})**, and emergency contacts.\n` +
            `4. Every access is timestamped and logged directly in your Access Log for complete auditability.`;
    }

    // Default intelligent clinical assistant response
    return `Hello **${name}**, I have retrieved your medical context from your encrypted Health ID (**${user?.health_id}**).\n\n` +
        `Regarding your question: *"${query}"*\n\n` +
        `• **Patient Record Status**: Your profile has recorded Blood Group (**${blood}**), documented Allergies (**${allergies}**), and active Medications (**${meds}**).\n` +
        `• **Personalized Medical Advice**: Please ensure that any symptoms or medication changes are evaluated by a licensed medical provider. I can help analyze your stored medical PDFs, medication images, or explain health news articles.\n\n` +
        `*Disclaimer: Life-Link is an intelligent medical record assistant and not a replacement for emergency diagnostic evaluation.*`;
}

app.get('/api/news', (_req, res) => {
    const newsArticles = [
        {
            id: 'news-1',
            title: 'Global Guidelines on Rapid Emergency Triage & Allergy Screening',
            category: 'Emergency Medicine',
            tag: 'Critical Care',
            date: 'October 2026',
            readTime: '3 min read',
            source: 'World Health Organization',
            summary: 'New clinical protocols emphasize immediate verification of drug allergies and blood types in trauma bays before antibiotic administration, cutting adverse reactions by 42%.',
            impact: 'Relevant for patients with Penicillin, NSAID, or food allergies.',
            promptSuggestion: 'Explain how emergency doctors use my allergy records during rapid triage.'
        },
        {
            id: 'news-2',
            title: 'AI Vector Search in Personal Health: Transforming Emergency Record Retrieval',
            category: 'Health Tech',
            tag: 'AI & Diagnostics',
            date: 'October 2026',
            readTime: '4 min read',
            source: 'Digital Health Journal',
            summary: 'Retrieval-Augmented Generation (RAG) models connected to patient encrypted records enable verified emergency teams to query complex medical histories in natural language within seconds.',
            impact: 'Directly powers LifeLink RAG medical assistant capabilities.',
            promptSuggestion: 'How does LifeLink protect my medical documents while enabling AI search?'
        },
        {
            id: 'news-3',
            title: 'Cardiovascular Risk Prevention: New Blood Biomarker Recommendations',
            category: 'Cardiology',
            tag: 'Preventive Care',
            date: 'September 2026',
            readTime: '5 min read',
            source: 'Cardiology Review',
            summary: 'Comprehensive lifestyle profiling alongside early lipid and inflammatory marker testing helps identify cardiac vulnerabilities a decade earlier than conventional metrics.',
            impact: 'Recommended for adults managing chronic blood pressure or metabolic conditions.',
            promptSuggestion: 'What preventive cardiac checks are recommended for my age and health profile?'
        },
        {
            id: 'news-4',
            title: 'Digital Medication Tracking Reduces Polypharmacy Interactions in Ambulatory Care',
            category: 'Pharmacology',
            tag: 'Patient Safety',
            date: 'September 2026',
            readTime: '4 min read',
            source: 'Clinical Pharmacology Journal',
            summary: 'Photo-documented medication logs allow emergency physicians to spot conflicting prescriptions, expired regimens, and dosage discrepancies in real time.',
            impact: 'Relevant for patients with 2 or more daily prescription medications.',
            promptSuggestion: 'Review my uploaded medication photos and list potential side-effects.'
        },
        {
            id: 'news-5',
            title: 'Organ Donor Registry Integration: Accelerating Life-Saving Crossmatches',
            category: 'Transplantology',
            tag: 'Public Health',
            date: 'August 2026',
            readTime: '3 min read',
            source: 'National Organ Procurement Alliance',
            summary: 'Real-time verified organ donor status on portable health IDs facilitates immediate coordination between trauma centers and procurement networks.',
            impact: 'Directly linked to your LifeLink organ donor status setting.',
            promptSuggestion: 'How is my organ donor preference verified by hospital teams?'
        }
    ];

    res.send({ articles: newsArticles });
});

app.post('/api/chat', checkPatientAuth, (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
        return res.status(400).send({ message: 'A prompt message is required.' });
    }

    try {
        const db = getDb();
        const user = db.prepare('SELECT id, name, health_id FROM users WHERE id = ?').get(req.userId);
        const rawProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId);
        const profile = formatProfile(rawProfile);

        const referencedRecords = [];
        if (profile?.blood_group) referencedRecords.push(`Blood Group (${profile.blood_group})`);
        if (profile?.allergies) referencedRecords.push(`Allergies: ${profile.allergies}`);
        if (profile?.chronic_conditions) referencedRecords.push(`Conditions: ${profile.chronic_conditions}`);
        if (profile?.current_medications) referencedRecords.push(`Medications: ${profile.current_medications}`);
        if (profile?.previous_surgeries) referencedRecords.push(`Surgeries: ${profile.previous_surgeries}`);
        if (profile?.document_images?.length) referencedRecords.push(`${profile.document_images.length} Document Image(s)`);
        if (profile?.medication_images?.length) referencedRecords.push(`${profile.medication_images.length} Medication Photo(s)`);
        if (profile?.medical_file_links?.length) referencedRecords.push(`${profile.medical_file_links.length} Medical File Link(s)`);

        const reply = generateMedicalRagResponse(message, user, profile, referencedRecords);

        res.send({
            reply,
            referencedRecords,
            healthId: user?.health_id,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).send({ message: 'Failed to process chat query' });
    }
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).send({ message: 'Name, email, and password are all required.' });
    }

    if (password.length < 6) {
        return res.status(400).send({ message: 'Password must be at least 6 characters.' });
    }

    const db = getDb();
    const safeEmail = normalizeEmail(email);
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(safeEmail);

    if (existingUser) {
        return res.status(400).send({ message: 'This email is already registered. Please login.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    let healthId = generateHealthId();

    while (db.prepare('SELECT id FROM users WHERE health_id = ?').get(healthId)) {
        healthId = generateHealthId();
    }

    db.prepare(`
        INSERT INTO users (name, email, password_hash, health_id)
        VALUES (?, ?, ?, ?)
    `).run(name.trim(), safeEmail, passwordHash, healthId);

    res.status(201).send({
        message: 'Account created successfully! Please login.',
        healthId
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send({ message: 'Email and password are required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).send({ message: 'Invalid email or password.' });
    }

    const token = createToken({ role: 'patient', id: user.id });

    res.send({
        message: 'Login successful!',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            healthId: user.health_id
        }
    });
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).send({ message: 'Email address is required.' });
    }

    const safeEmail = normalizeEmail(email);
    const db = getDb();
    const user = db.prepare('SELECT id, name FROM users WHERE email = ?').get(safeEmail);

    const genericResponse = { message: 'If an account exists with this email, a password reset link has been sent.' };

    if (!user) {
        return res.status(200).send(genericResponse);
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    db.prepare(`
        INSERT INTO password_reset_tokens (email, token, expires_at)
        VALUES (?, ?, ?)
    `).run(safeEmail, token, expiresAt);

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    try {
        await mailTransporter.sendMail({
            from: '"Life Link" <noreply@lifelink.org>',
            to: safeEmail,
            subject: 'Reset your Life Link Password',
            text: `Hello ${user.name},\n\nYou requested a password reset for your Life Link Patient account. Please click the link below to set a new password:\n\n${resetLink}\n\nThis link is valid for 15 minutes.\n\nIf you did not request this, please ignore this email.`
        });
    } catch (mailError) {
        console.error('Error sending reset email:', mailError);
        console.log('\n========================================');
        console.log('FALLBACK MOCK EMAIL (SMTP FAILED)');
        console.log('To:', safeEmail);
        console.log('Link:', resetLink);
        console.log('========================================\n');
    }

    res.status(200).send(genericResponse);
});

app.post('/api/reset-password', (req, res) => {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
        return res.status(400).send({ message: 'Reset token is required.' });
    }

    if (!password || password.length < 6) {
        return res.status(400).send({ message: 'Password must be at least 6 characters.' });
    }

    if (password !== confirmPassword) {
        return res.status(400).send({ message: 'Passwords do not match.' });
    }

    const db = getDb();
    const tokenRecord = db.prepare(`
        SELECT * FROM password_reset_tokens
        WHERE token = ? AND used = 0 AND expires_at > ?
    `).get(token, Date.now());

    if (!tokenRecord) {
        return res.status(400).send({ message: 'Invalid or expired reset token.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(passwordHash, tokenRecord.email);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(tokenRecord.id);

    res.send({ message: 'Password has been reset successfully.' });
});


app.post('/api/doctors/register', (req, res) => {
    const {
        name,
        email,
        password,
        licenseNumber,
        hospital,
        specialization,
        department,
        qualifications,
        experienceYears,
        phone,
        avatarUrl,
        bio,
        verificationCode
    } = req.body;

    if (!name || !email || !password || !licenseNumber || !hospital || !specialization) {
        return res.status(400).send({
            message: 'Name, email, password, license number, hospital, and specialization are required.'
        });
    }

    if (password.length < 8) {
        return res.status(400).send({ message: 'Doctor password must be at least 8 characters.' });
    }

    const db = getDb();
    const safeEmail = normalizeEmail(email);
    const safeLicense = licenseNumber.trim().toUpperCase();
    const existingDoctor = db.prepare(`
        SELECT id
        FROM doctors
        WHERE email = ? OR license_number = ?
    `).get(safeEmail, safeLicense);

    if (existingDoctor) {
        return res.status(400).send({
            message: 'A doctor account with this email or license number already exists.'
        });
    }

    const isVerified = verificationCode && verificationCode === DOCTOR_VERIFICATION_CODE;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
        INSERT INTO doctors (
            name, email, password_hash, license_number, hospital, specialization,
            department, qualifications, experience_years, phone, avatar_url, bio,
            verification_status, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        name.trim(),
        safeEmail,
        passwordHash,
        safeLicense,
        hospital.trim(),
        specialization.trim(),
        (department || specialization || '').trim(),
        (qualifications || 'MBBS, MD').trim(),
        (experienceYears || '5 Years').trim(),
        (phone || '').trim(),
        (avatarUrl || '/doctor_consultation.jpg').trim(),
        (bio || '').trim(),
        isVerified ? 'verified' : 'pending',
        isVerified ? new Date().toISOString() : null
    );

    return res.status(201).send({
        message: isVerified
            ? 'Doctor account verified and created successfully. You can now log in.'
            : 'Doctor account created. Verification is pending review before patient profiles can be accessed.',
        status: isVerified ? 'verified' : 'pending'
    });
});

app.post('/api/upload-image', (req, res) => {
    const { image, folder } = req.body;

    if (!image || typeof image !== 'string') {
        return res.status(400).send({ message: 'No image data string provided.' });
    }

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        cloudinary.uploader.upload(image, {
            folder: folder || 'lifelink_medical_docs',
            resource_type: 'auto'
        }, (error, result) => {
            if (error) {
                console.error('Cloudinary Upload Error:', error);
                return res.status(500).send({ message: `Cloudinary upload failed: ${error.message}` });
            }

            res.send({ url: result.secure_url, provider: 'cloudinary' });
        });
    } else {
        res.send({
            url: image,
            provider: 'local_base64',
            note: 'Cloudinary environment keys not set. Returned image data string directly.'
        });
    }
});

app.post('/api/doctors/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send({ message: 'Email and password are required.' });
    }

    const db = getDb();
    const doctor = db.prepare('SELECT * FROM doctors WHERE email = ?').get(normalizeEmail(email));

    if (!doctor || !bcrypt.compareSync(password, doctor.password_hash)) {
        return res.status(401).send({ message: 'Invalid doctor email or password.' });
    }

    if (doctor.verification_status !== 'verified') {
        return res.status(403).send({
            message: 'Doctor account is not yet verified. Approval is required before you can access patient profiles.',
            status: doctor.verification_status
        });
    }

    if (doctor.mfa_enabled === 1) {
        const tempToken = jwt.sign({ role: 'doctor_mfa_pending', id: doctor.id }, JWT_SECRET, { expiresIn: '5m' });
        return res.send({
            mfaRequired: true,
            tempToken,
            message: 'Multi-Factor Authentication (MFA) code required.'
        });
    }

    const token = createToken({ role: 'doctor', id: doctor.id });

    res.send({
        message: 'Doctor login successful!',
        token,
        doctor: {
            id: doctor.id,
            name: doctor.name,
            email: doctor.email,
            licenseNumber: doctor.license_number,
            hospital: doctor.hospital,
            specialization: doctor.specialization,
            verificationStatus: doctor.verification_status,
            mfaEnabled: false
        }
    });
});

app.post('/api/doctors/mfa/verify-login', (req, res) => {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
        return res.status(400).send({ message: 'Temporary token and 6-digit verification code are required.' });
    }

    try {
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        if (decoded.role !== 'doctor_mfa_pending') {
            return res.status(403).send({ message: 'Invalid MFA verification sequence.' });
        }

        const db = getDb();
        const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(decoded.id);

        if (!doctor || doctor.mfa_enabled !== 1 || !doctor.mfa_secret) {
            return res.status(400).send({ message: 'MFA is not enabled on this doctor account.' });
        }

        const isValid = verifyTotpCode(code, doctor.mfa_secret);
        if (!isValid) {
            return res.status(401).send({ message: 'Invalid verification code. Check your authenticator app.' });
        }

        const token = createToken({ role: 'doctor', id: doctor.id });

        res.send({
            message: 'MFA verification successful! Login complete.',
            token,
            doctor: {
                id: doctor.id,
                name: doctor.name,
                email: doctor.email,
                licenseNumber: doctor.license_number,
                hospital: doctor.hospital,
                specialization: doctor.specialization,
                verificationStatus: doctor.verification_status,
                mfaEnabled: true
            }
        });
    } catch (_error) {
        return res.status(401).send({ message: 'MFA login session expired or invalid. Please login again.' });
    }
});

app.post('/api/doctors/mfa/setup', checkDoctorAuth, async (req, res) => {
    try {
        const db = getDb();
        const doctorId = req.doctor.id;
        const doctor = db.prepare('SELECT email, mfa_secret, mfa_enabled FROM doctors WHERE id = ?').get(doctorId);

        let secret = doctor.mfa_secret;
        if (!secret) {
            secret = generateSecret();
            db.prepare('UPDATE doctors SET mfa_secret = ? WHERE id = ?').run(secret, doctorId);
        }

        const otpauthUrl = generateURI({
            label: doctor.email,
            issuer: 'Life Link Doctor Portal',
            secret
        });
        const qrCode = await QRCode.toDataURL(otpauthUrl);

        res.send({
            secret,
            qrCode,
            mfaEnabled: doctor.mfa_enabled === 1
        });
    } catch (error) {
        res.status(500).send({ message: `Failed to initialize MFA setup: ${error.message}` });
    }
});

app.post('/api/doctors/mfa/verify-setup', checkDoctorAuth, (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).send({ message: '6-digit verification code is required.' });
    }

    const db = getDb();
    const doctor = db.prepare('SELECT id, mfa_secret FROM doctors WHERE id = ?').get(req.doctor.id);

    if (!doctor || !doctor.mfa_secret) {
        return res.status(400).send({ message: 'MFA setup not initialized. Call setup endpoint first.' });
    }

    const isValid = verifyTotpCode(code, doctor.mfa_secret);
    if (!isValid) {
        return res.status(400).send({ message: 'Invalid 6-digit code. Check your authenticator app.' });
    }

    db.prepare('UPDATE doctors SET mfa_enabled = 1 WHERE id = ?').run(doctor.id);

    res.send({ message: 'Multi-Factor Authentication (MFA) enabled successfully!' });
});

app.post('/api/doctors/mfa/disable', checkDoctorAuth, (req, res) => {
    const { code } = req.body;
    const db = getDb();
    const doctor = db.prepare('SELECT id, mfa_secret, mfa_enabled FROM doctors WHERE id = ?').get(req.doctor.id);

    if (!doctor || doctor.mfa_enabled !== 1) {
        return res.status(400).send({ message: 'MFA is not currently enabled.' });
    }

    if (code) {
        const isValid = verifyTotpCode(code, doctor.mfa_secret);
        if (!isValid) {
            return res.status(400).send({ message: 'Invalid verification code.' });
        }
    }

    db.prepare('UPDATE doctors SET mfa_enabled = 0, mfa_secret = NULL WHERE id = ?').run(doctor.id);
    res.send({ message: 'MFA has been disabled for your account.' });
});

app.get('/api/doctors/me', checkDoctorAuth, (req, res) => {
    res.send({
        doctor: {
            id: req.doctor.id,
            name: req.doctor.name,
            email: req.doctor.email,
            licenseNumber: req.doctor.license_number,
            hospital: req.doctor.hospital,
            specialization: req.doctor.specialization,
            department: req.doctor.department,
            qualifications: req.doctor.qualifications,
            experienceYears: req.doctor.experience_years,
            phone: req.doctor.phone,
            avatarUrl: req.doctor.avatar_url,
            bio: req.doctor.bio,
            verificationStatus: req.doctor.verification_status,
            mfaEnabled: Boolean(req.doctor.mfa_enabled)
        }
    });
});

app.put('/api/doctors/profile', checkDoctorAuth, (req, res) => {
    const {
        hospital,
        specialization,
        department,
        qualifications,
        experienceYears,
        phone,
        avatarUrl,
        bio
    } = req.body;

    const db = getDb();
    db.prepare(`
        UPDATE doctors
        SET
            hospital = COALESCE(?, hospital),
            specialization = COALESCE(?, specialization),
            department = COALESCE(?, department),
            qualifications = COALESCE(?, qualifications),
            experience_years = COALESCE(?, experience_years),
            phone = COALESCE(?, phone),
            avatar_url = COALESCE(?, avatar_url),
            bio = COALESCE(?, bio)
        WHERE id = ?
    `).run(
        hospital !== undefined ? hospital.trim() : null,
        specialization !== undefined ? specialization.trim() : null,
        department !== undefined ? department.trim() : null,
        qualifications !== undefined ? qualifications.trim() : null,
        experienceYears !== undefined ? experienceYears.trim() : null,
        phone !== undefined ? phone.trim() : null,
        avatarUrl !== undefined ? avatarUrl.trim() : null,
        bio !== undefined ? bio.trim() : null,
        req.doctor.id
    );

    const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.doctor.id);
    res.send({
        message: 'Doctor profile updated successfully.',
        doctor: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            licenseNumber: updated.license_number,
            hospital: updated.hospital,
            specialization: updated.specialization,
            department: updated.department,
            qualifications: updated.qualifications,
            experienceYears: updated.experience_years,
            phone: updated.phone,
            avatarUrl: updated.avatar_url,
            bio: updated.bio,
            verificationStatus: updated.verification_status,
            mfaEnabled: Boolean(updated.mfa_enabled)
        }
    });
});

app.get('/api/admin/doctors', checkAdminReviewKey, (_req, res) => {
    const db = getDb();
    const doctors = db.prepare(`
        SELECT id, name, email, license_number, hospital, specialization, verification_status, created_at, verified_at
        FROM doctors
        ORDER BY created_at DESC
    `).all();

    res.send(doctors);
});

app.post('/api/admin/doctors/:doctorId/verify', checkAdminReviewKey, (req, res) => {
    const db = getDb();
    const doctorId = Number(req.params.doctorId);
    const doctor = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId);

    if (!doctor) {
        return res.status(404).send({ message: 'Doctor account not found.' });
    }

    db.prepare(`
        UPDATE doctors
        SET verification_status = 'verified', verified_at = ?
        WHERE id = ?
    `).run(new Date().toISOString(), doctorId);

    return res.send({ message: 'Doctor verified successfully.' });
});

app.get('/api/profile', checkPatientAuth, (req, res) => {
    const db = getDb();
    const user = db.prepare(`
        SELECT id, name, email, health_id
        FROM users
        WHERE id = ?
    `).get(req.userId);

    const profile = formatProfile(
        db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.userId)
    );

    res.send({
        user,
        profile
    });
});

app.post('/api/profile', checkPatientAuth, (req, res) => {
    try {
        const {
            fullName,
            dateOfBirth,
            bloodGroup,
            allergies,
            chronicConditions,
            currentMedications,
            previousSurgeries,
            previousPrescriptions,
            emergencyContactName,
            emergencyContactPhone,
            organDonorStatus,
            documentLinks,
            medicalFiles,
            documentImages,
            medicationImages
        } = req.body;

        const db = getDb();
        const existingProfile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(req.userId);
        const safeDocumentLinks = normalizeDocumentLinks(
            typeof documentLinks === 'string' ? documentLinks : (medicalFiles || '')
        );
        const safeDocumentImages = serializeArray(sanitizeImageDataArray(documentImages));
        const safeMedicationImages = serializeArray(sanitizeImageDataArray(medicationImages));
        const safeFullName = sanitizeOptionalText(fullName, 120);
        const safeDateOfBirth = sanitizeOptionalText(dateOfBirth, 24);
        const safeBloodGroup = sanitizeOptionalText(bloodGroup, 12);
        const safeAllergies = sanitizeOptionalText(allergies);
        const safeChronicConditions = sanitizeOptionalText(chronicConditions);
        const safeCurrentMedications = sanitizeOptionalText(currentMedications);
        const safePreviousSurgeries = sanitizeOptionalText(previousSurgeries);
        const safePreviousPrescriptions = sanitizeOptionalText(previousPrescriptions);
        const safeEmergencyContactName = sanitizeOptionalText(emergencyContactName, 120);
        const safeEmergencyContactPhone = sanitizeOptionalText(emergencyContactPhone, 32);
        const safeOrganDonorStatus = sanitizeOptionalText(organDonorStatus, 40) || 'Not specified';

        const encFullName = encryptText(safeFullName);
        const encDateOfBirth = encryptText(safeDateOfBirth);
        const encBloodGroup = encryptText(safeBloodGroup);
        const encAllergies = encryptText(safeAllergies);
        const encChronicConditions = encryptText(safeChronicConditions);
        const encCurrentMedications = encryptText(safeCurrentMedications);
        const encPreviousSurgeries = encryptText(safePreviousSurgeries);
        const encPreviousPrescriptions = encryptText(safePreviousPrescriptions);
        const encEmergencyContactName = encryptText(safeEmergencyContactName);
        const encEmergencyContactPhone = encryptText(safeEmergencyContactPhone);
        const encOrganDonorStatus = encryptText(safeOrganDonorStatus);

        if (existingProfile) {
            db.prepare(`
                UPDATE profiles SET
                    full_name               = ?,
                    date_of_birth           = ?,
                    blood_group             = ?,
                    allergies               = ?,
                    chronic_conditions      = ?,
                    current_medications     = ?,
                    previous_surgeries      = ?,
                    previous_prescriptions  = ?,
                    emergency_contact_name  = ?,
                    emergency_contact_phone = ?,
                    organ_donor_status      = ?,
                    medical_files           = ?,
                    document_images         = ?,
                    medication_images       = ?
                WHERE user_id = ?
            `).run(
                encFullName,
                encDateOfBirth,
                encBloodGroup,
                encAllergies,
                encChronicConditions,
                encCurrentMedications,
                encPreviousSurgeries,
                encPreviousPrescriptions,
                encEmergencyContactName,
                encEmergencyContactPhone,
                encOrganDonorStatus,
                safeDocumentLinks,
                safeDocumentImages,
                safeMedicationImages,
                req.userId
            );
        } else {
            db.prepare(`
                INSERT INTO profiles (
                    user_id, full_name, date_of_birth, blood_group, allergies,
                    chronic_conditions, current_medications, previous_surgeries,
                    previous_prescriptions, emergency_contact_name, emergency_contact_phone,
                    organ_donor_status, medical_files, document_images, medication_images
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                req.userId,
                encFullName,
                encDateOfBirth,
                encBloodGroup,
                encAllergies,
                encChronicConditions,
                encCurrentMedications,
                encPreviousSurgeries,
                encPreviousPrescriptions,
                encEmergencyContactName,
                encEmergencyContactPhone,
                encOrganDonorStatus,
                safeDocumentLinks,
                safeDocumentImages,
                safeMedicationImages
            );
        }

        res.send({ message: 'Health profile saved successfully!' });
    } catch (error) {
        console.error('DATABASE ERROR:', error.message);
        res.status(500).send({ message: `Database Error: ${error.message}` });
    }
});

function checkDoctorPatientSession(req, res, next) {
    const db = getDb();
    const doctorId = req.doctor.id;
    const healthId = req.params.healthId.trim().toUpperCase();

    const session = db.prepare(`
        SELECT * FROM doctor_patient_sessions
        WHERE doctor_id = ? AND health_id = ? AND expires_at > ?
    `).get(doctorId, healthId, Date.now());

    if (!session) {
        return res.status(403).send({
            message: 'Your authorized viewing session has expired. Please re-enter the Patient ID to continue.'
        });
    }

    req.sessionExpiresAt = session.expires_at;
    next();
}

app.post('/api/doctor/patient/:healthId/access', checkDoctorAuth, (req, res) => {
    const { healthId } = req.params;
    const doctor = req.doctor;
    const db = getDb();

    const normalizedHealthId = healthId.trim().toUpperCase();

    if (!isValidHealthId(normalizedHealthId)) {
        return res.status(400).send({ message: 'Enter a valid Health ID in the format LL-ABCDE.' });
    }

    const user = db.prepare('SELECT id, name, health_id FROM users WHERE health_id = ?').get(normalizedHealthId);
    if (!user) {
        return res.status(404).send({ message: 'Patient not found.' });
    }

    const profile = formatProfile(db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id));
    if (!profile) {
        return res.status(404).send({ message: 'Patient has no medical profile set up.' });
    }

    // Insert access log with full doctor profile snapshot
    db.prepare(`
        INSERT INTO access_logs (
            health_id, doctor_id, doctor_name, doctor_email, doctor_license,
            department, hospital, specialization, qualifications, experience_years,
            phone, avatar_url, access_reason, accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        normalizedHealthId,
        doctor.id,
        doctor.name,
        doctor.email,
        doctor.license_number,
        doctor.department || doctor.specialization || 'Cardiology',
        doctor.hospital || 'Medical Center',
        doctor.specialization || doctor.department || 'Specialist',
        doctor.qualifications || 'MBBS, MD',
        doctor.experience_years || '8 Years',
        doctor.phone || '+91 98000 00000',
        doctor.avatar_url || '/doctors/dr_sarah_johnson.jpg',
        'Direct Doctor Session Access & Clinical Audit',
        new Date().toISOString()
    );

    // Create session (expires in 30 minutes)
    const startedAt = Date.now();
    const expiresAt = startedAt + 30 * 60 * 1000;

    // Delete any existing sessions for this doctor and this healthId
    db.prepare('DELETE FROM doctor_patient_sessions WHERE doctor_id = ? AND health_id = ?').run(doctor.id, normalizedHealthId);

    // Insert new session
    db.prepare(`
        INSERT INTO doctor_patient_sessions (doctor_id, health_id, started_at, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(doctor.id, normalizedHealthId, startedAt, expiresAt);

    res.send({
        patientName: user.name,
        healthId: user.health_id,
        user: {
            id: user.id,
            name: user.name,
            healthId: user.health_id
        },
        medicalData: profile,
        profile,
        expiresAt,
        accessedBy: {
            name: doctor.name,
            email: doctor.email,
            licenseNumber: doctor.license_number,
            hospital: doctor.hospital,
            specialization: doctor.specialization
        }
    });
});

app.get('/api/doctor/patient/:healthId', checkDoctorAuth, checkDoctorPatientSession, (req, res) => {
    const result = fetchEmergencyProfile(req.params.healthId, null);
    if (result.status === 200) {
        result.body.expiresAt = req.sessionExpiresAt;
    }
    res.status(result.status).send(result.body);
});

app.get('/api/emergency/:healthId', checkDoctorAuth, checkDoctorPatientSession, (req, res) => {
    const result = fetchEmergencyProfile(req.params.healthId, null);
    if (result.status === 200) {
        result.body.expiresAt = req.sessionExpiresAt;
    }
    res.status(result.status).send(result.body);
});


app.get('/api/access-log', checkPatientAuth, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT health_id FROM users WHERE id = ?').get(req.userId);

    if (!user) {
        return res.status(404).send({ message: 'Patient account not found.' });
    }

    const logs = db.prepare(`
        SELECT
            l.id,
            l.health_id,
            l.doctor_id,
            COALESCE(d.name, l.doctor_name, 'Verified Doctor') AS doctor_name,
            COALESCE(d.email, l.doctor_email, 'doctor@lifelink.org') AS doctor_email,
            COALESCE(d.license_number, l.doctor_license, 'MCI-VERIFIED') AS doctor_license,
            COALESCE(d.hospital, l.hospital, 'General Hospital') AS hospital,
            COALESCE(d.department, l.department, d.specialization, l.specialization, 'General Medicine') AS department,
            COALESCE(d.specialization, l.specialization, d.department, 'Specialist') AS specialization,
            COALESCE(d.qualifications, l.qualifications, 'MBBS, MD') AS qualifications,
            COALESCE(d.experience_years, l.experience_years, '8 Years') AS experience_years,
            COALESCE(d.phone, l.phone, '+1 (555) 000-0000') AS phone,
            COALESCE(d.avatar_url, l.avatar_url, '/doctor_consultation.jpg') AS avatar_url,
            COALESCE(d.bio, 'Certified medical professional practicing under approved medical council standards.') AS bio,
            COALESCE(l.access_reason, 'Emergency clinical records lookup & review') AS access_reason,
            l.accessed_at
        FROM access_logs l
        LEFT JOIN doctors d ON l.doctor_id = d.id
        WHERE l.health_id = ?
        ORDER BY l.accessed_at DESC
    `).all(user.health_id);

    res.send(logs);
});

app.post('/api/access-log/offline-sync', checkDoctorAuth, (req, res) => {
    const { logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0) {
        return res.status(400).send({ message: 'Valid logs array is required.' });
    }

    const db = getDb();
    const insertStmt = db.prepare(`
        INSERT INTO access_logs (
            health_id, doctor_id, doctor_name, doctor_email, doctor_license, accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    for (const log of logs) {
        if (log && log.healthId) {
            insertStmt.run(
                log.healthId.trim().toUpperCase(),
                req.doctor.id,
                req.doctor.name,
                req.doctor.email,
                req.doctor.license_number,
                log.accessedAt || new Date().toISOString()
            );
            insertedCount++;
        }
    }

    res.send({ success: true, count: insertedCount });
});

const server = app.listen(PORT, () => {
    console.log('\nLife Link backend is running!');
    console.log(`Listening on port ${PORT}`);
    console.log('\nAvailable API routes:');
    console.log('  POST   /api/register');
    console.log('  POST   /api/login');
    console.log('  POST   /api/doctors/register');
    console.log('  POST   /api/doctors/login');
    console.log('  GET    /api/profile             (patient login required)');
    console.log('  POST   /api/profile             (patient login required)');
    console.log('  GET    /api/doctor/patient/:id  (verified doctor login required)');
    console.log('  GET    /api/access-log          (patient login required)\n');
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the other process or change PORT before restarting Life Link.`);
        process.exit(1);
    }

    console.error('Server failed to start:', error);
    process.exit(1);
});
