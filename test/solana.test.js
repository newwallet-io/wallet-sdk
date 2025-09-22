import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  LAMPORTS_PER_SOL,
  SystemProgram,
  VersionedTransaction,
  sendAndConfirmTransaction,
  SendOptions,
} from '@solana/web3.js';
import bs58 from 'bs58';
// test/solana.test.js
const mockPopup = {
  postMessage: jest.fn(),
  closed: false,
  close: jest.fn(),
};
global.window = {
  location: {
    origin: 'http://localhost:3000',
    hostname: 'localhost',
  },
  open: jest.fn().mockImplementation(() => mockPopup),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
global.TextEncoder = class {
  encode(text) {
    return Buffer.from(text);
  }
};
global.URL = class {
  constructor(url) {
    this.url = url;
    this.origin = 'http://localhost:3001';
  }
};
global.setInterval = jest.fn(() => 123);
global.clearInterval = jest.fn();

// Event listeners handling
const eventListeners = {};
global.window.addEventListener = (event, callback) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
};

global.window.removeEventListener = (event, callback) => {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter((cb) => cb !== callback);
  }
};

function simulateWalletMessage(type, data = {}) {
  const mockEvent = {
    origin: 'http://localhost:3001',
    data: type === 'READY' ? { type: 'READY' } : data,
  };

  if (eventListeners['message']) {
    eventListeners['message'].forEach((listener) => listener(mockEvent));
  }
}

function simulatePopupClosed() {
  mockPopup.closed = true;
  // Trigger the interval check manually since we're mocking setInterval
  jest.advanceTimersByTime(500);
}

