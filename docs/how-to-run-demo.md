# Running the Examples

This guide explains how to run the demo examples included with the NewWallet SDK.

## Prerequisites

Before running the examples, make sure you have:

1. Node.js (v14 or later) and npm installed
2. Git installed (to clone the repository)

## Directory Structure

The examples are located in the `examples` directory of the SDK:

```
wallet-sdk/
├── examples/
│   ├── demo-dapp/         # Example DApp that integrates with NewWallet
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   └── libs/          # Will contain the built SDK
│   │       └── index.umd.js
│   └── demo-wallet/       # Example Wallet implementation for testing
│       ├── index.html
│       ├── styles.css
│       └── script.js
├── src/                   # SDK Source code
├── dist/                  # Built SDK files
└── package.json
```

## Setting Up

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wallet-sdk.git
   cd wallet-sdk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the SDK:
   ```bash
   npm run build
   ```
   This will:
   - Compile the TypeScript code
   - Create distribution files in the `dist` directory
   - Copy the UMD build to `examples/demo-dapp/libs/index.umd.js`

## Running the Demo

The package.json includes scripts to run both the demo DApp and the demo wallet:

```bash
npm run demo
```

This command uses [concurrently](https://www.npmjs.com/package/concurrently) to start two HTTP servers:

- The DApp server on http://localhost:3002
- The wallet server on http://localhost:3001

You can also run them separately:

```bash
# Run only the DApp
npm run serve:dapp

# Run only the wallet
npm run serve:wallet
```

## Using the Demo

1. Open your browser and navigate to http://localhost:3002
2. The demo DApp interface should appear with tabs for Ethereum and Solana functionality
3. Click "Connect Wallet" in either tab
4. A new window should open at http://localhost:3001 showing the wallet interface
5. Approve the connection in the wallet window
6. The DApp should now show you're connected
7. Test the different functions:
   - Sign messages
   - Sign transactions
   - Sign and send transactions
   - For Solana: Sign multiple transactions

## Troubleshooting

### Popup Blocker Issues

If the wallet window doesn't open when clicking "Connect Wallet":

- Check your browser's popup blocker settings
- Look for a notification in the address bar indicating a blocked popup
- Try using a different browser

### Cross-Origin Issues

The demo uses cross-origin communication between the DApp and wallet. If you encounter issues:

- Make sure both servers are running
- Check the browser console for CORS-related errors
- Try using a browser in incognito/private mode
- Disable browser extensions that might interfere with postMessage communication

### Build Issues

If the SDK isn't loading in the DApp:

- Verify the build completed successfully: `npm run build`
- Check that `examples/demo-dapp/libs/index.umd.js` exists
- Look for any console errors in the browser

### Port Conflicts

If you get errors about ports already in use:

- Check if you have other services running on ports 3002 or 3001
- Modify the port in the npm scripts in package.json:
  ```json
  "serve:dapp": "http-server examples/demo-dapp -p 3002 -o /index.html",
  "serve:wallet": "http-server examples/demo-wallet -p 3001 -o /index.html"
  ```

## Browser Compatibility

The demo should work on:
- Chrome
- Firefox
- Safari
- Edge

For the best experience, use the latest version of your browser.

## Next Steps

After exploring the demo, you can:

1. Integrate the SDK into your own project
2. Customize the wallet UI for your needs
3. Add support for additional blockchain operations

For more advanced usage, refer to the main documentation and API reference.