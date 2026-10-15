
const test = require('node:test');
const assert = require('node:assert/strict');
const { ethers } = require('ethers');

const {
  hashPassportNumber,
  buildMerkleBatch,
  verifyPassportProof,
} =
require('../src/helpers/merkleBatch.helper');

test('passport hash matches Solidity getPassportHash()', () => {
  const passportNumber = 'BATT-0001';

  const expected = ethers.keccak256(
    ethers.toUtf8Bytes(passportNumber)
  );

  assert.equal(hashPassportNumber(passportNumber), expected);
});

test('builds and verifies a one-passport batch', () => {
  const batch = buildMerkleBatch(['BATT-0001']);
  const passport = batch.passports[0];

  assert.match(batch.batchId, /^0x[0-9a-fA-F]{64}$/);
  assert.match(batch.merkleRoot, /^0x[0-9a-fA-F]{64}$/);
  assert.equal(batch.passportCount, 1);

  // A one-leaf tree requires an empty proof.
  assert.deepEqual(passport.proof, []);
  assert.equal(batch.merkleRoot, passport.passportHash);

  assert.equal(
    verifyPassportProof({
      passportHash: passport.passportHash,
      merkleRoot: batch.merkleRoot,
      proof: passport.proof,
    }),
    true
  );
});

test('builds and verifies proofs for multiple passports', () => {
  const batch = buildMerkleBatch([
    'BATT-0001',
    'BATT-0002',
    'BATT-0003',
    'BATT-0004',
  ]);

  assert.equal(batch.passportCount, 4);

  for (const passport of batch.passports) {
    assert.equal(
      verifyPassportProof({
        passportHash: passport.passportHash,
        merkleRoot: batch.merkleRoot,
        proof: passport.proof,
      }),
      true,
      `Proof should validate for ${passport.passportNumber}`
    );
  }
});

test('rejects duplicate passport numbers', () => {
  assert.throws(
    () => buildMerkleBatch(['BATT-0001', 'BATT-0001']),
    /Duplicate passport number/
  );
});

test('rejects an empty batch', () => {
  assert.throws(
    () => buildMerkleBatch([]),
    /At least one passport number is required/
  );
});

test('rejects empty passport numbers', () => {
  assert.throws(
    () => buildMerkleBatch(['   ']),
    /Passport number cannot be empty/
  );
});

test('rejects a proof when the passport hash is not in the batch', () => {
  const batch = buildMerkleBatch([
    'BATT-0001',
    'BATT-0002',
    'BATT-0003',
  ]);

  const validPassport = batch.passports[0];
  const unrelatedHash = hashPassportNumber('BATT-9999');

  assert.equal(
    verifyPassportProof({
      passportHash: unrelatedHash,
      merkleRoot: batch.merkleRoot,
      proof: validPassport.proof,
    }),
    false
  );
});
