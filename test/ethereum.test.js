// test/sdk.test.js

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
      network: 'ethereum',
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
const { ErrorCode } = NewWallet;

describe('NewWallet SDK', () => {
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
    test('SDK should be properly initialized', () => {
      expect(wallet).toBeDefined();
      expect(wallet.ethereum).toBeDefined();
      expect(wallet.isInstalled()).toBe(true);
    });

    test('Ethereum provider should have request method', () => {
      expect(typeof wallet.ethereum.request).toBe('function');
    });
  });

  describe('eth_requestAccounts (Connect Wallet)', () => {
    test('should open popup and connect successfully', async () => {
      // Start connection process
      const connectPromise = wallet.ethereum.request({ method: 'eth_requestAccounts' });

      // The wallet should have opened a popup
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Now simulate the wallet sending a successful connection response
      simulateWalletMessage('CONNECT_WALLET', {
        message: 'Connected successfully',
        result: {
          address: '0x1234567890123456789012345678901234567890',
          chainId: '0x1',
        },
      });

      // Wait for the connection promise to resolve
      const accounts = await connectPromise;

      // Check the accounts returned
      expect(accounts).toEqual(['0x1234567890123456789012345678901234567890']);
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should handle user rejection', async () => {
      // Start connection process
      const connectPromise = wallet.ethereum.request({ method: 'eth_requestAccounts' });

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Simulate user rejecting the connection
      simulateWalletMessage('CONNECT_WALLET', {
        message: 'User rejected the connection request',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(connectPromise).rejects.toThrow('User rejected the connection request');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should handle popup being closed', async () => {
      // Start connection process
      const connectPromise = wallet.ethereum.request({ method: 'eth_requestAccounts' });

      // Simulate popup being closed by user
      simulatePopupClosed();

      // Wait for the promise to be rejected
      await expect(connectPromise).rejects.toThrow('User closed the wallet window');
    });
  });

  describe('eth_accounts (Get Accounts)', () => {
    test('should return connected accounts when connected', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      // Request accounts
      const accounts = await wallet.ethereum.request({ method: 'eth_accounts' });

      // Check accounts returned
      expect(accounts).toEqual(['0x1234567890123456789012345678901234567890']);
      expect(window.open).not.toHaveBeenCalled(); // Shouldn't open popup
    });

    test('should return empty array when not connected', async () => {
      const accounts = await wallet.ethereum.request({ method: 'eth_accounts' });
      expect(accounts).toEqual([]);
    });
  });

  describe('eth_chainId (Get Chain ID)', () => {
    test('should return current chain ID when connected', async () => {
      // Setup connected state with chain ID
      wallet.ethereum._connected = true;
      wallet.ethereum._chainId = '0x1';

      // Request chain ID
      const chainId = await wallet.ethereum.request({ method: 'eth_chainId' });

      // Check chain ID returned
      expect(chainId).toEqual('0x1');
      expect(window.open).not.toHaveBeenCalled(); // Shouldn't open popup
    });

    test('should return null when not connected', async () => {
      const chainId = await wallet.ethereum.request({ method: 'eth_chainId' });
      expect(chainId).toBeNull();
    });
  });

  describe('personal_sign (Sign Message)', () => {
    test('should sign a message successfully', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const message = 'Hello, Ethereum!';
      const address = '0x1234567890123456789012345678901234567890';

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Simulate successful signing
      simulateWalletMessage('ETH_SIGN_MESSAGE', {
        message: 'Message signed successfully',
        result: {
          signature: '0xsignature',
        },
      });

      // Wait for the signing promise to resolve
      const signature = await signPromise;

      // Check signature returned
      expect(signature).toEqual('0xsignature');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected to requested account', async () => {
      // Setup connected state with different account
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0xdifferentaddress'];

      const message = 'Hello, Ethereum!';
      const address = '0x1234567890123456789012345678901234567890';

      // Attempt to sign with unconnected account
      const signPromise = wallet.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('Not connected to the requested account');
    });

    test('should handle user rejection', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const message = 'Hello, Ethereum!';
      const address = '0x1234567890123456789012345678901234567890';

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Simulate user rejecting the signing
      simulateWalletMessage('ETH_SIGN_MESSAGE', {
        message: 'User rejected the signing request',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User rejected the signing request');
    });
  });

  describe('eth_sendTransaction (Send Transaction)', () => {
    test('should open popup and send transaction successfully', async () => {
      // First connect
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Create a promise for sending transaction
      const txPromise = wallet.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      // The wallet should have opened a popup
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Now simulate the wallet sending a successful transaction response
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
          from: '0x1234567890123456789012345678901234567890',
          to: '0x0987654321098765432109876543210987654321',
          value: '0x38D7EA4C68000',
        },
      });

      // Wait for the transaction promise to resolve
      const txHash = await txPromise;

      // Check the transaction hash returned
      expect(txHash).toBe('0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected', async () => {
      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Attempt to send transaction when not connected
      const txPromise = wallet.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      // Wait for the promise to be rejected
      await expect(txPromise).rejects.toThrow('Not connected');
    });

    test('should reject if from address does not match connected account', async () => {
      // Setup connected state with different account
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0xdifferentaddress'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890', // Different from connected account
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Attempt to send transaction from unconnected account
      const txPromise = wallet.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      // Wait for the promise to be rejected
      await expect(txPromise).rejects.toThrow('From address not connected');
    });
  });

  describe('eth_signTransaction (Sign Transaction)', () => {
    test('should sign a transaction successfully', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
        gas: '0x5208',
        gasPrice: '0x3B9ACA00',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Simulate successful signing
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: '0xf86c8085...', // Example signed transaction data
        },
      });

      // Wait for the signing promise to resolve
      const signedTx = await signPromise;

      // Check the signed transaction returned
      expect(signedTx).toEqual('0xf86c8085...');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should reject if not connected to requested account', async () => {
      // Setup connected state with different account
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0xdifferentaddress'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890', // Different from connected account
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Attempt to sign with unconnected account
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('From address not connected');
    });

    test('should handle user rejection', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      // Simulate user rejecting the signing
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'User rejected the transaction signing request',
        errorCode: ErrorCode.USER_REJECTED,
      });

      // Wait for the promise to be rejected
      await expect(signPromise).rejects.toThrow('User rejected the transaction signing request');
    });

    test('should reject if not connected before signing transaction', async () => {
      // Ensure not connected
      wallet.ethereum._connected = false;

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Attempt to sign
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Should reject with disconnected error
      await expect(signPromise).rejects.toThrow('Not connected');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.DISCONNECTED,
      });

      // Verify popup wasn't opened
      expect(window.open).not.toHaveBeenCalled();
    });

    test('should open popup with correct URL when signing transaction', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Verify popup was opened with correct URL
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001',
        expect.any(String),
        expect.any(String)
      );

      // Simulate wallet flow to complete the test
      simulateWalletMessage('READY');
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx',
        },
      });

      const result = await signPromise;
      expect(result).toBe('0xtestsignedtx');
    });

    test('should send transaction data in the postMessage to wallet', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
        customField: 'test-data',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate wallet ready
      simulateWalletMessage('READY');

      // Check if postMessage was called with correct data
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ETH_SIGN_TRANSACTION',
          network: 'ethereum',
          payload: {
            encoding: 'json',
            serializedTransaction: JSON.stringify(txParams),
          },
        }),
        'http://localhost:3001'
      );

      // Complete the test
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx',
        },
      });

      await signPromise;
    });

    test('should handle wallet origin validation correctly', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Create a mock event with incorrect origin
      const mockWrongOriginEvent = {
        data: {
          type: 'READY',
          network: 'ethereum',
        },
        origin: 'http://malicious-site.com',
      };

      // Manually trigger event listener with wrong origin
      if (eventListeners['message'] && eventListeners['message'].length > 0) {
        eventListeners['message'][0](mockWrongOriginEvent);
      }

      // Verify postMessage was not called yet (wrong origin)
      expect(mockPopup.postMessage).not.toHaveBeenCalled();

      // Now simulate correct wallet message
      simulateWalletMessage('READY');

      // Verify postMessage was called now (correct origin)
      expect(mockPopup.postMessage).toHaveBeenCalled();

      // Complete the test
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx',
        },
      });

      await signPromise;
    });

    test('should close popup when transaction is signed', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate wallet ready
      simulateWalletMessage('READY');

      // Simulate successful signing
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx',
        },
      });

      await signPromise;

      // Verify popup was closed
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should clean up event listeners after signing', async () => {
      // Create spies for the cleanup functions
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate wallet ready and successful signing
      simulateWalletMessage('READY');
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx',
        },
      });

      await signPromise;

      // Verify event listener was removed (just check it was called, not with what parameter)
      expect(removeEventListenerSpy).toHaveBeenCalled();

      // Verify interval was cleared
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Clean up the spies
      removeEventListenerSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    test('should handle multiple consecutive transaction signing requests', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      // First transaction
      const txParams1 = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
        nonce: '0x1',
      };

      // Second transaction
      const txParams2 = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x77359400',
        nonce: '0x2',
      };

      // Start first signing process
      const signPromise1 = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams1],
      });

      // Simulate wallet ready and successful signing for first transaction
      simulateWalletMessage('READY');
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction 1 signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx1',
        },
      });

      // Wait for first transaction to complete
      const result1 = await signPromise1;
      expect(result1).toBe('0xtestsignedtx1');

      // Clear mocks for second transaction
      jest.clearAllMocks();
      mockPopup.closed = false;

      // Start second signing process
      const signPromise2 = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams2],
      });

      // Verify second popup was opened
      expect(window.open).toHaveBeenCalled();

      // Simulate wallet ready and successful signing for second transaction
      simulateWalletMessage('READY');
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Transaction 2 signed successfully',
        result: {
          signedTransaction: '0xtestsignedtx2',
        },
      });

      // Wait for second transaction to complete
      const result2 = await signPromise2;
      expect(result2).toBe('0xtestsignedtx2');
    });

    test('should handle wallet returning error response', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate wallet ready
      simulateWalletMessage('READY');

      // Simulate wallet returning error
      simulateWalletMessage('ETH_SIGN_TRANSACTION', {
        message: 'Wallet internal error',
        errorCode: ErrorCode.INTERNAL_ERROR,
      });

      // Verify promise rejects with correct error
      await expect(signPromise).rejects.toThrow('Wallet internal error');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.INTERNAL_ERROR,
      });

      // Verify popup was closed
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should handle popup being closed by user', async () => {
      // Setup connected state
      wallet.ethereum._connected = true;
      wallet.ethereum._accounts = ['0x1234567890123456789012345678901234567890'];

      const txParams = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: '0x38D7EA4C68000',
      };

      // Start signing process
      const signPromise = wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams],
      });

      // Simulate popup being closed by user
      simulatePopupClosed();

      // Verify promise rejects with user rejected error
      await expect(signPromise).rejects.toThrow('User closed the wallet window');
      await expect(signPromise).rejects.toMatchObject({
        code: ErrorCode.USER_REJECTED,
      });
    });
  });

  describe('Unsupported Methods', () => {
    test('Unsupported method should throw error', async () => {
      // Attempt to call unsupported method
      const promise = wallet.ethereum.request({
        method: 'unsupported_method',
      });

      // Wait for the promise to be rejected
      await expect(promise).rejects.toThrow('Method not supported: unsupported_method');
    });

    test('Unsupported method with parameters should still throw error', async () => {
      // Attempt to call unsupported method with parameters
      const promise = wallet.ethereum.request({
        method: 'unsupported_method',
        params: ['param1', 'param2'],
      });

      // Wait for the promise to be rejected
      await expect(promise).rejects.toThrow('Method not supported: unsupported_method');
    });

    test('Method with incorrect casing should throw unsupported error', async () => {
      // Attempt to call a method with incorrect casing
      const promise = wallet.ethereum.request({
        method: 'ETH_ACCOUNTS', // Correct would be "eth_accounts"
      });

      // Wait for the promise to be rejected
      await expect(promise).rejects.toThrow('Method not supported: ETH_ACCOUNTS');
    });

    test('Empty method name should throw error', async () => {
      // Attempt to call with empty method name
      const promise = wallet.ethereum.request({
        method: '',
      });

      // Wait for the promise to be rejected
      await expect(promise).rejects.toThrow('Method not supported:');
    });

    test('Non-string method name should throw error', async () => {
      // Attempt to call with non-string method name
      const promise = wallet.ethereum.request({
        method: 123,
      });

      // This will likely throw a TypeScript error if used with proper types,
      // but testing for runtime behavior here
      await expect(promise).rejects.toThrow();
    });
  });

  describe('Event Handling', () => {
    test('Event listeners should work', () => {
      const mockCallback = jest.fn();

      // Add an event listener
      wallet.ethereum.on('accountsChanged', mockCallback);

      // Emit the event
      wallet.ethereum._emit('accountsChanged', ['0x1234567890123456789012345678901234567890']);

      // Check the callback was called
      expect(mockCallback).toHaveBeenCalledWith(['0x1234567890123456789012345678901234567890']);
    });

    test('Event listener removal should work', () => {
      const mockCallback = jest.fn();

      // Add an event listener
      wallet.ethereum.on('accountsChanged', mockCallback);

      // Remove the event listener
      wallet.ethereum.off('accountsChanged', mockCallback);

      // Emit the event
      wallet.ethereum._emit('accountsChanged', ['0x1234567890123456789012345678901234567890']);

      // Check the callback was not called
      expect(mockCallback).not.toHaveBeenCalled();
    });

    test('Multiple event listeners should all be called', () => {
      const mockCallback1 = jest.fn();
      const mockCallback2 = jest.fn();

      // Add event listeners
      wallet.ethereum.on('accountsChanged', mockCallback1);
      wallet.ethereum.on('accountsChanged', mockCallback2);

      // Emit the event
      wallet.ethereum._emit('accountsChanged', ['0x1234567890123456789012345678901234567890']);

      // Check both callbacks were called
      expect(mockCallback1).toHaveBeenCalledWith(['0x1234567890123456789012345678901234567890']);
      expect(mockCallback2).toHaveBeenCalledWith(['0x1234567890123456789012345678901234567890']);
    });
  });
});
