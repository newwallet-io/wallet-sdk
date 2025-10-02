// test/solana.test.js - Updated for WalletConnect namespaces format

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  LAMPORTS_PER_SOL,
  SystemProgram,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

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
  jest.advanceTimersByTime(500);
}

export const serializeBase64SolanaTransaction = (transaction) => {
  try {
    const isVersionedTransaction = typeof transaction.version !== 'undefined';
    let serializedTransaction;
    if (isVersionedTransaction) {
      serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');
    } else {
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
  const firstByte = transactionBuffer[0];
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
const { CONNECTION_METHODS, CHAIN_IDS, SOLANA_METHODS } = NewWallet;

describe('SolanaProvider', () => {
  let wallet;
  const walletUrl = 'http://localhost:3001/transaction_signing';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPopup.closed = false;

    for (const key in eventListeners) {
      eventListeners[key] = [];
    }

    wallet = new NewWallet.default({
      walletUrl,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('Solana provider should be properly initialized', () => {
      expect(wallet.solana).toBeDefined();
      expect(typeof wallet.solana.connect).toBe('function');
      expect(typeof wallet.solana.disconnect).toBe('function');
      expect(typeof wallet.solana.signMessage).toBe('function');
    });
  });

  describe('Connection', () => {
    test('should connect with WalletConnect namespaces format', async () => {
      const promise = wallet.solana.connect();

      expect(window.open).toHaveBeenCalledWith(walletUrl, expect.any(String), expect.any(String));

      simulateWalletMessage('READY');

      // ✅ WalletConnect format with namespaces
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {  // ✅ Use namespaces structure
            solana: {
              accounts: [
                'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:sol1pubkey',
                'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:sol2pubkey',
              ],
              chains: [
                'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
                'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z'
              ],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect', 'disconnect']
            }
          }
        },
      });

      const publicKey = await promise;

      expect(publicKey).toBe('sol1pubkey');
      expect(wallet.solana.isConnected()).toBe(true);
      expect(wallet.solana.getPublicKey()).toBe('sol1pubkey');
      expect(wallet.solana.getAccounts()).toEqual(['sol1pubkey', 'sol2pubkey']);
      expect(wallet.solana.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_MAINNET);
    });

    test('should use chains array from wallet response', async () => {
      const promise = wallet.solana.connect();

      simulateWalletMessage('READY');

      // ✅ Chains array includes both mainnet and testnet
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [`${CHAIN_IDS.SOLANA_MAINNET}:mainnetpubkey`],
              chains: [
                CHAIN_IDS.SOLANA_MAINNET,
                CHAIN_IDS.SOLANA_TESTNET  // ✅ Testnet supported but no account
              ],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect', 'disconnect']
            }
          }
        },
      });

      const publicKey = await promise;

      expect(publicKey).toBe('mainnetpubkey');
      
      // ✅ Should include both chains from response
      const supportedChains = wallet.solana.getSupportedChains();
      expect(supportedChains).toContain(CHAIN_IDS.SOLANA_MAINNET);
      expect(supportedChains).toContain(CHAIN_IDS.SOLANA_TESTNET);
    });

    test('should fallback to deriving chains from accounts if no chains array', async () => {
      const promise = wallet.solana.connect();

      simulateWalletMessage('READY');

      // ✅ No chains array provided
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [`${CHAIN_IDS.SOLANA_MAINNET}:pubkey1`],
              // No chains field
              methods: Object.values(SOLANA_METHODS),
              events: ['connect']
            }
          }
        },
      });

      await promise;

      // ✅ Should derive chains from accounts
      const supportedChains = wallet.solana.getSupportedChains();
      expect(supportedChains).toContain(CHAIN_IDS.SOLANA_MAINNET);
    });

    test('should handle testnet as active chain', async () => {
      const promise = wallet.solana.connect();

      simulateWalletMessage('READY');

      // ✅ Testnet first in chains array (active)
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [
                `${CHAIN_IDS.SOLANA_TESTNET}:testpubkey`,
                `${CHAIN_IDS.SOLANA_MAINNET}:mainnetpubkey`
              ],
              chains: [
                CHAIN_IDS.SOLANA_TESTNET,  // ✅ First = active
                CHAIN_IDS.SOLANA_MAINNET
              ],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect']
            }
          }
        },
      });

      const publicKey = await promise;

      expect(publicKey).toBe('testpubkey');
      expect(wallet.solana.getCurrentChain()).toBe(CHAIN_IDS.SOLANA_TESTNET);
    });

    test('should emit connect event', async () => {
      const connectListener = jest.fn();
      wallet.solana.on('connect', connectListener);

      const promise = wallet.solana.connect();

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [`${CHAIN_IDS.SOLANA_MAINNET}:sol1pubkey`],
              chains: [CHAIN_IDS.SOLANA_MAINNET],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect']
            }
          }
        },
      });

      await promise;

      expect(connectListener).toHaveBeenCalledWith('sol1pubkey');
    });

    test('should handle missing solana namespace', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {  // Only EVM, no Solana
              accounts: ['eip155:1:0x123'],
              chains: ['eip155:1'],
              methods: ['eth_sendTransaction'],
              events: []
            }
          }
        },
      });

      await expect(promise).rejects.toThrow('No Solana accounts available');
    });

    test('should handle error response', async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        error: { code: 4001, message: 'User rejected' },
      });

      await expect(promise).rejects.toThrow('User rejected');
    });
  });

  describe('Disconnect', () => {
    beforeEach(async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [`${CHAIN_IDS.SOLANA_MAINNET}:sol1pubkey`],
              chains: [CHAIN_IDS.SOLANA_MAINNET],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect', 'disconnect']
            }
          }
        },
      });
      await promise;
    });

    test('should disconnect and clear state', async () => {
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
    const mockKeypair = Keypair.generate();
    const mockPublicKey = mockKeypair.publicKey.toString();

    beforeEach(async () => {
      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [`${CHAIN_IDS.SOLANA_MAINNET}:${mockPublicKey}`],
              chains: [CHAIN_IDS.SOLANA_MAINNET],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect']
            }
          }
        },
      });
      await promise;
    });

    test('should sign message with Uint8Array', async () => {
      const message = new TextEncoder().encode('Hello Solana');
      const promise = wallet.solana.signMessage(message);

      simulateWalletMessage('READY');

      const expectedMessage = bs58.encode(message);
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
          params: {
            message: expectedMessage,
            pubkey: mockPublicKey,
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
    });

    test('should sign message with string', async () => {
      const message = 'Hello Solana';
      const promise = wallet.solana.signMessage(message);

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            message: message,
            pubkey: mockPublicKey,
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

    test('should reject if not connected', async () => {
      await wallet.solana.disconnect();

      await expect(wallet.solana.signMessage('test')).rejects.toThrow('Not connected');
    });
  });

  describe('Sign Transaction', () => {
    let transaction;
    const mockKeypair = Keypair.generate();
    const mockPublicKey = mockKeypair.publicKey.toString();

    beforeEach(async () => {
      transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: mockKeypair.publicKey,
          toPubkey: mockKeypair.publicKey,
          lamports: LAMPORTS_PER_SOL * 0.01,
        })
      );
      transaction.feePayer = mockKeypair.publicKey;
      transaction.recentBlockhash = '9XeJipgDr8nt2bMewXmATkEL5AbuUTnQBoUGmt5vpYPG';

      const promise = wallet.solana.connect();
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {
              accounts: [`${CHAIN_IDS.SOLANA_TESTNET}:${mockKeypair.publicKey}`],
              chains: [CHAIN_IDS.SOLANA_TESTNET],
              methods: Object.values(SOLANA_METHODS),
              events: ['connect']
            }
          }
        },
      });
      await promise;
    });

    test('should sign legacy transaction', async () => {
      const promise = wallet.solana.signTransaction(transaction);

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
          params: {
            transaction: expect.any(String),
          },
          chainId: CHAIN_IDS.SOLANA_TESTNET,
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
        result: {
          transaction: serializeBase64SolanaTransaction(transaction),
          signature: 'signature123',
        },
      });

      const signedTx = await promise;
      expect(signedTx).toBeDefined();
      expect(signedTx).toBeInstanceOf(Transaction);
    });

    test('should handle user rejection', async () => {
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
  });
});