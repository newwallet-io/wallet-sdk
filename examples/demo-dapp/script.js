// Demo DApp using NewWallet SDK

console.log('SDK available as:', typeof window.NewWallet);

// Check different ways the SDK might be exported
let WalletClass;
if (typeof window.NewWallet === 'function') {
    // Direct constructor function
    WalletClass = window.NewWallet;
} else if (window.NewWallet && typeof window.NewWallet.default === 'function') {
    // ES module default export
    WalletClass = window.NewWallet.default;
} else if (window.NewWallet && window.NewWallet.__esModule) {
    // Try to find the default export in an ES module
    WalletClass = window.NewWallet.default || Object.values(window.NewWallet)[0];
} else {
    console.error('Could not find NewWallet constructor. Check the console for available exports:', window.NewWallet);
}

// Initialize NewWallet
// Note: The path to the wallet should match your local development setup
let wallet;
try {
    wallet = new WalletClass({
        walletUrl: 'http://localhost:3001'
    });
    console.log('Wallet instance created:', wallet);
} catch (error) {
    console.error('Error creating wallet instance:', error);
    document.body.innerHTML = '<div class="container"><h1>Error</h1><p>Failed to initialize NewWallet SDK. See console for details.</p></div>';
}

// Check if the SDK is loaded properly
if (!wallet) {
    console.error('NewWallet SDK failed to load.');
    document.body.innerHTML = '<div class="container"><h1>Error</h1><p>Failed to load NewWallet SDK. Make sure you have built the SDK and are running the demo correctly.</p></div>';
}

window.addEventListener('message', (event) => {
    console.log("DApp received message:", event.data, "from origin:", event.origin);
    // Check if it's a connection response
    if (event.data.type === "CONNECT_WALLET" && event.data.network === "ethereum") {
        console.log("Received wallet connection response:", event.data);
    }
});

// Tab functionality
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        // Remove active class from all buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab content and mark button as active
        const tabId = button.getAttribute('data-tab');
        document.getElementById(`${tabId}-tab`).style.display = 'block';
        button.classList.add('active');
    });
});

// ********** ETHEREUM FUNCTIONALITY **********

// DOM Elements for Ethereum
const ethConnectBtn = document.getElementById('eth-connectBtn');
const ethDisconnectBtn = document.getElementById('eth-disconnectBtn');
const ethSendBtn = document.getElementById('eth-sendBtn');
const ethSignBtn = document.getElementById('eth-signBtn');
const ethToAddressInput = document.getElementById('eth-toAddress');
const ethAmountInput = document.getElementById('eth-amount');
const ethMessageInput = document.getElementById('eth-message');
const ethConnectionStatus = document.getElementById('eth-connectionStatus');
const ethAccountAddress = document.getElementById('eth-accountAddress');
const ethNetworkInfo = document.getElementById('eth-networkInfo');
const ethTxStatus = document.getElementById('eth-txStatus');
const ethSignatureResult = document.getElementById('eth-signatureResult');
const ethTransactionHistory = document.getElementById('eth-transactionHistory');

// App State for Ethereum
let ethCurrentAccount = null;
let ethTransactions = [];

// Event Listeners for Ethereum
ethConnectBtn.addEventListener('click', connectEthWallet);
ethDisconnectBtn.addEventListener('click', disconnectEthWallet);
ethSendBtn.addEventListener('click', sendEthTransaction);
ethSignBtn.addEventListener('click', signEthMessage);

// Connect to Ethereum wallet
async function connectEthWallet() {
    try {
        ethConnectionStatus.textContent = 'Connecting...';
        ethConnectionStatus.className = 'status';
        
        const accounts = await wallet.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        handleEthAccountsChanged(accounts);
        
        ethConnectionStatus.textContent = 'Connected!';
        ethConnectionStatus.className = 'status success';
    } catch (error) {
        console.error('Connection error:', error);
        ethConnectionStatus.textContent = `Connection failed: ${error.message}`;
        ethConnectionStatus.className = 'status error';
    }
}

