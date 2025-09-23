# NewWallet SDK

A JavaScript/TypeScript SDK for integrating with NewWallet - a passkey-powered Web3 wallet that supports multiple blockchain networks.

## Installation

```bash
npm install @newwallet/wallet-sdk
```

or

```bash
yarn add @newwallet/wallet-sdk
```

## Development

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Start the demo dapp
yarn install:dapp
yarn serve:dapp

```
## Quick Start

```javascript
import NewWallet from '@newwallet/wallet-sdk';

// Initialize the SDK
const wallet = new NewWallet();

// Connect to Ethereum
const accounts = await wallet.ethereum.request({ 
  method: 'eth_requestAccounts' 
});
console.log('Connected:', accounts[0]);

// Connect to Solana
const publicKey = await wallet.solana.connect();
console.log('Solana pubkey:', publicKey);
```

## Basic Usage

### Ethereum, BSC, and Base

```javascript
// Connect (requests access to all EVM chains)
const accounts = await wallet.ethereum.request({
  method: 'eth_requestAccounts'
});

// Get current chain
const chainId = await wallet.ethereum.request({
  method: 'eth_chainId'
}); // Returns '0x1' for Ethereum mainnet

// Switch to BSC
await wallet.ethereum.request({
  method: 'wallet_switchEthereumChain',
  params: [{ chainId: '0x38' }] // BSC mainnet
});

// Sign a message
const signature = await wallet.ethereum.request({
  method: 'personal_sign',
  params: ['Hello World', accounts[0]]
});

// Send transaction
const txHash = await wallet.ethereum.request({
  method: 'eth_sendTransaction',
  params: [{
    from: accounts[0],
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    value: '0x5af3107a4000', // 0.0001 ETH in wei
  }]
});
```

### Solana

```javascript
// Connect
const publicKey = await wallet.solana.connect();

// Sign a message
const signature = await wallet.solana.signMessage('Hello Solana!');

// Sign and send a transaction
import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: new PublicKey(publicKey),
    toPubkey: new PublicKey('...'),
    lamports: 100000000, // 0.1 SOL
  })
);

const signature = await wallet.solana.signAndSendTransaction(transaction);
```

## Supported Networks

| Network | Chain ID | Hex | Status |
|---------|----------|-----|--------|
| Ethereum | 1 | 0x1 | ✅ Mainnet |
| Ethereum Sepolia | 11155111 | 0xaa36a7 | ✅ Testnet |
| BSC | 56 | 0x38 | ✅ Mainnet |
| BSC Testnet | 97 | 0x61 | ✅ Testnet |
| Base | 8453 | 0x2105 | ✅ Mainnet |
| Base Sepolia | 84532 | 0x14a34 | ✅ Testnet |
| Solana | - | - | ✅ Mainnet |
| Solana | - | - | ✅ Testnet |

## API Reference

### Ethereum Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `eth_requestAccounts` | Connect and get accounts | None | `string[]` - Account addresses |
| `eth_accounts` | Get connected accounts | None | `string[]` - Account addresses |
| `eth_chainId` | Get current chain ID | None | `string` - Hex chain ID |
| `wallet_switchEthereumChain` | Switch active chain | `[{ chainId: string }]` | `null` |
| `personal_sign` | Sign message | `[message: string, address: string]` | `string` - Signature |
| `eth_sendTransaction` | Send transaction | `[tx: TransactionRequest]` | `string` - Transaction hash |
| `eth_signTransaction` | Sign transaction | `[tx: TransactionRequest]` | `string` - Signed transaction |
| `eth_signTypedData_v4` | Sign typed data | `[address: string, typedData: any]` | `string` - Signature |

### Solana Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `connect()` | Connect to wallet | None | `Promise<string>` - Public key |
| `disconnect()` | Disconnect from wallet | None | `Promise<void>` |
| `signMessage(message)` | Sign a message | `string \| Uint8Array` | `Promise<string>` - Signature |
| `signTransaction(transaction)` | Sign a transaction | `Transaction \| VersionedTransaction` | `Promise<Transaction \| VersionedTransaction>` |
| `signAllTransactions(transactions)` | Sign multiple transactions | `Array<Transaction \| VersionedTransaction>` | `Promise<Array<Transaction \| VersionedTransaction>>` |
| `signAndSendTransaction(transaction, sendOptions?)` | Sign and send transaction | `Transaction \| VersionedTransaction`, `SendOptions?` | `Promise<string>` - Signature |

## Error Handling

```javascript
try {
  const accounts = await wallet.ethereum.request({
    method: 'eth_requestAccounts'
  });
} catch (error) {
  switch (error.code) {
    case 4001:
      // User rejected the request
      console.log('User denied account access');
      break;
    case 4900:
      // Wallet is disconnected
      console.log('Wallet disconnected');
      break;
    default:
      console.error('Error:', error.message);
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| 4001 | User rejected request |
| 4100 | Unauthorized - account/method not authorized |
| 4200 | Unsupported method |
| 4900 | Disconnected |
| -32000 | Invalid input |
| -32002 | Resource unavailable |
| -32003 | Transaction rejected |
| -32603 | Internal error |


## License

MIT - see [LICENSE](LICENSE) for details.

## Support and Resources

- [GitHub Repository](https://github.com/newwallet-io/@newwallet/wallet-sdk)
- [Issue Tracker](https://github.com/newwallet-io/@newwallet/wallet-sdk/issues)
- [Demo Applications](https://github.com/newwallet-io/@newwallet/wallet-sdk/tree/main/examples)