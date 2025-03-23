// test/solana.test.js

// Mock document and window objects for testing
global.document = {
  querySelectorAll: () => [],
  title: 'Test DApp',
};

// Create a more complete mock window
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

// Mock TextEncoder for message signing
global.TextEncoder = class {
  encode(text) {
    return Buffer.from(text);
  }
};

// Mock btoa and atob for base64 encoding/decoding
global.btoa = jest.fn((str) => Buffer.from(str).toString('base64'));
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString());

// Mock URL class
global.URL = class {
  constructor(url) {
    this.url = url;
    this.origin = 'http://localhost:3001';
  }
};

// Mock setInterval and clearInterval
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

// Helper to simulate wallet messages
function simulateWalletMessage(type, payload = {}) {
  // Create wallet response with new message format
  const mockEvent = {
    data: {
      type,
      network: 'solana',
      payload: {
        success: !payload.errorCode, // If errorCode exists, it's not a success
        message: payload.message || (payload.errorCode ? 'Error' : 'Success'),
        result: payload.result || undefined,
        errorCode: payload.errorCode,
      },
    },
    origin: 'http://localhost:3001',
  };

  if (eventListeners['message']) {
    eventListeners['message'].forEach((listener) => listener(mockEvent));
  }
}

// Helper to simulate popup closed by user
function simulatePopupClosed() {
  mockPopup.closed = true;
  // Trigger the interval check manually since we're mocking setInterval
  if (eventListeners['message'] && eventListeners['message'].length > 0) {
    // Force the interval callback to run
    if (typeof global.setInterval.mock.calls[0][0] === 'function') {
      global.setInterval.mock.calls[0][0]();
    }
  }
}

// Load the SDK
const NewWallet = require('../dist/index.js');
const { ErrorCode, SolanaMessageType } = NewWallet;

