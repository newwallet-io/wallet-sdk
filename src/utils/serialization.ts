// src/utils/serialization.ts

import { Transaction, VersionedTransaction } from '@solana/web3.js';
import { ethers } from 'ethers';
import { ProviderError, ErrorCode } from '../types';
import { Buffer } from 'buffer';

/**
 * Serialize an Ethereum transaction request for transfer via postMessage
 * @param transactionRequest The Ethereum transaction request to serialize
 * @returns The serialized transaction data with encoding information
 */
export function serializeEthereumTransaction(transactionRequest: ethers.TransactionRequest): {
  serializedTransaction: string;
  encoding: string;
} {
  try {
    const serializedTransaction = JSON.stringify(transactionRequest, (key, value) => {
      // Handle BigInt values by converting them to strings with a marker
      if (typeof value === 'bigint') {
        return { type: 'bigint', value: value.toString() };
      }
      // Handle ethers.js Address objects
      if (
        value &&
        typeof value === 'object' &&
        value.constructor &&
        value.constructor.name === 'Address'
      ) {
        return value.toString();
      }
      return value;
    });
    return { serializedTransaction, encoding: 'json' };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new ProviderError(
      ErrorCode.INTERNAL_ERROR,
      `Failed to serialize Ethereum transaction: ${errorMessage}`
    );
  }
}

/**
 * Deserialize an Ethereum transaction from a serialized string
 * @param serializedTransaction The serialized transaction string
 * @param encoding The encoding format (e.g., 'json')
 * @returns The deserialized transaction request
 */
export function deserializeEthereumTransaction(
  serializedTransaction: string,
  encoding: string
): ethers.TransactionRequest {
  if (encoding !== 'json') {
    throw new ProviderError(ErrorCode.INTERNAL_ERROR, `Unsupported encoding format: ${encoding}`);
  }

  try {
    return JSON.parse(serializedTransaction, (key, value) => {
      // Convert bigint markers back to BigInt
      if (value && typeof value === 'object' && value.type === 'bigint') {
        return BigInt(value.value);
      }
      return value;
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new ProviderError(
      ErrorCode.INTERNAL_ERROR,
      `Failed to deserialize Ethereum transaction: ${errorMessage}`
    );
  }
}

/**
 * Serialize a Solana transaction for transfer via postMessage
 * @param transaction The Solana transaction to serialize (Transaction or VersionedTransaction)
 * @returns The serialized transaction data with metadata
 */
export function serializeSolanaTransaction(transaction: Transaction | VersionedTransaction): {
  serializedTransaction: string;
  isVersionedTransaction: boolean;
  encoding: string;
} {
  try {
    const isVersionedTransaction = transaction instanceof VersionedTransaction;

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
    return {
      serializedTransaction,
      isVersionedTransaction,
      encoding: 'base64',
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new ProviderError(
      ErrorCode.INTERNAL_ERROR,
      `Failed to serialize transaction: ${errorMessage}`
    );
  }
}

/**
 * Deserialize a Solana transaction from a serialized string
 * @param serializedTransaction The serialized transaction string
 * @param isVersionedTransaction Whether it's a versioned transaction
 * @param encoding The encoding format (should be 'base64')
 * @returns The deserialized Transaction or VersionedTransaction
 */
export function deserializeSolanaTransaction(
  serializedTransaction: string,
  isVersionedTransaction: boolean,
  encoding: string
): Transaction | VersionedTransaction {
  if (encoding !== 'base64') {
    throw new ProviderError(ErrorCode.INTERNAL_ERROR, `Unsupported encoding format: ${encoding}`);
  }

  try {
    const buffer = Buffer.from(serializedTransaction, 'base64');

    if (isVersionedTransaction) {
      return VersionedTransaction.deserialize(buffer);
    } else {
      return Transaction.from(buffer);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new ProviderError(
      ErrorCode.INTERNAL_ERROR,
      `Failed to deserialize Solana transaction: ${errorMessage}`
    );
  }
}

/**
 * Serialize a message to base64 for transfer via postMessage
 * @param message The message to serialize (string or Uint8Array)
 * @returns The serialized message with encoding information
 */
export function serializeMessage(message: string | Uint8Array): {
  serializedMessage: string;
  encoding: string;
} {
  try {
    if (typeof message === 'string') {
      // For Ethereum: Keep strings as-is or use UTF-8 encoding
      return {
        serializedMessage: message,
        encoding: 'utf8',
      };
    } else {
      // For Solana or binary data: Convert to base64
      const base64Message = btoa(String.fromCharCode.apply(null, [...message]));
      return {
        serializedMessage: base64Message,
        encoding: 'base64',
      };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new ProviderError(
      ErrorCode.INTERNAL_ERROR,
      `Failed to serialize message: ${errorMessage}`
    );
  }
}

/**
 * Deserialize a message from its serialized form
 * @param serializedMessage The serialized message
 * @param encoding The encoding format ('utf8' or 'base64')
 * @returns The deserialized message (string or Uint8Array)
 */
export function deserializeMessage(
  serializedMessage: string,
  encoding: string
): string | Uint8Array {
  try {
    if (encoding === 'utf8') {
      // String message
      return serializedMessage;
    } else if (encoding === 'base64') {
      // Binary message in base64
      const binaryString = atob(serializedMessage);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      throw new ProviderError(ErrorCode.INTERNAL_ERROR, `Unsupported encoding format: ${encoding}`);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new ProviderError(
      ErrorCode.INTERNAL_ERROR,
      `Failed to deserialize message: ${errorMessage}`
    );
  }
}
