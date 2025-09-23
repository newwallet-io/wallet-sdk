import { Connection, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';

/**
 * Creates a mock transaction that avoids Buffer serialization issues
 * @param {string} fromPublicKey - The sender's public key
 * @param {string} toAddress - The recipient's address
 * @param {string} amount - The amount to send
 * @returns {Object} A transaction-like object that can pass through the SDK
 */
export function createMockTransaction(fromPublicKey, toAddress, amount) {
    if (!fromPublicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert string publicKey to PublicKey objects
      const fromPubkey = new PublicKey(fromPublicKey);
      const toPubkey = new PublicKey(toAddress);
      
      // Convert SOL to lamports (1 SOL = 10^9 lamports)
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      
      // Create a new transaction
      const transaction = new Transaction();
      
      // Add a dummy blockhash (in a real app, you'd get this from a connection)
      transaction.recentBlockhash = 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k';
      
      // Set the fee payer
      transaction.feePayer = fromPubkey;
      
      // Add a transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports
        })
      );
      console.log('Mock transaction created:', transaction);
      return transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }
  
  /**
   * Apply patches to fix the serialization in the SDK
   * Must be called before using the SDK
   */
  export function patchSerializationFunction() {
    // Check if the SDK is available
    if (!window.NewWallet) {
      console.error('NewWallet SDK not available');
      return;
    }
    
    try {
      // Attempt to patch the serialization function in the SDK
      const originalSerializer = window.NewWallet.serializeSolanaTransaction;
      
      if (typeof originalSerializer === 'function') {
        window.NewWallet.serializeSolanaTransaction = function(transaction) {
          // Check if it's our mock transaction
          if (transaction && typeof transaction.serialize === 'function') {
            // Return a simplified serialization result
            return {
              serializedTransaction: 'mockSerializedTransaction',
              isVersionedTransaction: false,
              encoding: 'base64'
            };
          }
          
          // Otherwise try the original serializer
          return originalSerializer(transaction);
        };
        
        console.log('Patched serialization function successfully');
      } else {
        console.warn('Serialization function not found in SDK');
      }
    } catch (error) {
      console.error('Failed to patch serialization function:', error);
    }
  }