// Disconnect from Ethereum wallet
function disconnectEthWallet() {
    ethCurrentAccount = null;
    ethAccountAddress.textContent = 'Not connected';
    ethNetworkInfo.textContent = 'Unknown';
    ethConnectionStatus.textContent = 'Disconnected';
    ethConnectionStatus.className = 'status';
    
    ethConnectBtn.disabled = false;
    ethDisconnectBtn.disabled = true;
    ethSendBtn.disabled = true;
    ethSignBtn.disabled = true;
}

// Handle Ethereum accounts changed
function handleEthAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectEthWallet();
        return;
    }
    
    ethCurrentAccount = accounts[0];
    ethAccountAddress.textContent = ethCurrentAccount;
    
    ethConnectBtn.disabled = true;
    ethDisconnectBtn.disabled = false;
    ethSendBtn.disabled = false;
    ethSignBtn.disabled = false;
    
    // Get the current chain ID
    getEthChainId();
}

// Handle Ethereum chain changed
function handleEthChainChanged(chainId) {
    ethNetworkInfo.textContent = getEthNetworkName(chainId);
}

// Get current Ethereum chain ID
async function getEthChainId() {
    try {
        const chainId = await wallet.ethereum.request({ method: 'eth_chainId' });
        ethNetworkInfo.textContent = getEthNetworkName(chainId);
    } catch (error) {
        console.error('Error getting chain ID:', error);
        ethNetworkInfo.textContent = 'Unknown';
    }
}

// Convert Ethereum chain ID to network name
function getEthNetworkName(chainId) {
    switch (chainId) {
        case '0x1':
            return 'Ethereum Mainnet';
        case '0x3':
            return 'Ropsten Testnet';
        case '0x4':
            return 'Rinkeby Testnet';
        case '0x5':
            return 'Goerli Testnet';
        case '0x2a':
            return 'Kovan Testnet';
        case '0x89':
            return 'Polygon Mainnet';
        case '0x13881':
            return 'Polygon Mumbai';
        default:
            return `Unknown (${chainId})`;
    }
}

// Sign Ethereum message
async function signEthMessage() {
    if (!ethCurrentAccount) {
        alert('Please connect your wallet first');
        return;
    }
    
    const message = ethMessageInput.value.trim();
    
    if (!message) {
        alert('Please enter a message to sign');
        return;
    }
    
    ethSignatureResult.textContent = 'Signing message...';
    ethSignatureResult.className = 'status';
    
    try {
        const signature = await wallet.ethereum.request({
            method: 'personal_sign',
            params: [message, ethCurrentAccount]
        });
        
        ethSignatureResult.textContent = `Signature: ${signature}`;
        ethSignatureResult.className = 'status success';
    } catch (error) {
        console.error('Signing error:', error);
        ethSignatureResult.textContent = `Signing failed: ${error.message}`;
        ethSignatureResult.className = 'status error';
    }
}

// Send Ethereum transaction
async function sendEthTransaction() {
    if (!ethCurrentAccount) {
        alert('Please connect your wallet first');
        return;
    }
    
    const toAddress = ethToAddressInput.value.trim();
    const amount = ethAmountInput.value.trim();
    
    if (!toAddress || !amount) {
        alert('Please enter a valid destination address and amount');
        return;
    }
    
    // Convert ETH to Wei (1 ETH = 10^18 Wei)
    const weiAmount = BigInt(parseFloat(amount) * 1e18).toString(16);
    const weiHex = '0x' + weiAmount;
    
    ethTxStatus.textContent = 'Sending transaction...';
    ethTxStatus.className = 'status';
    
    try {
        const txHash = await wallet.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: ethCurrentAccount,
                to: toAddress,
                value: weiHex,
                gas: '0x5208', // 21000 gas
            }]
        });
        
        ethTxStatus.textContent = `Transaction sent: ${txHash}`;
        ethTxStatus.className = 'status success';
        
        // Add to transaction history
        addEthTransactionToHistory(txHash, toAddress, amount);
    } catch (error) {
        console.error('Transaction error:', error);
        ethTxStatus.textContent = `Transaction failed: ${error.message}`;
        ethTxStatus.className = 'status error';
    }
}

