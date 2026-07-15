const { ethers } = require('ethers');
const { getProvider, getContract } = require('../config/web3.config');
const { getSigner } = require('../helpers/wallet.helper');

const signerFor = (encryptedPk) => getSigner(encryptedPk, getProvider());

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
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

const transferResponsibilityOnChain = async (companyEncryptedPk, passportNumber, newResponsibleAddress) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.transferResponsibility(passportNumber, newResponsibleAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

// Read-only: fetches the current on-chain state of a passport via the configured RPC (Infura).
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

module.exports = {
  fundCompanyWallet,
  authorizeCompanyOnChain,
  removeAuthorizedCompanyOnChain,
  createPassportOnChain,
  updatePassportOnChain,
  transferResponsibilityOnChain,
  getPassportFromChain,
  isCompanyAuthorizedOnChain,
};
