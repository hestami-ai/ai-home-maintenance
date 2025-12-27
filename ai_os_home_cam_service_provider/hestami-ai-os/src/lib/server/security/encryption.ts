/**
 * Encryption utilities for staff activation codes
 * Uses AES-256-GCM for secure encryption
 */
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

// Lazy-loaded key to avoid throwing at module load time
let _key: Buffer | null = null;

function getKey(): Buffer {
    if (_key) return _key;

    const keyHex = process.env.HESTAMI_ACTIVATION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error(
            'HESTAMI_ACTIVATION_KEY must be a 32-byte hex string (64 characters). Check your .env file.'
        );
    }
    _key = Buffer.from(keyHex, 'hex');
    return _key;
}

/**
 * Encrypts a text string using AES-256-GCM
 * Returns format: iv:authTag:ciphertext (all hex)
 */
export function encrypt(text: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a text string using AES-256-GCM
 * Expects format: iv:authTag:ciphertext (all hex)
 */
export function decrypt(ciphertext: string): string {
    const key = getKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Generates an 8-character alphanumeric activation code
 * Uses cryptographically secure random number generation
 */
export function generateActivationCode(): string {
    // Using upper case + numbers for readability (removed I, 1, O, 0 for clarity)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const length = 8;
    const randomBytes = crypto.randomBytes(length);

    let result = '';
    for (let i = 0; i < length; i++) {
        const index = randomBytes[i] % chars.length;
        result += chars[index];
    }

    return result;
}
