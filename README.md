# NewWallet SDK Documentation

## Introduction

NewWallet SDK allows developers to connect their decentralized applications (DApps) to NewWallet, enabling users to interact with multiple blockchain networks including Ethereum and Solana. The SDK provides a consistent interface for wallet connection, transaction signing, and other blockchain operations.

## Installation

### NPM

```bash
npm install newwallet-sdk
```

### Yarn

```bash
yarn add newwallet-sdk
```

## Usage

### Initialize the SDK

```javascript
import NewWallet from 'newwallet-sdk';

// Initialize with default options
const wallet = new NewWallet();

```

### Direct script tag

```html
<script src="https://unpkg.com/newwallet-sdk@latest/dist/index.umd.js"></script>
```

## Ethereum API

NewWallet provides an Ethereum provider that follows the [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193) standard, making it compatible with existing Ethereum DApps.

### Connect to Wallet

```javascript
try {
  const accounts = await wallet.ethereum.request({
    method: 'eth_requestAccounts'
  });
  
  console.log('Connected accounts:', accounts);
  const activeAccount = accounts[0];
} catch (error) {
  console.error('Connection error:', error);
}
```

### Get Chain ID

```javascript
try {
  const chainId = await wallet.ethereum.request({
    method: 'eth_chainId'
  });
  
  console.log('Current chain ID:', chainId);
} catch (error) {
  console.error('Error getting chain ID:', error);
}
```

### Sign a Message

```javascript
try {
  const message = 'Hello, Ethereum!';
  const from = '0x1234...'; // User's address
  
  const signature = await wallet.ethereum.request({
    method: 'personal_sign',
    params: [message, from]
  });
  
  console.log('Message signature:', signature);
} catch (error) {
  console.error('Signing error:', error);
}
```

### Sign a Transaction

```javascript
try {
  const txParams = {
    from: '0x1234...', // User's address
    to: '0x9876...', // Recipient address
    value: '0x38D7EA4C68000', // 0.001 ETH in wei (hex)
    gas: '0x5208', // 21000 gas (hex)
    gasPrice: '0x3B9ACA00', // 1 Gwei (hex)
  };
  
  const signedTx = await wallet.ethereum.request({
    method: 'eth_signTransaction',
    params: [txParams]
  });
  
  console.log('Signed transaction:', signedTx);
} catch (error) {
  console.error('Transaction signing error:', error);
}
```

### Send a Transaction

```javascript
try {
  const txParams = {
    from: '0x1234...', // User's address
    to: '0x9876...', // Recipient address
    value: '0x38D7EA4C68000', // 0.001 ETH in wei (hex)
    gas: '0x5208', // 21000 gas (hex)
  };
  
  const txHash = await wallet.ethereum.request({
    method: 'eth_sendTransaction',
    params: [txParams]
  });
  
  console.log('Transaction hash:', txHash);
} catch (error) {
  console.error('Transaction error:', error);
}
```

### Event Listeners

```javascript
// Listen for accounts changed
wallet.ethereum.on('accountsChanged', (accounts) => {
  console.log('Accounts changed:', accounts);
});

// Listen for chain changed
wallet.ethereum.on('chainChanged', (chainId) => {
  console.log('Chain changed:', chainId);
});

// Remove an event listener
const handleAccountsChanged = (accounts) => {
  console.log('Accounts changed:', accounts);
};

wallet.ethereum.on('accountsChanged', handleAccountsChanged);
wallet.ethereum.off('accountsChanged', handleAccountsChanged);
```

## Solana API

NewWallet provides a Solana provider compatible with Phantom's interface for easy migration.

### Connect to Wallet

```javascript
try {
  const publicKey = await wallet.solana.connect();
  console.log('Connected public key:', publicKey);
} catch (error) {
  console.error('Connection error:', error);
}
```

### Disconnect

```javascript
await wallet.solana.disconnect();
console.log('Disconnected from wallet');
```

### Check Connection Status

```javascript
const isConnected = wallet.solana.isConnected();
console.log('Is connected:', isConnected);

const publicKey = wallet.solana.getPublicKey();
console.log('Current public key:', publicKey);
```

### Sign a Message

```javascript
try {
  // Create a message as a Uint8Array
  const message = new TextEncoder().encode('Hello, Solana!');
  
  const signature = await wallet.solana.signMessage(message);
  console.log('Message signature:', signature);
} catch (error) {
  console.error('Signing error:', error);
}
```

### Sign a Transaction

```javascript
try {
  // Create a Solana transaction
  // Note: In a real app, you would use @solana/web3.js to create this
  const transaction = {
    feePayer: wallet.solana.getPublicKey(),
    recentBlockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
    instructions: [
      {
        programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        keys: [
          { pubkey: wallet.solana.getPublicKey(), isSigner: true, isWritable: true },
          { pubkey: 'GfEHGBwXDwL5RKmZFQKQx8F9MTiogi7XKD7pzYz3YTEu', isSigner: false, isWritable: true }
        ],
        data: new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0]) // Simplified instruction
      }
    ]
  };
  
  const signedTransaction = await wallet.solana.signTransaction(transaction);
  console.log('Signed transaction:', signedTransaction);
} catch (error) {
  console.error('Transaction signing error:', error);
}
```

