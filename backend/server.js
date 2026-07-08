require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { initDatabase, getDb } = require('./database');

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

function sanitizeImageDataArray(value, maxItems = 6) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(
            (item) =>
                typeof item === 'string'
                && item.startsWith('data:image/')
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
            SELECT id, name, email, license_number, hospital, specialization, verification_status
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
                health_id, doctor_id, doctor_name, doctor_email, doctor_license, accessed_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            normalizedHealthId,
            doctor.id,
            doctor.name,
            doctor.email,
            doctor.license_number,
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
            name, email, password_hash, license_number, hospital, specialization, verification_status, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        name.trim(),
        safeEmail,
        passwordHash,
        safeLicense,
        hospital.trim(),
        specialization.trim(),
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
            verificationStatus: doctor.verification_status
        }
    });
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
            verificationStatus: req.doctor.verification_status
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
                safeFullName,
                safeDateOfBirth,
                safeBloodGroup,
                safeAllergies,
                safeChronicConditions,
                safeCurrentMedications,
                safePreviousSurgeries,
                safePreviousPrescriptions,
                safeEmergencyContactName,
                safeEmergencyContactPhone,
                safeOrganDonorStatus,
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
                safeFullName,
                safeDateOfBirth,
                safeBloodGroup,
                safeAllergies,
                safeChronicConditions,
                safeCurrentMedications,
                safePreviousSurgeries,
                safePreviousPrescriptions,
                safeEmergencyContactName,
                safeEmergencyContactPhone,
                safeOrganDonorStatus,
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

    // Insert access log
    db.prepare(`
        INSERT INTO access_logs (
            health_id, doctor_id, doctor_name, doctor_email, doctor_license, accessed_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        normalizedHealthId,
        doctor.id,
        doctor.name,
        doctor.email,
        doctor.license_number,
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
        SELECT id, health_id, doctor_id, doctor_name, doctor_email, doctor_license, accessed_at
        FROM access_logs
        WHERE health_id = ?
        ORDER BY accessed_at DESC
    `).all(user.health_id);

    res.send(logs);
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
