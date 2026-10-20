// backend/r2Storage.js — Cloudflare R2 Storage Service for Life-Link
// Encrypted, secure, multi-tenant cloud storage for patient medical documents

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'lifelink-health-records';
const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

let s3Client = null;

function getS3Client() {
    if (!s3Client) {
        if (!accessKeyId || !secretAccessKey || !endpoint) {
            console.warn('[R2 Storage] Warning: R2 credentials are not fully configured in environment.');
            return null;
        }

        s3Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            }
        });
    }

    return s3Client;
}

/**
 * Upload buffer to Cloudflare R2
 */
async function uploadToR2({ buffer, key, contentType, metadata = {} }) {
    const s3 = getS3Client();
    if (!s3) {
        throw new Error('Cloudflare R2 client is not configured.');
    }

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        Metadata: metadata
    });

    await s3.send(command);
    return {
        bucket: bucketName,
        key: key
    };
}

/**
 * Generate a secure Presigned URL for downloading the file as an attachment
 */
async function getPresignedDownloadUrl(key, filename, expiresIn = 900) {
    const s3 = getS3Client();
    if (!s3) {
        throw new Error('Cloudflare R2 client is not configured.');
    }

    const sanitizedFilename = (filename || 'medical_document')
        .replace(/["\r\n\\]/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${sanitizedFilename}"`
    });

    return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Generate a secure Presigned URL for viewing/previewing the file directly in a browser
 */
async function getPresignedViewUrl(key, filename, expiresIn = 900) {
    const s3 = getS3Client();
    if (!s3) {
        throw new Error('Cloudflare R2 client is not configured.');
    }

    const sanitizedFilename = (filename || 'medical_document')
        .replace(/["\r\n\\]/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_');

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ResponseContentDisposition: `inline; filename="${sanitizedFilename}"`
    });

    return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete object from Cloudflare R2
 */
async function deleteFromR2(key) {
    const s3 = getS3Client();
    if (!s3) {
        throw new Error('Cloudflare R2 client is not configured.');
    }

    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
    });

    await s3.send(command);
    return { success: true };
}

/**
 * Utility to format bytes into readable strings (KB, MB)
 */
function formatBytes(bytes, decimals = 1) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = {
    getS3Client,
    uploadToR2,
    getPresignedDownloadUrl,
    getPresignedViewUrl,
    deleteFromR2,
    formatBytes,
    bucketName
};
