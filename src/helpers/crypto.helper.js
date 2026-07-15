const crypto = require('crypto');
const ApiError = require('./ApiError.helper');

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new ApiError(500, 'WALLET_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
};

// Returns "iv:authTag:ciphertext" (all hex) so encrypted_pk stays a single text column.
const encrypt = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

const decrypt = (payload) => {
  const [ivHex, authTagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new ApiError(500, 'Malformed encrypted payload');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};

module.exports = { encrypt, decrypt };