// Function to add Ethereum transaction to history
function addEthTransactionToHistory(txHash, toAddress, amount) {
    const transaction = {
        hash: txHash,
        to: toAddress,
        amount: amount,
        timestamp: new Date().toLocaleString()
    };
    
    ethTransactions.unshift(transaction);  // Add to beginning of array
    updateEthTransactionHistory();
}

// Update Ethereum transaction history UI
function updateEthTransactionHistory() {
    if (ethTransactions.length === 0) {
        ethTransactionHistory.textContent = 'No transactions yet';
        return;
    }
    
    ethTransactionHistory.innerHTML = '';
    
    ethTransactions.forEach(tx => {
        const txElement = document.createElement('div');
        txElement.className = 'transaction-item';
        txElement.innerHTML = `
            <div><strong>Hash:</strong> <span class="transaction-hash">${tx.hash}</span></div>
            <div><strong>To:</strong> ${tx.to}</div>
            <div><strong>Amount:</strong> ${tx.amount} ETH</div>
            <div><strong>Time:</strong> ${tx.timestamp}</div>
        `;
        ethTransactionHistory.appendChild(txElement);
    });
}

// Listen for Ethereum account changes
wallet.ethereum.on('accountsChanged', handleEthAccountsChanged);
wallet.ethereum.on('chainChanged', handleEthChainChanged);


// ********** SOLANA FUNCTIONALITY **********

// DOM Elements for Solana
const solConnectBtn = document.getElementById('sol-connectBtn');
const solDisconnectBtn = document.getElementById('sol-disconnectBtn');
const solSignTxBtn = document.getElementById('sol-signTxBtn');
const solSignAllTxBtn = document.getElementById('sol-signAllTxBtn');
const solSignTxResult = document.getElementById('sol-signTxResult');
const solSignAllTxResult = document.getElementById('sol-signAllTxResult');
const solTxCount = document.getElementById('sol-txCount');
const solSendBtn = document.getElementById('sol-sendBtn');
const solSignBtn = document.getElementById('sol-signBtn');
const solToAddressInput = document.getElementById('sol-toAddress');
const solAmountInput = document.getElementById('sol-amount');
const solMessageInput = document.getElementById('sol-message');
const solConnectionStatus = document.getElementById('sol-connectionStatus');
const solPublicKey = document.getElementById('sol-publicKey');
const solTxStatus = document.getElementById('sol-txStatus');
const solSignatureResult = document.getElementById('sol-signatureResult');
const solTransactionHistory = document.getElementById('sol-transactionHistory');

// App State for Solana
let solTransactions = [];

// Event Listeners for Solana
solConnectBtn.addEventListener('click', connectSolWallet);
solDisconnectBtn.addEventListener('click', disconnectSolWallet);
solSendBtn.addEventListener('click', sendSolTransaction);
solSignBtn.addEventListener('click', signSolMessage);
solSignTxBtn.addEventListener('click', signSolTransaction);
solSignAllTxBtn.addEventListener('click', signAllSolTransactions);

// Connect to Solana wallet
async function connectSolWallet() {
    try {
        solConnectionStatus.textContent = 'Connecting...';
        solConnectionStatus.className = 'status';
        
        const publicKey = await wallet.solana.connect();
        
        handleSolConnect(publicKey);
        
        solConnectionStatus.textContent = 'Connected!';
        solConnectionStatus.className = 'status success';
    } catch (error) {
        console.error('Connection error:', error);
        solConnectionStatus.textContent = `Connection failed: ${error.message}`;
        solConnectionStatus.className = 'status error';
    }
}

