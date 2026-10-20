// backend/ragLoader.js — Stage 1: Document Text Ingestion & Parsing for Life-Link RAG
// Extracts clean, page-indexed medical text from PDFs, text files, and medical reports.

const { PDFParse } = require('pdf-parse');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { getS3Client, bucketName } = require('./r2Storage');

/**
 * Normalizes and sanitizes extracted medical text.
 * Preserves critical clinical abbreviations, numerical ranges, lab units, and timestamps
 * while stripping unprintable characters and collapsing excessive whitespace.
 */
function cleanMedicalText(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    return rawText
        // Replace non-standard whitespace / non-breaking spaces with standard space
        .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        // Strip non-printable control characters (keep standard newlines, tabs, and carriage returns)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Clean up repeated newlines (more than 2 into 2)
        .replace(/\n{3,}/g, '\n\n')
        // Trim individual line trailing whitespace
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .trim();
}

/**
 * Extracts text from an in-memory file Buffer.
 * Supports PDF documents, text/markdown files, and medical report attachments.
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - MIME type of the file
 * @param {string} originalName - Original filename
 * @returns {Promise<{
 *   success: boolean,
 *   mimeType: string,
 *   fileName: string,
 *   totalPages: number,
 *   pages: Array<{ num: number, text: string, charCount: number }>,
 *   fullText: string,
 *   charCount: number,
 *   wordCount: number
 * }>}
 */
async function extractTextFromBuffer(buffer, mimeType = '', originalName = '') {
    if (!buffer || !Buffer.isBuffer(buffer)) {
        throw new Error('A valid file buffer is required for text extraction.');
    }

    const isPdf = mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
    const isText = mimeType.startsWith('text/') || originalName.match(/\.(txt|md|csv|json)$/i);
    const isImage = mimeType.startsWith('image/') || originalName.match(/\.(png|jpe?g|webp|heic|heif)$/i);

    if (isPdf) {
        try {
            const parser = new PDFParse({ data: buffer });
            const result = await parser.getText();
            const totalPages = result.total || (result.pages ? result.pages.length : 1);

            const cleanedPages = (result.pages || []).map((p) => {
                const cleaned = cleanMedicalText(p.text);
                return {
                    num: p.num || 1,
                    text: cleaned,
                    charCount: cleaned.length
                };
            });

            // If parser returned 0 structured pages but provided top-level text
            if (cleanedPages.length === 0 && result.text) {
                const cleaned = cleanMedicalText(result.text);
                cleanedPages.push({
                    num: 1,
                    text: cleaned,
                    charCount: cleaned.length
                });
            }

            const fullText = cleanedPages
                .map((p) => (totalPages > 1 ? `[Page ${p.num}]\n${p.text}` : p.text))
                .join('\n\n');

            const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;

            return {
                success: true,
                mimeType: 'application/pdf',
                fileName: originalName,
                totalPages,
                pages: cleanedPages,
                fullText,
                charCount: fullText.length,
                wordCount
            };
        } catch (pdfErr) {
            console.error('[RAG Loader] Error parsing PDF text:', pdfErr.message);
            throw new Error('Failed to parse text from PDF document: ' + pdfErr.message);
        }
    }

    if (isText) {
        const textContent = cleanMedicalText(buffer.toString('utf8'));
        const wordCount = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0;

        return {
            success: true,
            mimeType: mimeType || 'text/plain',
            fileName: originalName,
            totalPages: 1,
            pages: [
                {
                    num: 1,
                    text: textContent,
                    charCount: textContent.length
                }
            ],
            fullText: textContent,
            charCount: textContent.length,
            wordCount
        };
    }

    if (isImage) {
        const imageNotice = `[Medical Image Record: ${originalName} - Diagnostic/Prescription Image Attached]`;
        return {
            success: true,
            mimeType: mimeType || 'image/jpeg',
            fileName: originalName,
            totalPages: 1,
            pages: [
                {
                    num: 1,
                    text: imageNotice,
                    charCount: imageNotice.length
                }
            ],
            fullText: imageNotice,
            charCount: imageNotice.length,
            wordCount: imageNotice.split(/\s+/).length
        };
    }

    // Fallback for generic binary/document
    const fallbackText = `[Medical Record Attachment: ${originalName}]`;
    return {
        success: true,
        mimeType: mimeType || 'application/octet-stream',
        fileName: originalName,
        totalPages: 1,
        pages: [{ num: 1, text: fallbackText, charCount: fallbackText.length }],
        fullText: fallbackText,
        charCount: fallbackText.length,
        wordCount: fallbackText.split(/\s+/).length
    };
}

/**
 * Downloads a document buffer directly from Cloudflare R2 object storage.
 * 
 * @param {string} fileKey - Object storage key in R2 bucket
 * @returns {Promise<Buffer>}
 */
async function fetchBufferFromR2(fileKey) {
    const s3 = getS3Client();
    if (!s3) {
        throw new Error('Cloudflare R2 client is not configured in environment.');
    }

    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileKey
    });

    const response = await s3.send(command);

    // Stream to Buffer
    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

/**
 * High-level Loader: Extracts clean text from either a provided Buffer or an R2 key.
 * 
 * @param {Object} options
 * @param {Buffer} [options.buffer] - Direct file buffer (e.g. from multer upload)
 * @param {string} [options.fileKey] - R2 file key if fetching from cloud
 * @param {string} [options.mimeType] - MIME type of the document
 * @param {string} [options.originalName] - Original file name
 */
async function loadAndExtractDocument({ buffer, fileKey, mimeType, originalName }) {
    let fileBuffer = buffer;

    if (!fileBuffer && fileKey) {
        fileBuffer = await fetchBufferFromR2(fileKey);
    }

    if (!fileBuffer) {
        throw new Error('Neither buffer nor fileKey was provided for document extraction.');
    }

    return await extractTextFromBuffer(fileBuffer, mimeType, originalName);
}

module.exports = {
    cleanMedicalText,
    extractTextFromBuffer,
    fetchBufferFromR2,
    loadAndExtractDocument
};