describe('Solana Provider', () => {
  let wallet;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset popup state
    mockPopup.closed = false;

    // Reset event listeners
    for (const key in eventListeners) {
      eventListeners[key] = [];
    }

    // Initialize the SDK
    wallet = new NewWallet.default({
      walletUrl: 'http://localhost:3001',
    });
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

  describe('connect()', () => {
    test('should open popup and connect successfully', async () => {
      // Start connection process
      const connectPromise = wallet.solana.connect();

      // The wallet should have opened a popup
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Now simulate the wallet sending a successful connection response
      simulateWalletMessage(SolanaMessageType.CONNECT_WALLET, {
        message: 'Connected successfully',
        result: {
          publicKey: 'solana-public-key-123',
        },
      });

      // Wait for the connection promise to resolve
      const publicKey = await connectPromise;

      // Check the public key returned
      expect(publicKey).toEqual('solana-public-key-123');
      expect(mockPopup.close).toHaveBeenCalled();

      // Check internal state
      expect(wallet.solana.isConnected()).toBe(true);
      expect(wallet.solana.getPublicKey()).toEqual('solana-public-key-123');
    });

    test('should handle user rejection', async () => {
      // Start connection process
      const connectPromise = wallet.solana.connect();

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Simulate user rejecting the connection
      simulateWalletMessage(SolanaMessageType.CONNECT_WALLET, {
        message: 'User rejected the connection request',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(connectPromise).rejects.toThrow('User rejected the connection request');
      expect(mockPopup.close).toHaveBeenCalled();

      // Check internal state remains unchanged
      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBeNull();
    });

    test('should handle popup being closed', async () => {
      // Start connection process
      const connectPromise = wallet.solana.connect();

      // Simulate popup being closed by user
      simulatePopupClosed();

      // Wait for the promise to be rejected
      await expect(connectPromise).rejects.toThrow('User closed the wallet window');

      // Check internal state remains unchanged
      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBeNull();
    });

    test('should handle popup creation failure', async () => {
      // Mock window.open to return null (simulating popup blocked)
      window.open.mockReturnValueOnce(null);

      // Start connection process
      const connectPromise = wallet.solana.connect();

      // Wait for the promise to be rejected
      await expect(connectPromise).rejects.toThrow('Failed to open wallet popup');

      // Check internal state remains unchanged
      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBeNull();
    });
  });

  describe('disconnect()', () => {
    test('should disconnect successfully from connected state', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a spy for the disconnect event
      const disconnectSpy = jest.fn();
      wallet.solana.on('disconnect', disconnectSpy);

      // Disconnect
      await wallet.solana.disconnect();

      // Check state was updated
      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBeNull();

      // Check disconnect event was emitted
      expect(disconnectSpy).toHaveBeenCalled();
    });

    test('should do nothing when already disconnected', async () => {
      // Ensure disconnected state
      wallet.solana._connected = false;
      wallet.solana._publicKey = null;

      // Create a spy for the disconnect event
      const disconnectSpy = jest.fn();
      wallet.solana.on('disconnect', disconnectSpy);

      // Disconnect
      await wallet.solana.disconnect();

      // Check state remains unchanged
      expect(wallet.solana.isConnected()).toBe(false);
      expect(wallet.solana.getPublicKey()).toBeNull();

      // Check disconnect event was not emitted
      expect(disconnectSpy).not.toHaveBeenCalled();
    });
  });

  describe('signMessage()', () => {
    test('should sign a message successfully', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a message to sign
      const message = new TextEncoder().encode('Hello, Solana!');

      // Start signing process
      const signPromise = wallet.solana.signMessage(message);

      // Verify popup was opened
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Verify the postMessage was called with the correct message
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SolanaMessageType.SIGN_MESSAGE,
          network: 'solana',
          payload: expect.objectContaining({
            message: expect.any(String), // Base64 encoded message
            encoding: 'base64',
          }),
        }),
        'http://localhost:3001'
      );

      // Simulate successful signing
      simulateWalletMessage(SolanaMessageType.SIGN_MESSAGE, {
        message: 'Message signed successfully',
        result: {
          signature: 'solana-signature-123',
        },
      });

      // Wait for the signing promise to resolve
      const signature = await signPromise;

      // Check signature returned
      expect(signature).toEqual('solana-signature-123');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected', async () => {
      // Ensure not connected
      wallet.solana._connected = false;
      wallet.solana._publicKey = null;

      // Create a message to sign
      const message = new TextEncoder().encode('Hello, Solana!');

      // Attempt to sign message when not connected
      const signPromise = wallet.solana.signMessage(message);

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Not connected');
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should reject if no public key available', async () => {
      // Connected but no public key
      wallet.solana._connected = true;
      wallet.solana._publicKey = null;

      // Create a message to sign
      const message = new TextEncoder().encode('Hello, Solana!');

      // Attempt to sign message with no public key
      const signPromise = wallet.solana.signMessage(message);

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('No public key available');
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should handle user rejection', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a message to sign
      const message = new TextEncoder().encode('Hello, Solana!');

      // Start signing process
      const signPromise = wallet.solana.signMessage(message);

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Simulate user rejecting the signing
      simulateWalletMessage(SolanaMessageType.SIGN_MESSAGE, {
        message: 'User rejected the signing request',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User rejected the signing request');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should handle popup being closed', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a message to sign
      const message = new TextEncoder().encode('Hello, Solana!');

      // Start signing process
      const signPromise = wallet.solana.signMessage(message);

      // Simulate popup being closed by user
      simulatePopupClosed();

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User closed the wallet window');
    });
  });

  describe('signTransaction()', () => {
    test('should sign a transaction successfully', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Start signing process
      const signPromise = wallet.solana.signTransaction(mockTransaction);

      // Verify popup was opened
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Verify the postMessage was called with the correct transaction data
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SolanaMessageType.SIGN_TRANSACTION,
          network: 'solana',
          payload: expect.objectContaining({
            transaction: mockTransaction,
          }),
        }),
        'http://localhost:3001'
      );

      // Simulate successful signing
      simulateWalletMessage(SolanaMessageType.SIGN_TRANSACTION, {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: 'signed-solana-transaction',
        },
      });

      // Wait for the signing promise to resolve
      const signedTx = await signPromise;

      // Check the result
      expect(signedTx).toBe('signed-solana-transaction');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected', async () => {
      // Ensure not connected
      wallet.solana._connected = false;
      wallet.solana._publicKey = null;

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Attempt to sign transaction when not connected
      const signPromise = wallet.solana.signTransaction(mockTransaction);

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Not connected');
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should reject if no public key available', async () => {
      // Connected but no public key
      wallet.solana._connected = true;
      wallet.solana._publicKey = null;

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Attempt to sign transaction with no public key
      const signPromise = wallet.solana.signTransaction(mockTransaction);

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('No public key available');
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should handle user rejection', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Start signing process
      const signPromise = wallet.solana.signTransaction(mockTransaction);

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Simulate user rejecting the transaction
      simulateWalletMessage(SolanaMessageType.SIGN_TRANSACTION, {
        message: 'User rejected the transaction',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User rejected the transaction');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should handle popup being closed', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Start signing process
      const signPromise = wallet.solana.signTransaction(mockTransaction);

      // Simulate popup being closed by user
      simulatePopupClosed();

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User closed the wallet window');
    });

    test('should reject a legacy transaction with non-matching feePayer', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock transaction with non-matching feePayer
      const mockTransaction = { 
        feePayer: 'different-public-key',
        recentBlockhash: 'recent-blockhash'
      };
  
      // Attempt to sign transaction with wrong feePayer
      const signPromise = wallet.solana.signTransaction(mockTransaction);
  
      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Transaction fee payer does not match connected account');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(window.open).not.toHaveBeenCalled(); // Popup should not be opened
    });
    test('should accept a versioned transaction with matching first signer', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock versioned transaction with matching first signer
      const mockVersionedTransaction = { 
        version: 0,
        message: {
          staticAccountKeys: ['solana-public-key-123', 'other-key-1', 'other-key-2']
        }
      };
  
      // Start signing process
      const signPromise = wallet.solana.signTransaction(mockVersionedTransaction);
  
      // Simulate the wallet flow
      simulateWalletMessage(SolanaMessageType.READY);
      simulateWalletMessage(SolanaMessageType.SIGN_TRANSACTION, {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: 'signed-versioned-transaction',
        },
      });
  
      // Wait for the signing promise to resolve
      const signedTx = await signPromise;
      expect(signedTx).toBe('signed-versioned-transaction');
    });
  
    test('should reject a versioned transaction with non-matching first signer', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock versioned transaction with non-matching first signer
      const mockVersionedTransaction = { 
        version: 0,
        message: {
          staticAccountKeys: ['different-public-key', 'other-key-1', 'other-key-2']
        }
      };
  
      // Attempt to sign transaction with wrong first signer
      const signPromise = wallet.solana.signTransaction(mockVersionedTransaction);
  
      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Transaction first signer does not match connected account');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(window.open).not.toHaveBeenCalled(); // Popup should not be opened
    });
  
    test('should reject a transaction that cannot be verified', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock transaction without feePayer or version
      const mockTransaction = { 
        recentBlockhash: 'recent-blockhash',
        // No feePayer, not a versioned transaction
      };
  
      // Attempt to sign unverifiable transaction
      const signPromise = wallet.solana.signTransaction(mockTransaction);
  
      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Unable to verify transaction ownership');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(window.open).not.toHaveBeenCalled(); // Popup should not be opened
    });
  });

  describe('signAllTransactions()', () => {
    test('should sign multiple transactions successfully', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create mock transactions
      const mockTransactions = [
        {
          feePayer: 'solana-public-key-123',
          recentBlockhash: 'recent-blockhash-1',
        },
        {
          feePayer: 'solana-public-key-123',
          recentBlockhash: 'recent-blockhash-2',
        },
      ];

      // Start signing process
      const signPromise = wallet.solana.signAllTransactions(mockTransactions);

      // Verify popup was opened
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Verify the postMessage was called with the correct transactions data
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SolanaMessageType.SIGN_ALL_TRANSACTIONS,
          network: 'solana',
          payload: expect.objectContaining({
            transactions: mockTransactions,
          }),
        }),
        'http://localhost:3001'
      );

      // Simulate successful signing
      simulateWalletMessage(SolanaMessageType.SIGN_ALL_TRANSACTIONS, {
        message: 'All transactions signed successfully',
        result: {
          signedTransactions: ['signed-solana-transaction-1', 'signed-solana-transaction-2'],
        },
      });

      // Wait for the signing promise to resolve
      const signedTxs = await signPromise;

      // Check the results
      expect(signedTxs).toEqual(['signed-solana-transaction-1', 'signed-solana-transaction-2']);
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected', async () => {
      // Ensure not connected
      wallet.solana._connected = false;
      wallet.solana._publicKey = null;

      // Create mock transactions
      const mockTransactions = [
        { feePayer: 'solana-public-key-123', recentBlockhash: 'recent-blockhash-1' },
        { feePayer: 'solana-public-key-123', recentBlockhash: 'recent-blockhash-2' },
      ];

      // Attempt to sign transactions when not connected
      const signPromise = wallet.solana.signAllTransactions(mockTransactions);

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Not connected');
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should handle user rejection', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create mock transactions
      const mockTransactions = [
        { feePayer: 'solana-public-key-123', recentBlockhash: 'recent-blockhash-1' },
        { feePayer: 'solana-public-key-123', recentBlockhash: 'recent-blockhash-2' },
      ];

      // Start signing process
      const signPromise = wallet.solana.signAllTransactions(mockTransactions);

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Simulate user rejecting the transactions
      simulateWalletMessage(SolanaMessageType.SIGN_ALL_TRANSACTIONS, {
        message: 'User rejected the transactions',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User rejected the transactions');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should accept transactions with different but valid ownership types', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create mock transactions with different but valid ownership types
      const mockTransactions = [
        { 
          feePayer: 'solana-public-key-123', // Legacy transaction
          recentBlockhash: 'recent-blockhash-1'
        },
        { 
          version: 0, // Versioned transaction
          message: {
            staticAccountKeys: ['solana-public-key-123', 'other-key-1']
          }
        }
      ];
  
      // Start signing process
      const signPromise = wallet.solana.signAllTransactions(mockTransactions);
  
      // Simulate the wallet flow
      simulateWalletMessage(SolanaMessageType.READY);
      simulateWalletMessage(SolanaMessageType.SIGN_ALL_TRANSACTIONS, {
        message: 'All transactions signed successfully',
        result: {
          signedTransactions: [
            'signed-solana-transaction-1',
            'signed-solana-transaction-2'
          ],
        },
      });
  
      // Wait for the signing promise to resolve
      const signedTxs = await signPromise;
      expect(signedTxs).toEqual([
        'signed-solana-transaction-1',
        'signed-solana-transaction-2'
      ]);
    });
  
    test('should reject if any transaction in the batch fails verification', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create mock transactions with one invalid transaction
      const mockTransactions = [
        { 
          feePayer: 'solana-public-key-123', // Valid
          recentBlockhash: 'recent-blockhash-1'
        },
        { 
          feePayer: 'different-public-key', // Invalid - feePayer doesn't match
          recentBlockhash: 'recent-blockhash-2'
        }
      ];
  
      // Attempt to sign transactions with one invalid transaction
      const signPromise = wallet.solana.signAllTransactions(mockTransactions);
  
      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Transaction fee payer does not match connected account');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(window.open).not.toHaveBeenCalled(); // Popup should not be opened
    });
  });

  describe('signAndSendTransaction()', () => {
    test('should sign and send a transaction successfully', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Start signing and sending process
      const sendPromise = wallet.solana.signAndSendTransaction(mockTransaction);

      // Verify popup was opened
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Verify the postMessage was called with the correct transaction data
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: SolanaMessageType.SIGN_AND_SEND_TRANSACTION,
          network: 'solana',
          payload: expect.objectContaining({
            transaction: mockTransaction,
          }),
        }),
        'http://localhost:3001'
      );

      // Simulate successful signing and sending
      simulateWalletMessage(SolanaMessageType.SIGN_AND_SEND_TRANSACTION, {
        message: 'Transaction signed and sent successfully',
        result: {
          signature: 'solana-tx-signature-123',
        },
      });

      // Wait for the promise to resolve
      const signature = await sendPromise;

      // Check the signature returned
      expect(signature).toBe('solana-tx-signature-123');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected', async () => {
      // Ensure not connected
      wallet.solana._connected = false;
      wallet.solana._publicKey = null;

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Attempt to sign and send transaction when not connected
      const sendPromise = wallet.solana.signAndSendTransaction(mockTransaction);

      // Wait for the promise to be rejected
      await expect(sendPromise).rejects.toThrow('Not connected');
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should handle wallet errors', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';

      // Create a mock transaction
      const mockTransaction = {
        feePayer: 'solana-public-key-123',
        recentBlockhash: 'recent-blockhash',
      };

      // Start signing and sending process
      const sendPromise = wallet.solana.signAndSendTransaction(mockTransaction);

      // Simulate the wallet sending a READY message
      simulateWalletMessage(SolanaMessageType.READY);

      // Simulate wallet returning an error
      simulateWalletMessage(SolanaMessageType.SIGN_AND_SEND_TRANSACTION, {
        message: 'Transaction simulation failed',
        errorCode: ErrorCode.TRANSACTION_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(sendPromise).rejects.toThrow('Transaction simulation failed');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject a transaction with non-matching feePayer', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock transaction with non-matching feePayer
      const mockTransaction = { 
        feePayer: 'different-public-key',
        recentBlockhash: 'recent-blockhash'
      };
  
      // Attempt to sign and send transaction with wrong feePayer
      const sendPromise = wallet.solana.signAndSendTransaction(mockTransaction);
  
      // Wait for the promise to be rejected
      await expect(sendPromise).rejects.toThrow('Transaction fee payer does not match connected account');
      await expect(sendPromise).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(window.open).not.toHaveBeenCalled(); // Popup should not be opened
    });
  
    test('should reject a versioned transaction with non-matching first signer', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock versioned transaction with non-matching first signer
      const mockVersionedTransaction = { 
        version: 0,
        message: {
          staticAccountKeys: ['different-public-key', 'other-key-1', 'other-key-2']
        }
      };
  
      // Attempt to sign and send transaction with wrong first signer
      const sendPromise = wallet.solana.signAndSendTransaction(mockVersionedTransaction);
  
      // Wait for the promise to be rejected
      await expect(sendPromise).rejects.toThrow('Transaction first signer does not match connected account');
      await expect(sendPromise).rejects.toMatchObject({
        code: ErrorCode.UNAUTHORIZED,
      });
      expect(window.open).not.toHaveBeenCalled(); // Popup should not be opened
    });
  
    test('should accept a versioned transaction with matching first signer', async () => {
      // Setup connected state
      wallet.solana._connected = true;
      wallet.solana._publicKey = 'solana-public-key-123';
  
      // Create a mock versioned transaction with matching first signer
      const mockVersionedTransaction = { 
        version: 0,
        message: {
          staticAccountKeys: ['solana-public-key-123', 'other-key-1', 'other-key-2']
        }
      };
  
      // Start signing and sending process
      const sendPromise = wallet.solana.signAndSendTransaction(mockVersionedTransaction);
  
      // Simulate the wallet flow
      simulateWalletMessage(SolanaMessageType.READY);
      simulateWalletMessage(SolanaMessageType.SIGN_AND_SEND_TRANSACTION, {
        message: 'Transaction signed and sent successfully',
        result: {
          signature: 'solana-versioned-tx-signature-123',
        },
      });
  
      // Wait for the promise to resolve
      const signature = await sendPromise;
      expect(signature).toBe('solana-versioned-tx-signature-123');
    });
  });

  describe('Event Handling', () => {
    test('Event listeners should work', () => {
      const mockCallback = jest.fn();

      // Add an event listener
      wallet.solana.on('connect', mockCallback);

      // Emit the event
      wallet.solana._emit('connect', 'solana-public-key-123');

      // Check the callback was called
      expect(mockCallback).toHaveBeenCalledWith('solana-public-key-123');
    });

    test('Event listener removal should work', () => {
      const mockCallback = jest.fn();

      // Add an event listener
      wallet.solana.on('connect', mockCallback);

      // Remove the event listener
      wallet.solana.off('connect', mockCallback);

      // Emit the event
      wallet.solana._emit('connect', 'solana-public-key-123');

      // Check the callback was not called
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('Multiple event listeners should all be called', () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      // Add event listeners
      wallet.solana.on('connect', mockCallback1);
      wallet.solana.on('connect', mockCallback2);

      // Emit the event
      wallet.solana._emit('connect', 'solana-public-key-123');

      // Check both callbacks were called
      expect(mockCallback1).toHaveBeenCalledWith('solana-public-key-123');
      expect(mockCallback2).toHaveBeenCalledWith('solana-public-key-123');
    });
  });
});