// Disconnect from Solana wallet
async function disconnectSolWallet() {
    try {
        await wallet.solana.disconnect();
        
        solPublicKey.textContent = 'Not connected';
        solConnectionStatus.textContent = 'Disconnected';
        solConnectionStatus.className = 'status';
        
        solConnectBtn.disabled = false;
        solDisconnectBtn.disabled = true;
        solSendBtn.disabled = true;
        solSignBtn.disabled = true;
        solSignTxBtn.disabled = true;
        solSignAllTxBtn.disabled = true;

    } catch (error) {
        console.error('Disconnection error:', error);
        solConnectionStatus.textContent = `Disconnection failed: ${error.message}`;
        solConnectionStatus.className = 'status error';
    }
}

// Handle Solana connection
function handleSolConnect(publicKey) {
    solPublicKey.textContent = publicKey;
    
    solConnectBtn.disabled = true;
    solDisconnectBtn.disabled = false;
    solSendBtn.disabled = false;
    solSignBtn.disabled = false;
    solSignTxBtn.disabled = false;
    solSignAllTxBtn.disabled = false;
}

// Sign Solana message
async function signSolMessage() {
    if (!wallet.solana.isConnected()) {
        alert('Please connect your wallet first');
        return;
    }
    
    const message = solMessageInput.value.trim();
    
    if (!message) {
        alert('Please enter a message to sign');
        return;
    }
    
    solSignatureResult.textContent = 'Signing message...';
    solSignatureResult.className = 'status';
    
    try {
        // Convert the message to Uint8Array
        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(message);
        
        const signature = await wallet.solana.signMessage(messageBytes);
        
        solSignatureResult.textContent = `Signature: ${signature}`;
        solSignatureResult.className = 'status success';
    } catch (error) {
        console.error('Signing error:', error);
        solSignatureResult.textContent = `Signing failed: ${error.message}`;
        solSignatureResult.className = 'status error';
    }
}

// Send Solana transaction
async function sendSolTransaction() {
    if (!wallet.solana.isConnected()) {
        alert('Please connect your wallet first');
        return;
    }
    
    const toAddress = solToAddressInput.value.trim();
    const amount = solAmountInput.value.trim();
    
    if (!toAddress || !amount) {
        alert('Please enter a valid destination address and amount');
        return;
    }
    
    solTxStatus.textContent = 'Preparing transaction...';
    solTxStatus.className = 'status';
    
    try {
        // This is a simplified mock transaction - in a real app, you'd properly 
        // create a Solana transaction using the web3.js library
        const mockTransaction = {
            feePayer: wallet.solana.getPublicKey(),
            recentBlockhash: 'simulated-blockhash',
            instructions: [
                {
                    programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                    keys: [
                        { pubkey: wallet.solana.getPublicKey(), isSigner: true, isWritable: true },
                        { pubkey: toAddress, isSigner: false, isWritable: true }
                    ],
                    data: new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0])  // Simplified transfer instruction
                }
            ]
        };
        
        solTxStatus.textContent = 'Sending transaction...';
        
        const signature = await wallet.solana.signAndSendTransaction(mockTransaction);
        
        solTxStatus.textContent = `Transaction sent: ${signature}`;
        solTxStatus.className = 'status success';
        
        // Add to transaction history
        addSolTransactionToHistory(signature, toAddress, amount);
    } catch (error) {
        console.error('Transaction error:', error);
        solTxStatus.textContent = `Transaction failed: ${error.message}`;
        solTxStatus.className = 'status error';
    }
}

function createMockSolanaTransaction(toAddress, amount) {
    // This is a simplified mock - in real usage you'd use @solana/web3.js
    return {
        feePayer: wallet.solana.getPublicKey(),
        recentBlockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
        instructions: [
            {
                programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                keys: [
                    { pubkey: wallet.solana.getPublicKey(), isSigner: true, isWritable: true },
                    { pubkey: toAddress, isSigner: false, isWritable: true }
                ],
                data: new Uint8Array([2, 0, 0, 0, 0, 0, 0, 0, 0]) // Simplified transfer instruction
            }
        ]
    };
}

function truncateMiddle(str, maxLength) {
    if (str.length <= maxLength) return str;
    const halfLength = Math.floor(maxLength / 2);
    return str.substring(0, halfLength) + '...' + str.substring(str.length - halfLength);
}