export const serializeBase64SolanaTransaction = (transaction) => {
  try {
    const isVersionedTransaction = typeof transaction.version !== 'undefined';
    let serializedTransaction;
    if (isVersionedTransaction) {
      // Versioned transaction
      serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');
    } else {
      // Legacy transaction
      serializedTransaction = Buffer.from(
        transaction.serialize({ verifySignatures: false })
      ).toString('base64');
    }
    return serializedTransaction;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to serialize transaction: ${errorMessage}`);
  }
};

export const deserializeBase64SolanaTransaction = (serializedTransaction) => {
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

const NewWallet = require('../dist/index.js');
const { CONNECTION_METHODS, EIP155_METHODS, CHAIN_IDS, ErrorCode, SOLANA_METHODS } = NewWallet;

describe('SolanaProvider', () => {
  let wallet;
  const walletUrl = 'http://localhost:3001/transaction_signing';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPopup.closed = false;

    // Clear event listeners
    for (const key in eventListeners) {
      eventListeners[key] = [];
    }

    wallet = new NewWallet.default({
      walletUrl,
    });
  });

  afterEach(() => {
    jest.clearAllTimers(); // Add this
    jest.useRealTimers(); // Add this
  });

  describe('Initialization', () => {
    test('Solana provider should be properly initialized', () => {
      expect(wallet.solana).toBeDefined();
      expect(typeof wallet.solana.connect).toBe('function');
      expect(typeof wallet.solana.disconnect).toBe('function');
      expect(typeof wallet.solana.signMessage).toBe('function');
      expect(typeof wallet.solana.signTransaction).toBe('function');
      expect(typeof wallet.solana.signAllTransactions).toBe('function');
      expect(typeof wallet.solana.signAndSendTransaction).toBe('function');
    });
  });

  describe('Connection', () => {
    it.only('should connect and request both mainnet and testnet', async () => {
      const promise = wallet.solana.connect();

      // Check popup opened
      expect(window.open).toHaveBeenCalledWith(walletUrl, expect.any(String), expect.any(String));

      simulateWalletMessage('READY');

      // Check requested both Solana chains
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
          requiredNamespaces: {
            solana: expect.objectContaining({
              chains: [CHAIN_IDS.SOLANA_MAINNET, CHAIN_IDS.SOLANA_TESTNET],
              methods: Object.values(SOLANA_METHODS),
            }),
          },
        }),
        'http://localhost:3001'
      );

      // Simulate response with mainnet active
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['sol1pubkey', 'sol2pubkey'],
          },
          chains: {
            solana: CHAIN_IDS.SOLANA_MAINNET,
          },
        },
      });

      const publicKey = await promise;

      expect(publicKey).toBe('sol1pubkey');
      expect(wallet.solana.isConnected()).toBe(true);
      expect(wallet.solana.getPublicKey()).toBe('sol1pubkey');
      expect(wallet.solana.getAccounts()).toEqual(['sol1pubkey', 'sol2pubkey']);
      expect(wallet.solana.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_MAINNET);
    });

    it('should handle testnet as active chain', async () => {
      const promise = wallet.solana.connect();

      simulateWalletMessage('READY');

      // Simulate response with testnet active
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['testpubkey'],
          },
          chains: {
            solana: CHAIN_IDS.SOLANA_TESTNET,
          },
        },
      });

      const publicKey = await promise;

      expect(publicKey).toBe('testpubkey');
      expect(wallet.solana.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_TESTNET);
    });

    it('should emit connect event', async () => {
      const connectListener = jest.fn();
      wallet.solana.on('connect', connectListener);

      const promise = wallet.solana.connect();

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['sol1pubkey'],
          },
        },
      });

      await promise;

      expect(connectListener).toHaveBeenCalledWith('sol1pubkey');
    });

    it('should handle malformed response', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      // Send malformed response
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: 'not-an-object', // Should be object
      });

      await expect(promise).rejects.toThrow();
    });

    it('should handle missing accounts field', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          // Missing accounts field
          chains: { solana: CHAIN_IDS.SOLANA_MAINNET },
        },
      });

      await expect(promise).rejects.toThrow('No Solana accounts available');
    });

    it('should handle accounts not being array', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: 'not-an-array' },
        },
      });

      await expect(promise).rejects.toThrow();
    });

    it('should ignore messages from wrong origin', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      // Send from wrong origin
      const wrongOriginEvent = {
        origin: 'http://evil.com',
        data: {
          jsonrpc: '2.0',
          method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
          result: { accounts: { solana: ['hacker'] } },
        },
      };

      if (eventListeners['message']) {
        eventListeners['message'].forEach((listener) => listener(wrongOriginEvent));
      }

      // Should still be waiting
      expect(wallet.solana.isConnected()).toBe(false);

      // Send correct response
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: { accounts: { solana: ['legitpubkey'] } },
      });

      const pubkey = await promise;
      expect(pubkey).toBe('legitpubkey');
    });

    it('should handle double connection attempts', async () => {
      const promise1 = wallet.solana.connect();
      const promise2 = wallet.solana.connect();

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: { accounts: { solana: ['pubkey1'] } },
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('pubkey1');
      expect(result2).toBe('pubkey1');
    });

    it('should reset state on connection failure', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        error: { code: 4001, message: 'User rejected' },
      });

      await expect(promise).rejects.toThrow('User rejected');

      // State should be reset
      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBe(null);
      expect(wallet.solana.getAccounts()).toEqual([]);
    });

    it('should handle reconnection after disconnect', async () => {
      // First connection
      let promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: { accounts: { solana: ['pubkey1'] } },
      });
      await promise;

      // Disconnect
      await wallet.solana.disconnect();
      expect(wallet.solana.isConnected()).toBe(false);

      // Reconnect with different account
      promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: { accounts: { solana: ['pubkey2'] } },
      });

      const pubkey = await promise;
      expect(pubkey).toBe('pubkey2');
      expect(wallet.solana.isConnected()).toBe(true);
    });

    it('should handle chain not in supported list', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['pubkey1'] },
          chains: { solana: 'solana:unsupported_chain_id' },
        },
      });

      await promise;

      // Should use default chain
      expect(wallet.solana.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_MAINNET);
    });

    it('should not emit connect event on failure', async () => {
      const connectListener = jest.fn();
      wallet.solana.on('connect', connectListener);

      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        error: { code: 4001, message: 'Rejected' },
      });

      await expect(promise).rejects.toThrow();
      expect(connectListener).not.toHaveBeenCalled();
    });
  });

  describe('Disconnect', () => {
    beforeEach(async () => {
      // Connect first
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] },
        },
      });
      await promise;
    });

    it('should disconnect and clear state', async () => {
      const disconnectListener = jest.fn();
      wallet.solana.on('disconnect', disconnectListener);

      await wallet.solana.disconnect();

      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBe(null);
      expect(wallet.solana.getAccounts()).toEqual([]);
      expect(disconnectListener).toHaveBeenCalled();
    });
  });

  describe('Sign Message', () => {
    beforeEach(async () => {
      // Connect first
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: ['sol1pubkey'] },
          chains: { solana: CHAIN_IDS.SOLANA_MAINNET },
        },
      });
      await promise;
    });

    it('should sign message with Uint8Array', async () => {
      const message = new TextEncoder().encode('Hello Solana');
      const promise = wallet.solana.signMessage(message);

      simulateWalletMessage('READY');

      // Check message is base58 encoded
      const expectedMessage = bs58.encode(message);
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
          params: {
            message: expectedMessage,
            pubkey: 'sol1pubkey',
          },
          chainId: CHAIN_IDS.SOLANA_MAINNET,
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: 'signature123' },
      });

      const signature = await promise;
      expect(signature).toBe('signature123');
    }, 10000);

    it('should sign message with string', async () => {
      const message = 'Hello Solana';
      const promise = wallet.solana.signMessage(message);

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
          params: {
            message: message, // String passed as-is
            pubkey: 'sol1pubkey',
          },
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: 'signature456' },
      });

      const signature = await promise;
      expect(signature).toBe('signature456');
    });

    it('should reject if not connected', async () => {
      await wallet.solana.disconnect();

      await expect(wallet.solana.signMessage('test')).rejects.toThrow('Not connected');
    });
    it('should handle very long message', async () => {
      const longMessage = 'x'.repeat(10000);
      const promise = wallet.solana.signMessage(longMessage);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: 'longSig' },
      });

      const signature = await promise;
      expect(signature).toBe('longSig');
    });

    it('should handle special characters in message', async () => {
      const specialMessage = '🚀 Unicode & special <chars> "quotes" \'apostrophe\'';
      const promise = wallet.solana.signMessage(specialMessage);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: 'specialSig' },
      });

      const signature = await promise;
      expect(signature).toBe('specialSig');
    });

    it('should handle Buffer as Uint8Array', async () => {
      const buffer = Buffer.from('Hello Buffer', 'utf-8');
      const promise = wallet.solana.signMessage(buffer);
      simulateWalletMessage('READY');

      const expectedMessage = bs58.encode(buffer);
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            message: expectedMessage,
            pubkey: 'sol1pubkey', // Should match the connected pubkey
          },
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: 'bufferSig' },
      });

      const signature = await promise;
      expect(signature).toBe('bufferSig');
    });

    it('should throw on null signature in response', async () => {
      const promise = wallet.solana.signMessage('test');
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: null },
      });

      await expect(promise).rejects.toThrow('Invalid response: missing signature');
    });

    it('should throw on undefined signature in response', async () => {
      const promise = wallet.solana.signMessage('test');
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: {}, // signature field missing
      });

      await expect(promise).rejects.toThrow('Invalid response: missing signature');
    });

    it('should handle user closing popup during signing', async () => {
      const promise = wallet.solana.signMessage('test');
      simulateWalletMessage('READY');
      simulatePopupClosed();

      await expect(promise).rejects.toThrow('User closed popup');
    });

    it('should handle error response from wallet', async () => {
      const promise = wallet.solana.signMessage('test');
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        error: {
          code: 4100,
          message: 'User denied message signature',
        },
      });

      await expect(promise).rejects.toThrow('User denied message signature');
    });

    it('should include correct chain ID in request', async () => {
      const promise = wallet.solana.signMessage('test');
      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: CHAIN_IDS.SOLANA_MAINNET,
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
        result: { signature: 'sig' },
      });

      await promise;
    });
  });

  describe('Sign Transaction', () => {
    let transaction;
    const mockKeypair = Keypair.generate();
    const mockPublicKey = mockKeypair.publicKey.toString();
    beforeEach(async () => {
      // Create a test transaction

      transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: LAMPORTS_PER_SOL * 0.01,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';
      // Connect
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: [mockKeypair.publicKey] },
          chains: { solana: CHAIN_IDS.SOLANA_TESTNET },
        },
      });
      await promise;
    });

    it('should sign legacy transaction', async () => {
      const promise = wallet.solana.signTransaction(transaction);

      simulateWalletMessage('READY');

      //   Check transaction is serialized
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
          params: {
            transaction: expect.any(String), // base58 encoded
            pubkey: mockKeypair.publicKey,
          },
          chainId: CHAIN_IDS.SOLANA_TESTNET, // Uses current chain
        }),
        'http://localhost:3001'
      );

      // Mock signed transaction (base58 encoded)
      const mockSignedTx = bs58.encode(Buffer.from('signed_transaction_data'));

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
        result: {
          transaction: serializeBase64SolanaTransaction(transaction),
          signature: 'singature123',
        },
      });

      const signedTx = await promise;
      expect(signedTx).toBeDefined();
      expect(signedTx).toBeInstanceOf(Transaction);
    });

    it('should handle versioned transaction', async () => {
      const mockKeypair = Keypair.generate();
      const mockPublicKey = mockKeypair.publicKey.toString();
      const instructions = [
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: LAMPORTS_PER_SOL * 0.1,
        }),
      ];
      const messageV0 = new TransactionMessage({
        payerKey: mockKeypair.publicKey,
        recentBlockhash: '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG',
        instructions,
      }).compileToV0Message();
      const versionedTx = new VersionedTransaction(messageV0);

      const promise = wallet.solana.signTransaction(versionedTx);
      simulateWalletMessage('READY');

      const serialized = serializeBase64SolanaTransaction(versionedTx);
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
        result: { transaction: serialized, signature: 'signature123' },
      });

      const result = await promise;
      expect(result).toBeInstanceOf(VersionedTransaction);
    });

    it('should handle popup closed during signing', async () => {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signTransaction(transaction);
      simulateWalletMessage('READY');

      mockPopup.closed = true;
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow('User closed popup');
    });

    it('should handle user rejection', async () => {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signTransaction(transaction);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
        error: {
          code: 4001,
          message: 'User rejected transaction',
        },
      });

      await expect(promise).rejects.toThrow('User rejected transaction');
    });

    it('should throw on invalid base64 transaction in response', async () => {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signTransaction(transaction);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
        result: { transaction: 'invalid-base64!' },
      });

      await expect(promise).rejects.toThrow();
    });
  });

  describe('Sign All Transactions', () => {
    let transactions = [];
    const mockKeypair = Keypair.generate();
    const mockPublicKey = mockKeypair.publicKey.toString();
    beforeEach(async () => {
      // Create test transactions
      const legacyTx1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: LAMPORTS_PER_SOL * 0.1,
        })
      );
      legacyTx1.feePayer = mockKeypair.publicKey;
      legacyTx1.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      // Create second transaction
      const legacyTx2 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: LAMPORTS_PER_SOL * 0.2,
        })
      );
      legacyTx2.feePayer = mockKeypair.publicKey;
      legacyTx2.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      // Prepare transactions array
      transactions = [legacyTx1, legacyTx2];
      // Connect
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: [mockPublicKey] },
        },
      });
      await promise;
    });

    it('should sign multiple transactions', async () => {
      const promise = wallet.solana.signAllTransactions(transactions);

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
          params: {
            transactions: expect.arrayContaining([
              expect.any(String), // First tx base58
              expect.any(String), // Second tx base58
            ]),
          },
        }),
        'http://localhost:3001'
      );
      const serializedTransactions = transactions.map((tx) => {
        return serializeBase64SolanaTransaction(tx);
      });

      const transaction1 = serializedTransactions.map((tx) => {
        return deserializeBase64SolanaTransaction(tx);
      });

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
        result: {
          transactions: serializedTransactions,
        },
      });

      const signedTxs = await promise;
      expect(signedTxs).toHaveLength(2);
      expect(signedTxs[0]).toBeInstanceOf(Transaction);
      expect(signedTxs[1]).toBeInstanceOf(Transaction);
    });

    it('should handle versioned transactions', async () => {
      // Create versioned transactions
      const messageV0 = new TransactionMessage({
        payerKey: mockKeypair.publicKey,
        recentBlockhash: '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG',
        instructions: [
          SystemProgram.transfer({
            fromPubkey: mockKeypair.publicKey,
            toPubkey: mockKeypair.publicKey,
            lamports: 1000,
          }),
        ],
      }).compileToV0Message();

      const versionedTx1 = new VersionedTransaction(messageV0);
      const versionedTx2 = new VersionedTransaction(messageV0);

      const promise = wallet.solana.signAllTransactions([versionedTx1, versionedTx2]);
      simulateWalletMessage('READY');

      const serializedTxs = [versionedTx1, versionedTx2].map((tx) =>
        serializeBase64SolanaTransaction(tx)
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
        result: { transactions: serializedTxs },
      });

      const results = await promise;
      expect(results).toHaveLength(2);
      expect(results[0]).toBeInstanceOf(VersionedTransaction);
      expect(results[1]).toBeInstanceOf(VersionedTransaction);
    });

    it('should throw on invalid response', async () => {
      const tx1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      tx1.feePayer = mockKeypair.publicKey;
      tx1.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signAllTransactions([tx1]);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
        result: { transactions: 'not-an-array' }, // Invalid format
      });

      await expect(promise).rejects.toThrow('Invalid response: missing transactions array');
    });

    it('should handle user rejection', async () => {
      const tx1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      tx1.feePayer = mockKeypair.publicKey;
      tx1.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signAllTransactions([tx1]);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
        error: {
          code: 4001,
          message: 'User rejected signing',
        },
      });

      await expect(promise).rejects.toThrow('User rejected signing');
    });

    it('should handle popup closed during signing', async () => {
      const tx1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      tx1.feePayer = mockKeypair.publicKey;
      tx1.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signAllTransactions([tx1]);
      simulateWalletMessage('READY');

      mockPopup.closed = true;
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow('User closed popup');
    });
  });

  describe('Sign and Send Transaction', () => {
    let transaction;
    const mockKeypair = Keypair.generate();
    const mockPublicKey = mockKeypair.publicKey.toString();
    beforeEach(async () => {
      transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';
      // Connect
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { solana: [mockKeypair.publicKey] },
        },
      });
      await promise;
    });

    it('should sign and send transaction', async () => {
      const sendOptions = { skipPreflight: true };
      const promise = wallet.solana.signAndSendTransaction(transaction, sendOptions);

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
          params: {
            transaction: expect.any(String),
            sendOptions,
          },
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
        result: { signature: 'txSignature123' },
      });

      const signature = await promise;
      expect(signature).toBe('txSignature123');
    });

    it('should handle versioned transaction', async () => {
      const messageV0 = new TransactionMessage({
        payerKey: mockKeypair.publicKey,
        recentBlockhash: '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG',
        instructions: [
          SystemProgram.transfer({
            fromPubkey: mockKeypair.publicKey,
            toPubkey: mockKeypair.publicKey,
            lamports: 1000,
          }),
        ],
      }).compileToV0Message();

      const versionedTx = new VersionedTransaction(messageV0);
      const promise = wallet.solana.signAndSendTransaction(versionedTx);

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
        result: { signature: 'versionedTxSignature' },
      });

      const signature = await promise;
      expect(signature).toBe('versionedTxSignature');
    });

    it('should throw on invalid response', async () => {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signAndSendTransaction(transaction);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
        result: {}, // Missing signature field
      });

      await expect(promise).rejects.toThrow('Invalid response: missing signature');
    });

    it('should handle user rejection', async () => {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signAndSendTransaction(transaction);
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
        error: {
          code: 4001,
          message: 'User rejected transaction',
        },
      });

      await expect(promise).rejects.toThrow('User rejected transaction');
    });

    it('should handle popup closed during signing', async () => {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: 1000,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.signAndSendTransaction(transaction);
      simulateWalletMessage('READY');

      mockPopup.closed = true;
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow('User closed popup');
    });
  });
});
