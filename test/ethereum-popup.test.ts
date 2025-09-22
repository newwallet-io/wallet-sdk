// test/providers/ethereum-popup.test.ts

// Don't mock openPopup, let it call window.open
import { EthereumProvider } from '../src/providers/ethereum';
import { CONNECTION_METHODS } from '../src/types';
import { openPopup } from '../src/utils';

// Mock popup object
const mockPopup = {
  postMessage: jest.fn(),
  closed: false,
  close: jest.fn(),
};

// Mock window before the provider uses it
Object.defineProperty(window, 'open', {
  writable: true,
  value: jest.fn().mockImplementation(() => mockPopup)
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

// Mock setInterval/clearInterval
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

describe('EthereumProvider with Popup', () => {
  let provider: EthereumProvider;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPopup.closed = false;
    provider = new EthereumProvider('https://newwallet.io/transaction_signing', 'ethereum');
    
    // Clear event listeners
    for (const key in eventListeners) {
      eventListeners[key] = [];
    }
  });

  test('should handle eth_requestAccounts with popup', async () => {
    // Start connection
    const connectPromise = provider.request({ 
      method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS 
    });

    // Check popup was opened
    expect(window.open).toHaveBeenCalledWith(
      'https://newwallet.io/transaction_signing',
      expect.any(String),
      expect.any(String)
    );

    // Rest of your test...
  });
});