// Sign a single Solana transaction (without sending)
async function signSolTransaction() {
    if (!wallet.solana.isConnected()) {
        alert('Please connect your wallet first');
        return;
    }
    
    const toAddress = solToAddressInput.value.trim();
    const amount = solAmountInput.value.trim();
    if (!toAddress) {
        alert('Please enter a valid destination address');
        return;
    }
    
    solSignTxResult.textContent = 'Signing transaction...';
    solSignTxResult.className = 'status';
    
    try {
        // Create a simplified mock transaction
        const mockTransaction = createMockSolanaTransaction(toAddress, amount);
        
        // Sign the transaction
        const signedTx = await wallet.solana.signTransaction(mockTransaction);
        
        solSignTxResult.textContent = `Transaction signed: ${truncateMiddle(signedTx, 20)}`;
        solSignTxResult.className = 'status success';
    } catch (error) {
        console.error('Signing error:', error);
        solSignTxResult.textContent = `Signing failed: ${error.message}`;
        solSignTxResult.className = 'status error';
    }
}

async function signAllSolTransactions() {
    if (!wallet.solana.isConnected()) {
        alert('Please connect your wallet first');
        return;
    }
    
    const count = parseInt(solTxCount.value);
    if (isNaN(count) || count < 1) {
        alert('Please enter a valid number of transactions');
        return;
    }
    
    solSignAllTxResult.textContent = `Signing ${count} transactions...`;
    solSignAllTxResult.className = 'status';
    
    try {
        // Create multiple mock transactions
        const mockTransactions = [];
        for (let i = 0; i < count; i++) {
            mockTransactions.push(createMockSolanaTransaction(
                'GfEHGBwXDwL5RKmZFQKQx8F9MTiogi7XKD7pzYz3YTEu', 
                (0.001 * (i + 1)).toString()
            ));
        }
        
        // Sign all transactions
        const signedTxs = await wallet.solana.signAllTransactions(mockTransactions);
        
        solSignAllTxResult.textContent = `${count} transactions signed successfully`;
        solSignAllTxResult.className = 'status success';
        
        // Display transaction details
        const details = document.createElement('div');
        details.className = 'transaction-details';
        signedTxs.forEach((tx, i) => {
            const txElement = document.createElement('div');
            txElement.textContent = `Transaction \${i+1}: ${truncateMiddle(tx, 15)}`;
            details.appendChild(txElement);
        });
        
        solSignAllTxResult.appendChild(details);
    } catch (error) {
        console.error('Signing error:', error);
        solSignAllTxResult.textContent = `Signing failed: ${error.message}`;
        solSignAllTxResult.className = 'status error';
    }
}

// Function to add Solana transaction to history
function addSolTransactionToHistory(signature, toAddress, amount) {
    const transaction = {
        signature: signature,
        to: toAddress,
        amount: amount,
        timestamp: new Date().toLocaleString()
    };
    
    solTransactions.unshift(transaction);  // Add to beginning of array
    updateSolTransactionHistory();
}

// Update Solana transaction history UI
function updateSolTransactionHistory() {
    if (solTransactions.length === 0) {
        solTransactionHistory.textContent = 'No transactions yet';
        return;
    }
    
    solTransactionHistory.innerHTML = '';
    
    solTransactions.forEach(tx => {
        const txElement = document.createElement('div');
        txElement.className = 'transaction-item';
        txElement.innerHTML = `
            <div><strong>Signature:</strong> <span class="transaction-hash">${tx.signature}</span></div>
            <div><strong>To:</strong> ${tx.to}</div>
            <div><strong>Amount:</strong> ${tx.amount} SOL</div>
            <div><strong>Time:</strong> ${tx.timestamp}</div>
        `;
        solTransactionHistory.appendChild(txElement);
    });
}

// Listen for Solana connection events
wallet.solana.on('connect', handleSolConnect);
wallet.solana.on('disconnect', disconnectSolWallet);