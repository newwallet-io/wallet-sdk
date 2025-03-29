// Updated transactionUtils.js

import { Buffer } from 'buffer';
import { Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Deserialize a Solana transaction from a base64 string
 * @param {string} serializedTransaction - Base64 encoded transaction
 * @param {boolean} isVersionedTransaction - Whether it's a versioned transaction
 * @param {string} encoding - The encoding format (should be base64)
 * @returns {Transaction|VersionedTransaction|null} The deserialized transaction or null if failed
 */
export const deserializeSolanaTransaction = (serializedTransaction, isVersionedTransaction, encoding) => {
  if (encoding !== 'base64') {
    console.error(`Unsupported encoding format: ${encoding}`);
    return null;
  }

  try {
    const buffer = Buffer.from(serializedTransaction, 'base64');

    if (isVersionedTransaction) {
      try {
        return VersionedTransaction.deserialize(buffer);
      } catch (versionedError) {
        console.error(`Failed to deserialize versioned transaction: ${versionedError.message}`);
        return createSimplifiedTransactionInfo(buffer, true);
      }
    } else {
      try {
        return Transaction.from(buffer);
      } catch (legacyError) {
        console.error(`Failed to deserialize legacy transaction: ${legacyError.message}`);
        return createSimplifiedTransactionInfo(buffer, false);
      }
    }
  } catch (err) {
    console.error(`Failed to deserialize Solana transaction: ${err.message}`);
    return null;
  }
};

// Helper function to create a simplified transaction representation
function createSimplifiedTransactionInfo(buffer, isVersioned) {
  return {
    _isSimplified: true,
    bufferLength: buffer.length,
    isVersionedTransaction: isVersioned,
    bufferPreview: buffer.slice(0, 20).toString('hex')
  };
}

/**
 * Format transaction details for readable display, without showing transaction type
 * @param {Transaction|VersionedTransaction} transaction - The deserialized transaction
 * @param {boolean} isVersionedTransaction - Whether it's a versioned transaction
 * @returns {Object} User-friendly transaction details
 */
export const formatTransactionDetails = (transaction, isVersionedTransaction) => {
    if (!transaction) return { error: "Unable to deserialize transaction" };
    
    // Check if we're working with a simplified transaction object
    if (transaction._isSimplified) {
      return {
        status: "Deserialization Note",
        note: "Limited transaction information available",
        bufferLength: transaction.bufferLength,
        bufferPreview: transaction.bufferPreview
      };
    }
    
    try {
      let fromAddress = "Unknown";
      let programIds = [];
      let instructions = [];
      let transferInfo = null;
      
      // Extract common details
      if (isVersionedTransaction) {
        // Handle versioned transaction
        if (transaction.message && transaction.message.staticAccountKeys) {
          // The fee payer is typically the first account
          fromAddress = transaction.message.staticAccountKeys[0]?.toBase58() || "Unknown";
          
          // Extract program IDs and analyze instructions
          if (transaction.message.compiledInstructions) {
            transaction.message.compiledInstructions.forEach(ix => {
              const programIdIndex = ix.programIdIndex;
              const programId = transaction.message.staticAccountKeys[programIdIndex]?.toBase58() || "Unknown";
              programIds.push(programId);
              
              // If this is a system program transfer, try to extract details
              if (programId === '11111111111111111111111111111111') {
                try {
                  // Get accounts involved
                  const accounts = ix.accountKeyIndexes.map(idx => 
                    transaction.message.staticAccountKeys[idx]?.toBase58() || "Unknown"
                  );
                  
                  // Extract instruction details
                  const instruction = {
                    programId,
                    accounts,
                    dataSize: ix.data ? ix.data.length : 0
                  };
                  
                  // Try to identify transfer instruction by analyzing data
                  if (ix.data && ix.data[0] === 2 && accounts.length >= 2) {
                    // This is likely a transfer instruction
                    // Try to extract the amount
                    let amount = "Unknown";
                    if (ix.data.length >= 12) {
                      // Construct a dataview to read the 64-bit lamport amount
                      // This is a simplified approach - in production you'd use proper decoding
                      const lamportBytes = ix.data.slice(4, 12);
                      const lamports = new DataView(lamportBytes.buffer).getBigUint64(0, true);
                      amount = `${Number(lamports) / 1e9} SOL`;
                    }
                    
                    transferInfo = {
                      type: "Transfer",
                      from: accounts[0],
                      to: accounts[1],
                      amount
                    };
                    
                    instruction.decodedData = transferInfo;
                  }
                  
                  instructions.push(instruction);
                } catch (e) {
                  console.error("Error extracting instruction details:", e);
                  instructions.push({
                    programId,
                    error: "Could not decode instruction"
                  });
                }
              }
            });
          }
        }
      } else {
        // Handle legacy transaction
        if (transaction.feePayer) {
          fromAddress = transaction.feePayer.toBase58();
        }
        
        // Extract program IDs from instructions
        if (transaction.instructions) {
          transaction.instructions.forEach(ix => {
            if (ix.programId) {
              const programId = ix.programId.toBase58();
              programIds.push(programId);
              
              // Create basic instruction info
              const instruction = {
                programId,
                accounts: ix.keys.map(key => ({
                  pubkey: key.pubkey.toBase58(),
                  isSigner: key.isSigner,
                  isWritable: key.isWritable
                })),
                dataSize: ix.data ? ix.data.length : 0
              };
              
              // If this is a system program transfer, try to extract details
              if (programId === '11111111111111111111111111111111') {
                try {
                  // Check if this is a transfer instruction (command index 2)
                  if (ix.data && ix.data[0] === 2) {
                    // Extract the lamport amount (usually at offset 4, 8 bytes)
                    let amount = "Unknown";
                    if (ix.data.length >= 12) {
                      const lamportView = new DataView(ix.data.buffer.slice(ix.data.byteOffset + 4, ix.data.byteOffset + 12));
                      const lamports = lamportView.getBigUint64(0, true);
                      amount = `${Number(lamports) / 1e9} SOL`;
                    }
                    console.log("ix.keys", ix.keys);
                    const fromPubkey = ix.keys.find(k => k.isSigner && k.isWritable)?.pubkey.toBase58() || "Unknown";
                    const toPubkey = ix.keys.find(k => !k.isSigner && k.isWritable)?.pubkey.toBase58() || "Unknown";
                    
                    transferInfo = {
                      type: "Transfer",
                      from: fromPubkey,
                      to: toPubkey,
                      amount
                    };
                    
                    instruction.decodedData = transferInfo;
                  }
                } catch (e) {
                  console.error("Error decoding transfer:", e);
                }
              }
              
              instructions.push(instruction);
            }
          });
        }
      }
      
      // Estimate fee - In a real app, you'd calculate this based on
      // recent fee rates and the number of signatures required
      const estimatedFee = isVersionedTransaction 
        ? "~0.000005 SOL" 
        : "~0.000005 SOL";
      
      // Create user-friendly display object
      const result = {
        sender: fromAddress,
        programs: [...new Set(programIds)], // Deduplicate program IDs
        instructionCount: isVersionedTransaction ? 
          (transaction.message?.compiledInstructions?.length || 0) : 
          (transaction.instructions?.length || 0),
        instructions: instructions.length > 0 ? instructions : undefined,
        recentBlockhash: transaction.recentBlockhash || "Unknown",
        estimatedFee: estimatedFee
      };
      
      // Add transfer info if this appears to be a transfer transaction
      if (transferInfo) {
        result.transferInfo = transferInfo;
      }
      
      return result;
    } catch (error) {
      console.error("Error formatting transaction:", error);
      return {
        error: "Could not parse transaction details"
      };
    }
  };

/**
 * Process multiple Solana transactions for display
 * @param {Array} serializedTransactions - Array of serialized transaction objects
 * @returns {Object} Summary of multiple transactions
 */
export const processMultipleTransactions = (serializedTransactions) => {
  if (!serializedTransactions || !Array.isArray(serializedTransactions)) {
    return {
      count: 0,
      error: "No valid transactions found"
    };
  }

  try {
    // Attempt to deserialize and get details from first few transactions
    const sampleSize = Math.min(serializedTransactions.length, 3);
    const samples = [];

    for (let i = 0; i < sampleSize; i++) {
      const txInfo = serializedTransactions[i];
      
      if (txInfo && txInfo.serializedTransaction && txInfo.encoding === 'base64') {
        const tx = deserializeSolanaTransaction(
          txInfo.serializedTransaction,
          txInfo.isVersionedTransaction,
          txInfo.encoding
        );
        
        if (tx) {
          samples.push({
            index: i,
            details: formatTransactionDetails(tx, txInfo.isVersionedTransaction)
          });
        }
      }
    }

    return {
      count: serializedTransactions.length,
      samples: samples,
      message: `${serializedTransactions.length} transactions to sign`,
      hasMore: serializedTransactions.length > sampleSize
    };
  } catch (error) {
    console.error("Error processing multiple transactions:", error);
    return {
      count: serializedTransactions.length,
      error: "Could not process transaction details",
      message: `${serializedTransactions.length} transactions to sign`
    };
  }
};

/**
 * Properly decode a message for display
 * @param {string} message - The message to decode
 * @param {string} encoding - The message encoding
 * @returns {string} Decoded message ready for display
 */
export const decodeMessage = (message, encoding) => {
  if (!message) return "No message data";
  
  try {
    if (encoding === 'base64') {
      // Use Buffer for proper base64 decoding
      const decoded = Buffer.from(message, 'base64').toString('utf8');
      return decoded;
    } else if (encoding === 'hex') {
      // Decode hex message
      const decoded = Buffer.from(message, 'hex').toString('utf8');
      return decoded;
    } else {
      // Default to returning as-is
      return message;
    }
  } catch (error) {
    console.error(`Error decoding message: ${error.message}`);
    return `Error decoding message: ${message.substring(0, 50)}...`;
  }
};

/**
 * Deserializes an Ethereum transaction
 * @param {string} serializedTransaction - The serialized transaction
 * @param {string} encoding - The encoding format (should be 'json')
 * @returns {Object|null} The deserialized transaction or null if failed
 */
export const deserializeEthereumTransaction = (serializedTransaction, encoding) => {
  if (encoding !== 'json') {
    console.error(`Unsupported encoding format: ${encoding}`);
    return null;
  }

  try {
    return JSON.parse(serializedTransaction, (key, value) => {
      // Convert bigint markers back to BigInt
      if (value && typeof value === 'object' && value.type === 'bigint') {
        // eslint-disable-next-line no-undef
        return BigInt(value.value);
      }
      return value;
    });
  } catch (err) {
    console.error(`Failed to deserialize Ethereum transaction: ${err.message}`);
    return null;
  }
};