// Mock popup object
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
  if (eventListeners['message'] && eventListeners['message'].length > 0) {
    // Force the interval callback to run
    if (typeof global.setInterval.mock.calls[0][0] === 'function') {
      global.setInterval.mock.calls[0][0]();
    }
  }
}
const NewWallet = require('../dist/index.js');
const { CONNECTION_METHODS, EIP155_METHODS, CHAIN_IDS, ErrorCode } = NewWallet;

describe('Ethereumwallet.ethereum', () => {
  let wallet;
  const walletUrl = 'http://localhost:3001/transaction_signing';

  beforeEach(() => {
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

  describe('Initialization', () => {
    test('SDK should be properly initialized', () => {
      expect(wallet).toBeDefined();
      expect(wallet.ethereum).toBeDefined();
      expect(wallet.isInstalled()).toBe(true);
    });

    test('Ethereum wallet.ethereum should have request method', () => {
      expect(typeof wallet.ethereum.request).toBe('function');
    });
  });
  describe('Connection', () => {
    test('should open popup and connect successfully', async () => {
      // Start connection process
      const connectPromise = wallet.ethereum.request({ method: 'eth_requestAccounts' });

      // The wallet should have opened a popup
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001/transaction_signing',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:1:0xeth2',
              'eip155:56:0xbsc1',
              'eip155:56:0xbsc2',
              'eip155:8453:0xbase1',
              'solana:1:0xsol1',
            ],
          },
          chains: {
            eip155: 'eip155:1', // Active chain is Ethereum mainnet
          },
        },
      });
      // Wait for the connection promise to resolve
      const accounts = await connectPromise;

      // Check the accounts returned
      expect(accounts).toEqual(['0xeth1', '0xeth2']);
      expect(mockPopup.close).toHaveBeenCalled();
    });
    it('should connect and request all EVM chains', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      // Check popup opened
      expect(window.open).toHaveBeenCalledWith(walletUrl, expect.any(String), expect.any(String));

      simulateWalletMessage('READY');
      console.log('Mock popup postMessage calls:', mockPopup.postMessage.mock.calls);
      // Check requested all chains
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
          requiredNamespaces: {
            eip155: expect.objectContaining({
              chains: [
                CHAIN_IDS.ETHEREUM_MAINNET,
                CHAIN_IDS.ETHEREUM_SEPOLIA,
                CHAIN_IDS.BSC_MAINNET,
                CHAIN_IDS.BSC_TESTNET,
                CHAIN_IDS.BASE_MAINNET,
                CHAIN_IDS.BASE_SEPOLIA,
              ],
            }),
          },
        }),
        'http://localhost:3001'
      );
      console.log('Mock popup postMessage calls:1');
      // Simulate response with different accounts per chain
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:1:0xeth2',
              'eip155:56:0xbsc1',
              'eip155:56:0xbsc2',
              'eip155:8453:0xbase1',
              'solana:1:0xsol1',
            ],
          },
          chains: {
            eip155: 'eip155:1', // Active chain is Ethereum mainnet
          },
        },
      });
      console.log('Mock popup postMessage calls:2');
      const accounts = await promise;

      // Should return Ethereum mainnet accounts (current chain)
      expect(accounts).toEqual(['0xeth1', '0xeth2']);
      expect(wallet.ethereum.isConnected()).toBe(true);
      expect(wallet.ethereum.getChainId()).toBe('0x1');

      // Check accounts per chain
      expect(wallet.ethereum.getAccountsForChain('eip155:1')).toEqual(['0xeth1', '0xeth2']);
      expect(wallet.ethereum.getAccountsForChain('eip155:56')).toEqual(['0xbsc1', '0xbsc2']);
      expect(wallet.ethereum.getAccountsForChain('eip155:8453')).toEqual(['0xbase1']);
    });

    it('should handle wallet with active BSC chain', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1', 'eip155:56:0xbsc1', 'eip155:56:0xbsc2'],
          },
          chains: {
            eip155: 'eip155:56', // Active chain is BSC
          },
        },
      });

      const accounts = await promise;

      // Should return BSC accounts
      expect(accounts).toEqual(['0xbsc1', '0xbsc2']);
      expect(wallet.ethereum.getChainId()).toBe('0x38'); // BSC mainnet
    });
  });

  describe('Chain switching', () => {
    beforeEach(async () => {
      // Setup connected state
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1', 'eip155:56:0xbsc1', 'eip155:8453:0xbase1'],
          },
          supportedChains: ['eip155:1', 'eip155:56', 'eip155:8453'],
        },
      });

      await promise;
    });

    it('should switch chains and update accounts', async () => {
      const chainChangedListener = jest.fn();
      const accountsChangedListener = jest.fn();

      wallet.ethereum.on('chainChanged', chainChangedListener);
      wallet.ethereum.on('accountsChanged', accountsChangedListener);

      // Initially on Ethereum
      expect(wallet.ethereum.getAccounts()).toEqual(['0xeth1']);

      // Switch to BSC
      await wallet.ethereum.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }], // BSC mainnet
      });

      expect(wallet.ethereum.getChainId()).toBe('0x38');
      expect(wallet.ethereum.getAccounts()).toEqual(['0xbsc1']);
      expect(chainChangedListener).toHaveBeenCalledWith('0x38');
      expect(accountsChangedListener).toHaveBeenCalledWith(['0xbsc1']);
    });

    it('should reject unsupported chain', async () => {
      await expect(
        wallet.ethereum.request({
          method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
          params: [{ chainId: '0x89' }], // Polygon - not supported
        })
      ).rejects.toThrow('not supported');
    });
  });

  describe('Signing methods', () => {
    beforeEach(async () => {
      // Setup connected state with different accounts per chain
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1', 'eip155:56:0xbsc1'],
          },
        },
      });

      await promise;
    });

    it('should sign with current chain account', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xeth1'],
      });

      simulateWalletMessage('READY');

      // Check chainId is included
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xeth1'],
          chainId: 'eip155:1', // Current chain
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xsignature',
      });

      const signature = await promise;
      expect(signature).toBe('0xsignature');
    });

    it('should reject signing with wrong chain account', async () => {
      // Currently on Ethereum, try to sign with BSC account
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'], // BSC account on Ethereum chain
        })
      ).rejects.toThrow('not available on chain');
    });

    it('should sign after switching chains', async () => {
      // Switch to BSC
      await wallet.ethereum.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }],
      });

      jest.clearAllMocks();

      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xbsc1'],
      });

      simulateWalletMessage('READY');

      // Check BSC chainId is used
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'],
          chainId: 'eip155:56', // BSC chain
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xbsc_signature',
      });

      const signature = await promise;
      expect(signature).toBe('0xbsc_signature');
    });
  });

  describe('eth_sendTransaction', () => {
    beforeEach(async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { eip155: ['eip155:1:0xeth1'] },
        },
      });
      await promise;
    });

    it('should send transaction with current chain', async () => {
      const tx = {
        from: '0xeth1',
        to: '0xrecipient',
        value: '0x1000',
      };

      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        params: [tx],
      });

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.ETH_SEND_TRANSACTION,
          params: [expect.objectContaining(tx)],
          chainId: 'eip155:1',
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        result: '0xtxhash',
      });

      const txHash = await promise;
      expect(txHash).toBe('0xtxhash');
    });
  });
});
