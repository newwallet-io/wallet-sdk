// test/providers/solana.test.ts

import { SolanaProvider } from '../src/providers/solana';
import { CONNECTION_METHODS, SOLANA_METHODS, CHAIN_IDS, ErrorCode } from '../src/types';
import { Transaction, PublicKey, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';

// Mock popup object
const mockPopup = {
  postMessage: jest.fn(),
  closed: false,
  close: jest.fn(),
};

// Mock window
Object.defineProperty(window, 'open', {
  writable: true,
  value: jest.fn(() => mockPopup)
});

// Track event listeners
const eventListeners: { [key: string]: Function[] } = {};
window.addEventListener = jest.fn((event: string, callback: Function) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
}) as any;

window.removeEventListener = jest.fn() as any;

// Mock timers
global.setInterval = jest.fn(() => 123) as any;
global.clearInterval = jest.fn();

// Helper to simulate wallet messages
function simulateWalletMessage(type: string, data?: any) {
  const mockEvent = {
    origin: 'https://newwallet.io',
    data: type === 'READY' ? { type: 'READY' } : data,
  };
  
  if (eventListeners['message']) {
    eventListeners['message'].forEach(listener => listener(mockEvent));
  }
}

describe('SolanaProvider', () => {
  let provider: SolanaProvider;
  const walletUrl = 'https://newwallet.io/transaction_signing';
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPopup.closed = false;
    
    // Clear event listeners
    for (const key in eventListeners) {
      eventListeners[key] = [];
    }
    
    provider = new SolanaProvider(walletUrl);
  });

  describe('Connection', () => {
    it('should connect and request both mainnet and testnet', async () => {
      const promise = provider.connect();
      
      // Check popup opened
      expect(window.open).toHaveBeenCalledWith(
        walletUrl,
        expect.any(String),
        expect.any(String)
      );
      
      simulateWalletMessage('READY');
      
      // Check requested both Solana chains
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
          requiredNamespaces: {
            solana: expect.objectContaining({
              chains: [
                CHAIN_IDS.SOLANA_MAINNET,
                CHAIN_IDS.SOLANA_TESTNET
              ],
              methods: Object.values(SOLANA_METHODS)
            })
          }
        }),
        'https://newwallet.io'
      );
      
      // Simulate response with mainnet active
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['sol1pubkey', 'sol2pubkey']
          },
          chains: {
            solana: CHAIN_IDS.SOLANA_MAINNET
          }
        }
      });

      const publicKey = await promise;
      
      expect(publicKey).toBe('sol1pubkey');
      expect(provider.isConnected()).toBe(true);
      expect(provider.getPublicKey()).toBe('sol1pubkey');
      expect(provider.getAccounts()).toEqual(['sol1pubkey', 'sol2pubkey']);
      expect(provider.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_MAINNET);
    });

    it('should handle testnet as active chain', async () => {
      const promise = provider.connect();
      
      simulateWalletMessage('READY');
      
      // Simulate response with testnet active
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['testpubkey']
          },
          chains: {
            solana: CHAIN_IDS.SOLANA_TESTNET
          }
        }
      });

      const publicKey = await promise;
      
      expect(publicKey).toBe('testpubkey');
      expect(provider.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_TESTNET);
    });

    it('should emit connect event', async () => {
      const connectListener = jest.fn();
      provider.on('connect', connectListener);
      
      const promise = provider.connect();
      
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['sol1pubkey']
          }
        }
      });

      await promise;
      
      expect(connectListener).toHaveBeenCalledWith('sol1pubkey');
    });
  });

  describe('Disconnect', () => {
    beforeEach(async () => {
      // Connect first
      const promise = provider.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] }
        }
      });
      await promise;
    });

    it('should disconnect and clear state', async () => {
      const disconnectListener = jest.fn();
      provider.on('disconnect', disconnectListener);
      
      await provider.disconnect();
      
      expect(provider.isConnected()).toBe(false);
      expect(provider.getPublicKey()).toBe(null);
      expect(provider.getAccounts()).toEqual([]);
      expect(disconnectListener).toHaveBeenCalled();
    });
  });

  describe('Sign Message', () => {
    beforeEach(async () => {
      // Connect first
      const promise = provider.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] },
          chains: { solana: CHAIN_IDS.SOLANA_MAINNET }
        }
      });
      await promise;
    });

    it('should sign message with Uint8Array', async () => {
      const message = new TextEncoder().encode('Hello Solana');
      const promise = provider.signMessage(message);
      
      simulateWalletMessage('READY');
      
      // Check message is base58 encoded
      const expectedMessage = bs58.encode(message);
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
          params: [{
            message: expectedMessage,
            pubkey: 'sol1pubkey'
          }],
          chainId: CHAIN_IDS.SOLANA_MAINNET
        }),
        'https://newwallet.io'
      );
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: 'signature123'
      });
      
      const signature = await promise;
      expect(signature).toBe('signature123');
    });

    it('should sign message with string', async () => {
      const message = 'Hello Solana';
      const promise = provider.signMessage(message);
      
      simulateWalletMessage('READY');
      
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
          params: [{
            message: message, // String passed as-is
            pubkey: 'sol1pubkey'
          }]
        }),
        'https://newwallet.io'
      );
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: 'signature456'
      });
      
      const signature = await promise;
      expect(signature).toBe('signature456');
    });

    it('should reject if not connected', async () => {
      await provider.disconnect();
      
      await expect(
        provider.signMessage('test')
      ).rejects.toThrow('Not connected');
    });
  });

  describe('Sign Transaction', () => {
    let transaction: Transaction;
    
    beforeEach(async () => {
      // Create a test transaction
      transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey('sol1pubkey'),
          toPubkey: new PublicKey('recipient'),
          lamports: 1000
        })
      );
      
      // Connect
      const promise = provider.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] },
          chains: { solana: CHAIN_IDS.SOLANA_TESTNET }
        }
      });
      await promise;
    });

    it('should sign transaction', async () => {
      const promise = provider.signTransaction(transaction);
      
      simulateWalletMessage('READY');
      
      // Check transaction is serialized
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
          params: [{
            transaction: expect.any(String), // base58 encoded
            pubkey: 'sol1pubkey'
          }],
          chainId: CHAIN_IDS.SOLANA_TESTNET // Uses current chain
        }),
        'https://newwallet.io'
      );
      
      // Mock signed transaction (base58 encoded)
      const mockSignedTx = bs58.encode(Buffer.from('signed_transaction_data'));
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
        result: mockSignedTx
      });
      
      const signedTx = await promise;
      expect(signedTx).toBeDefined();
      expect(signedTx).toBeInstanceOf(Transaction);
    });
  });

  describe('Sign All Transactions', () => {
    let transactions: Transaction[];
    
    beforeEach(async () => {
      // Create test transactions
      transactions = [
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey('sol1pubkey'),
            toPubkey: new PublicKey('recipient1'),
            lamports: 1000
          })
        ),
        new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey('sol1pubkey'),
            toPubkey: new PublicKey('recipient2'),
            lamports: 2000
          })
        )
      ];
      
      // Connect
      const promise = provider.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] }
        }
      });
      await promise;
    });

    it('should sign multiple transactions', async () => {
      const promise = provider.signAllTransactions(transactions);
      
      simulateWalletMessage('READY');
      
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
          params: [{
            transactions: expect.arrayContaining([
              expect.any(String), // First tx base58
              expect.any(String)  // Second tx base58
            ]),
            pubkey: 'sol1pubkey'
          }]
        }),
        'https://newwallet.io'
      );
      
      // Mock signed transactions
      const mockSignedTxs = [
        bs58.encode(Buffer.from('signed_tx1')),
        bs58.encode(Buffer.from('signed_tx2'))
      ];
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
        result: mockSignedTxs
      });
      
      const signedTxs = await promise;
      expect(signedTxs).toHaveLength(2);
      expect(signedTxs[0]).toBeInstanceOf(Transaction);
      expect(signedTxs[1]).toBeInstanceOf(Transaction);
    });
  });

  describe('Sign and Send Transaction', () => {
    let transaction: Transaction;
    
    beforeEach(async () => {
      transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey('sol1pubkey'),
          toPubkey: new PublicKey('recipient'),
          lamports: 1000
        })
      );
      
      // Connect
      const promise = provider.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] }
        }
      });
      await promise;
    });

    it('should sign and send transaction', async () => {
      const sendOptions = { skipPreflight: true };
      const promise = provider.signAndSendTransaction(transaction, sendOptions);
      
      simulateWalletMessage('READY');
      
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
          params: [{
            transaction: expect.any(String),
            sendOptions,
            pubkey: 'sol1pubkey'
          }]
        }),
        'https://newwallet.io'
      );
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
        result: 'txSignature123'
      });
      
      const signature = await promise;
      expect(signature).toBe('txSignature123');
    });
  });
});