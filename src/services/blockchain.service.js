

const { ethers } = require('ethers');
const { getProvider, getContract } = require('../config/web3.config');
const { getSigner } = require('../helpers/wallet.helper');

const signerFor = (encryptedPk) => getSigner(encryptedPk, getProvider());
const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

const assertBytes32 = (value, fieldName) => {
  if (typeof value !== 'string' || !BYTES32_REGEX.test(value)) {
    throw new TypeError(`${fieldName} must be a 0x-prefixed bytes32 value`);
  }
};

// Native POL/MATIC transfer from the admin's custodial wallet to a company's custodial wallet.
const fundCompanyWallet = async (adminEncryptedPk, toAddress, amountInEther) => {
  const adminSigner = signerFor(adminEncryptedPk);
  const tx = await adminSigner.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(String(amountInEther)),
  });
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

// Owner-only call: whitelists a company's wallet address on the contract.
const authorizeCompanyOnChain = async (adminEncryptedPk, companyWalletAddress) => {
  const adminSigner = signerFor(adminEncryptedPk);
  const contract = getContract(adminSigner);
  const tx = await contract.addAuthorizedCompany(companyWalletAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

const removeAuthorizedCompanyOnChain = async (adminEncryptedPk, companyWalletAddress) => {
  const adminSigner = signerFor(adminEncryptedPk);
  const contract = getContract(adminSigner);
  const tx = await contract.removeAuthorizedCompany(companyWalletAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

const createPassportOnChain = async (companyEncryptedPk, passportNumber, dataHashHex) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.createPassport(passportNumber, dataHashHex);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber, contractAddress: await contract.getAddress() };
};

const updatePassportOnChain = async (companyEncryptedPk, passportNumber, newDataHashHex, newVersion) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.updatePassport(passportNumber, newDataHashHex, newVersion);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber, contractAddress: await contract.getAddress() };
};

const transferResponsibilityOnChain = async (companyEncryptedPk, passportNumber, newResponsibleAddress) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.transferResponsibility(passportNumber, newResponsibleAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber, contractAddress: await contract.getAddress() };
};

// V2: submit only the Merkle root and batch metadata. Individual leaves/proofs remain off-chain.
const createPassportBatchOnChain = async (companyEncryptedPk, batchId, merkleRoot, passportCount) => {
  assertBytes32(batchId, 'batchId');
  assertBytes32(merkleRoot, 'merkleRoot');

  const count = Number(passportCount);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new TypeError('passportCount must be a positive safe integer');
  }

  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.createPassportBatch(batchId, merkleRoot, count);
  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    contractAddress: await contract.getAddress(),
  };
};

// V2 read helper. Returns exists:false rather than calling getMerkleBatch for a missing ID.
const getMerkleBatchFromChain = async (batchId) => {
  assertBytes32(batchId, 'batchId');
  const contract = getContract();
  const exists = await contract.merkleBatchExists(batchId);

  if (!exists) {
    return { exists: false, batchId };
  }

  const result = await contract.getMerkleBatch(batchId);
  return {
    exists: Boolean(result.exists),
    batchId,
    merkleRoot: result.merkleRoot,
    passportCount: Number(result.passportCount),
    issuer: result.issuer,
    createdAt: Number(result.createdAt),
    active: Boolean(result.active),
    contractAddress: await contract.getAddress(),
  };
};

// V2 read helper. The caller supplies the leaf hash and proof saved in passport_batch_items.
const verifyPassportOnChain = async (batchId, passportHash, proof) => {
  assertBytes32(batchId, 'batchId');
  assertBytes32(passportHash, 'passportHash');

  if (!Array.isArray(proof)) {
    throw new TypeError('proof must be an array of bytes32 values');
  }
  proof.forEach((item, index) => assertBytes32(item, `proof[${index}]`));

  const contract = getContract();
  return Boolean(await contract.verifyPassport(batchId, passportHash, proof));
};

// V2: only the original issuer wallet can deactivate its own batch.
const deactivatePassportBatchOnChain = async (companyEncryptedPk, batchId) => {
  assertBytes32(batchId, 'batchId');

  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.deactivateMerkleBatch(batchId);
  const receipt = await tx.wait();

  return {
    hash: tx.hash,
    blockNumber: receipt.blockNumber,
    contractAddress: await contract.getAddress(),
  };
};

// Read-only: fetches the current on-chain state of an individual passport.
const getPassportFromChain = async (passportNumber) => {
  const contract = getContract();
  const result = await contract.getPassport(passportNumber);

  return {
    passportNumber: result.passportNumber,
    latestDataHash: result.latestDataHash,
    currentVersion: Number(result.currentVersion),
    createdAt: Number(result.createdAt),
    updatedAt: Number(result.updatedAt),
    issuer: result.issuer,
    responsibleEntity: result.responsibleEntity,
    exists: result.exists,
  };
};

const isCompanyAuthorizedOnChain = async (address) => {
  const contract = getContract();
  return contract.authorizedCompanies(address);
};

const getBalanceByCompanyAddress = async (address) => {
  const provider = getProvider();
  return await provider.getBalance(address);
};

module.exports = {
  fundCompanyWallet,
  authorizeCompanyOnChain,
  removeAuthorizedCompanyOnChain,
  createPassportOnChain,
  updatePassportOnChain,
  transferResponsibilityOnChain,
  createPassportBatchOnChain,
  getMerkleBatchFromChain,
  verifyPassportOnChain,
  deactivatePassportBatchOnChain,
  getPassportFromChain,
  isCompanyAuthorizedOnChain,
  getBalanceByCompanyAddress,
};
