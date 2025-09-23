// src/utils/serialization.ts - Using bs58 and specific serialization functions

import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { ethers } from 'ethers';
import { ProviderError, ErrorCode } from '../types';
import { Buffer } from 'buffer';
/**
 * Encode a message for Solana signing using bs58
 */
export function encodeSolanaMessage(message: Uint8Array | string): string {
  // If it's a string, convert to Uint8Array first
  if (typeof message === 'string') {
    const encoder = new TextEncoder();
    return bs58.encode(encoder.encode(message));
  }
  // If it's already Uint8Array, encode directly
  return bs58.encode(message);
}

/**
 * Decode a Solana message from bs58
 */
export function decodeSolanaMessage(encodedMessage: string): Uint8Array {
  return bs58.decode(encodedMessage);
}

/**
 * Convert Ethereum transaction to plain object for JSON serialization
 */
export function ethereumTransactionToPlainObject(
  tx: ethers.TransactionRequest
): Record<string, any> {
  // Remove undefined values and convert BigInt to string
  const plainTx: Record<string, any> = {};

  if (tx.from) plainTx.from = tx.from.toString();
  if (tx.to) plainTx.to = tx.to.toString();
  if (tx.value) plainTx.value = tx.value.toString();
  if (tx.data) plainTx.data = tx.data;
  if (tx.nonce !== undefined) plainTx.nonce = tx.nonce;
  if (tx.gasLimit) plainTx.gasLimit = tx.gasLimit.toString();
  if (tx.gasPrice) plainTx.gasPrice = tx.gasPrice.toString();
  if (tx.maxFeePerGas) plainTx.maxFeePerGas = tx.maxFeePerGas.toString();
  if (tx.maxPriorityFeePerGas) plainTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas.toString();
  if (tx.chainId) plainTx.chainId = tx.chainId;

  return plainTx;
}

export const serializeBase64SolanaTransaction = (transaction: any): string => {
  try {
    const isVersionedTransaction = typeof transaction.version !== 'undefined';
    let serializedTransaction: string;
    if (isVersionedTransaction) {
      // Versioned transaction
      serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');
    } else {
      // Legacy transaction
      serializedTransaction = Buffer.from(
        (transaction as Transaction).serialize({ verifySignatures: false })
      ).toString('base64');
    }
    return serializedTransaction;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to serialize transaction: ${errorMessage}`);
  }
};

export const deserializeBase64SolanaTransaction = (
  serializedTransaction: string
): Transaction | VersionedTransaction => {
  const transactionBuffer = Buffer.from(serializedTransaction, 'base64');
  // If first byte is 0x80, it's definitely a versioned transaction
  const firstByte = transactionBuffer[0];
  // Or In Case Transaction has a version byte after the signature
  const versionByte = transactionBuffer[1 + 64 * firstByte];
  const isVersioned = firstByte === 0x80 || versionByte === 0x80;
  let transaction;
  if (isVersioned) {
    transaction = VersionedTransaction.deserialize(transactionBuffer);
  } else {
    transaction = Transaction.from(transactionBuffer);
  }
  return transaction;
};

export function decodeMessage(encodedMessage: any): string | null {
  if (!encodedMessage) return encodedMessage;

  // Base64 pattern check
  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

  try {
    if (base64Pattern.test(encodedMessage)) {
      // It looks like base64
      const decoded = atob(encodedMessage);
      return decoded;
    } else {
      // Try BS58 decode
      const decoded = bs58.decode(encodedMessage);
      return new TextDecoder().decode(decoded);
    }
  } catch (error) {
    // If both fail, return original
    console.warn('Failed to decode message:', error);
    return encodedMessage;
  }
}

/**
 * Get fee payer from Solana Transaction or VersionedTransaction
 * This is Solana-specific - EVM transactions have 'from' field instead
 */
export function getSolanaFeePayer(transaction: Transaction | VersionedTransaction): string {
  if (transaction instanceof VersionedTransaction) {
    return transaction.message.staticAccountKeys[0].toBase58();
  } else {
    if (!transaction.feePayer) {
      throw new Error('Transaction missing fee payer');
    }
    return transaction.feePayer.toBase58();
  }
}
