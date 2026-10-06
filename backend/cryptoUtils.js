const crypto = require('crypto');

const secretKey = process.env.ENCRYPTION_KEY || 'lifelink-default-encryption-secret-key-2026';
const derivedKey = crypto.createHash('sha256').update(secretKey).digest();

function encryptText(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    if (text.startsWith('enc:v1:')) {
        return text;
    }

    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag().toString('hex');

        return `enc:v1:${iv.toString('hex')}:${tag}:${encrypted}`;
    } catch (error) {
        console.error('Encryption failed:', error.message);
        return text;
    }
}

function decryptText(text) {
    if (!text || typeof text !== 'string') {
        return text;
    }

    if (!text.startsWith('enc:v1:')) {
        return text;
    }

    try {
        const parts = text.split(':');
        if (parts.length !== 5) {
            return text;
        }

        const ivHex = parts[2];
        const tagHex = parts[3];
        const encryptedHex = parts[4];

        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error.message);
        return text;
    }
}

module.exports = {
    encryptText,
    decryptText
};
