// src/index.ts
import { EthereumProvider } from './providers/ethereum';
import { SolanaProvider } from './providers/solana';
import {
  MessageType,
  EthereumMessageType,
  SolanaMessageType,
  ErrorCode,
  ProviderError,
  getErrorMessage,
  createErrorResponse,
  createSuccessResponse,
} from './types';

class NewWallet {
  readonly ethereum: EthereumProvider;
  readonly solana: SolanaProvider;

  constructor(options: { walletUrl?: string } = {}) {
    // Set up wallet URL
    const walletUrl = options.walletUrl || 'https://newwallet.io/transaction_signing';

    // Initialize providers
    this.ethereum = new EthereumProvider(walletUrl);
    this.solana = new SolanaProvider(walletUrl);
  }

  isInstalled(): boolean {
    // For web-based wallet, always return true
    return true;
  }
}

export default NewWallet;

// Export types and utilities
export {
  MessageType,
  EthereumMessageType,
  SolanaMessageType,
  ErrorCode,
  ProviderError,
  getErrorMessage,
  createErrorResponse,
  createSuccessResponse,
};
