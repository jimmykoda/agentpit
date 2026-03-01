// ============================================
// AgentPit - API Key Encryption
// AES-256-GCM encryption for BYOK keys
// ============================================

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt an API key
 * @param plaintext The API key to encrypt
 * @returns Encrypted string in format: salt:iv:encrypted:tag (all hex)
 */
export function encrypt(plaintext: string): string {
  if (!config.encryption.masterKey) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive encryption key
  const key = deriveKey(config.encryption.masterKey, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag
  const tag = cipher.getAuthTag();

  // Return format: salt:iv:encrypted:tag
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}:${tag.toString('hex')}`;
}

/**
 * Decrypt an API key
 * @param ciphertext Encrypted string from encrypt()
 * @returns Decrypted API key
 */
export function decrypt(ciphertext: string): string {
  if (!config.encryption.masterKey) {
    throw new Error('ENCRYPTION_KEY not configured');
  }

  // Parse components
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format');
  }

  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const tag = Buffer.from(parts[3], 'hex');

  // Derive encryption key
  const key = deriveKey(config.encryption.masterKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // Decrypt
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Test encryption/decryption roundtrip
 */
export function testEncryption(): boolean {
  try {
    const testString = 'test-api-key-12345';
    const encrypted = encrypt(testString);
    const decrypted = decrypt(encrypted);
    return testString === decrypted;
  } catch (err) {
    return false;
  }
}