### Sign Multiple Transactions

```javascript
try {
  // Create multiple transactions
  const transactions = [
    // First transaction
    {
      feePayer: wallet.solana.getPublicKey(),
      recentBlockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
      instructions: [/* ... */]
    },
    // Second transaction
    {
      feePayer: wallet.solana.getPublicKey(),
      recentBlockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
      instructions: [/* ... */]
    }
  ];
  
  const signedTransactions = await wallet.solana.signAllTransactions(transactions);
  console.log('Signed transactions:', signedTransactions);
} catch (error) {
  console.error('Transaction signing error:', error);
}
```

### Sign and Send a Transaction

```javascript
try {
  // Create a Solana transaction
  const transaction = {
    feePayer: wallet.solana.getPublicKey(),
    recentBlockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
    instructions: [/* ... */]
  };
  
  const signature = await wallet.solana.signAndSendTransaction(transaction);
  console.log('Transaction signature:', signature);
} catch (error) {
  console.error('Transaction error:', error);
}
```

### Event Listeners

```javascript
// Listen for connect events
wallet.solana.on('connect', (publicKey) => {
  console.log('Connected with public key:', publicKey);
});

// Listen for disconnect events
wallet.solana.on('disconnect', () => {
  console.log('Disconnected from wallet');
});

// Remove an event listener
const handleConnect = (publicKey) => {
  console.log('Connected with public key:', publicKey);
};

wallet.solana.on('connect', handleConnect);
wallet.solana.off('connect', handleConnect);
```

## Error Handling

The SDK provides a standardized error system with error codes and messages:

```javascript
import { ErrorCode } from 'newwallet-sdk';

try {
  // Attempt an operation
  await wallet.ethereum.request({ method: 'eth_requestAccounts' });
} catch (error) {
  if (error.code === ErrorCode.USER_REJECTED) {
    console.log('User rejected the request');
  } else if (error.code === ErrorCode.UNAUTHORIZED) {
    console.log('Unauthorized');
  } else if (error.code === ErrorCode.DISCONNECTED) {
    console.log('Wallet is disconnected');
  } else {
    console.error('Unknown error:', error.message);
  }
}
```

Common error codes:

- `ErrorCode.USER_REJECTED (4001)`: User rejected the request
- `ErrorCode.UNAUTHORIZED (4100)`: The requested method/account has not been authorized
- `ErrorCode.UNSUPPORTED_METHOD (4200)`: The provider does not support the requested method
- `ErrorCode.DISCONNECTED (4900)`: The provider is disconnected
- `ErrorCode.INTERNAL_ERROR (-32603)`: Internal JSON-RPC error

## API Reference

### NewWallet

- `constructor(options)`: Initialize the SDK
  - `options.walletUrl`: Optional URL for the NewWallet

- `isInstalled()`: Check if NewWallet is available
  - Returns: `boolean`

### Ethereum Provider

- `request(args)`: Make a request to the Ethereum provider
  - `args.method`: The RPC method to call
  - `args.params`: Parameters for the method
  - Returns: `Promise<any>`

- `on(event, listener)`: Add an event listener
  - `event`: Event name ('accountsChanged', 'chainChanged', etc.)
  - `listener`: Callback function

- `off(event, listener)`: Remove an event listener

### Solana Provider

- `connect()`: Connect to Solana wallet
  - Returns: `Promise<string>` - The public key

- `disconnect()`: Disconnect from Solana wallet
  - Returns: `Promise<void>`

- `isConnected()`: Check if connected to Solana wallet
  - Returns: `boolean`

- `getPublicKey()`: Get the connected public key
  - Returns: `string | null`

- `signMessage(message)`: Sign a message
  - `message`: Uint8Array message to sign
  - Returns: `Promise<string>` - The signature

- `signTransaction(transaction)`: Sign a transaction
  - `transaction`: Transaction to sign
  - Returns: `Promise<any>` - The signed transaction

- `signAllTransactions(transactions)`: Sign multiple transactions
  - `transactions`: Array of transactions to sign
  - Returns: `Promise<any[]>` - Array of signed transactions

- `signAndSendTransaction(transaction)`: Sign and send a transaction
  - `transaction`: Transaction to sign and send
  - Returns: `Promise<string>` - The transaction signature

- `on(event, listener)`: Add an event listener
  - `event`: Event name ('connect', 'disconnect', etc.)
  - `listener`: Callback function

- `off(event, listener)`: Remove an event listener

## Support and Resources

For more information, examples, and updates:

- [GitHub Repository](https://github.com/newwallet-io/newwallet-sdk)
- [Issue Tracker](https://github.com/newwallet-io/newwallet-sdk/issues)
- [Demo Applications](https://github.com/newwallet-io/newwallet-sdk/tree/main/examples)