// Demo wallet data
const MOCK_ACCOUNTS = {
    ethereum: {
        address: "0x1234567890123456789012345678901234567890",
        chainId: "0x1" // Ethereum Mainnet
    },
    solana: {
        publicKey: "GfEHGBwXDwL5RKmZFQKQx8F9MTiogi7XKD7pzYz3YTEu"
    }
};

let requestData = null;
let requestOrigin = null;
let currentNetwork = null;

// When the wallet is ready, send a READY message
window.addEventListener('DOMContentLoaded', () => {
    // Show welcome state by default
    document.getElementById('welcomeState').style.display = 'block';
    
    // Set mock wallet addresses
    document.getElementById('eth-walletAddress').textContent = MOCK_ACCOUNTS.ethereum.address;
    document.getElementById('sol-publicKey').textContent = MOCK_ACCOUNTS.solana.publicKey;
    
    // Send READY message to opener
    if (window.opener) {
        window.opener.postMessage({ type: "READY" }, "*");
    }
});

// Listen for messages from DApps
window.addEventListener('message', (event) => {
    const { data, origin } = event;
    requestData = data;
    requestOrigin = origin;
    
    console.log("Received message:", data);
    
    // Set current network based on the message
    currentNetwork = data.network;
    updateNetworkBadge();
    
    // Hide welcome state when processing a request
    document.getElementById('welcomeState').style.display = 'none';
    
    // Handle Ethereum requests
    if (data.network === 'ethereum') {
        if (data.type === "CONNECT_WALLET") {
            handleEthConnectRequest(data);
        } else if (data.type === "ETH_SIGN_TRANSACTION") {
            handleEthSignRequest(data, "Transaction Request", "This site wants you to sign a transaction");
        } else if (data.type === "ETH_SIGN_MESSAGE") {
            handleEthSignRequest(data, "Message Signing Request", "This site wants you to sign a message");
        }
    }
    // Handle Solana requests
    else if (data.network === 'solana') {
        if (data.type === "CONNECT_WALLET") {
            handleSolConnectRequest(data);
        } else if (data.type === "SOL_SIGN_TRANSACTION") {
            handleSolSignRequest(data, "Transaction Request", "This site wants you to sign a transaction");
        } else if (data.type === "SOL_SIGN_MESSAGE") {
            handleSolSignRequest(data, "Message Signing Request", "This site wants you to sign a message");
        } else if (data.type === "SOL_SIGN_ALL_TRANSACTIONS") {
            handleSolSignRequest(data, "Multiple Transactions Request", "This site wants you to sign multiple transactions");
        } else if (data.type === "SOL_SIGN_AND_SEND_TRANSACTION") {
            handleSolSignRequest(data, "Send Transaction Request", "This site wants you to sign and send a transaction");
        }
    }
});

// Update network badge based on current network
function updateNetworkBadge() {
    const badge = document.getElementById('network-badge');
    
    if (currentNetwork === 'ethereum') {
        badge.textContent = 'Ethereum';
        badge.className = 'network-badge ethereum';
    } else if (currentNetwork === 'solana') {
        badge.textContent = 'Solana';
        badge.className = 'network-badge solana';
    } else {
        badge.textContent = 'Unknown';
        badge.className = 'network-badge';
    }
}

// Handle Ethereum connect request
function handleEthConnectRequest(data) {
    // Hide all request panels first
    hideAllPanels();
    
    // Show Ethereum connect request panel
    document.getElementById('eth-connectRequest').style.display = 'block';
    
    // Display DApp information
    if (data.metadata) {
        document.getElementById('eth-dappName').textContent = data.metadata.title || "Unknown DApp";
        document.getElementById('eth-dappUrl').textContent = data.metadata.url || requestOrigin;
        
        if (data.metadata.icon) {
            document.getElementById('eth-dappLogo').src = data.metadata.icon;
            document.getElementById('eth-dappLogo').onerror = () => {
                document.getElementById('eth-dappLogo').src = "https://via.placeholder.com/40";
            };
        } else {
            document.getElementById('eth-dappLogo').src = "https://via.placeholder.com/40";
        }
    } else {
        document.getElementById('eth-dappName').textContent = "Unknown DApp";
        document.getElementById('eth-dappUrl').textContent = requestOrigin;
        document.getElementById('eth-dappLogo').src = "https://via.placeholder.com/40";
    }
}

// Handle Ethereum sign request
function handleEthSignRequest(data, title, description) {
    // Hide all request panels first
    hideAllPanels();
    
    // Show Ethereum sign request panel
    document.getElementById('eth-signRequest').style.display = 'block';
    
    document.getElementById('eth-signTitle').textContent = title;
    document.getElementById('eth-signDescription').textContent = description;
    
    // Display DApp information
    if (data.metadata) {
        document.getElementById('eth-signDappName').textContent = data.metadata.title || "Unknown DApp";
        document.getElementById('eth-signDappUrl').textContent = data.metadata.url || requestOrigin;
        
        if (data.metadata.icon) {
            document.getElementById('eth-signDappLogo').src = data.metadata.icon;
            document.getElementById('eth-signDappLogo').onerror = () => {
                document.getElementById('eth-signDappLogo').src = "https://via.placeholder.com/40";
            };
        } else {
            document.getElementById('eth-signDappLogo').src = "https://via.placeholder.com/40";
        }
    } else {
        document.getElementById('eth-signDappName').textContent = "Unknown DApp";
        document.getElementById('eth-signDappUrl').textContent = requestOrigin;
        document.getElementById('eth-signDappLogo').src = "https://via.placeholder.com/40";
    }
    
    // Display transaction or message details
    if (data.type === "ETH_SIGN_TRANSACTION") {
        document.getElementById('eth-transactionDetails').textContent = JSON.stringify(data.payload, null, 2);
    } else if (data.type === "ETH_SIGN_MESSAGE") {
        document.getElementById('eth-transactionDetails').textContent = data.payload.message;
    }
}

// Handle Solana connect request
function handleSolConnectRequest(data) {
    // Hide all request panels first
    hideAllPanels();
    
    // Show Solana connect request panel
    document.getElementById('sol-connectRequest').style.display = 'block';
    
    // Display DApp information
    if (data.metadata) {
        document.getElementById('sol-dappName').textContent = data.metadata.title || "Unknown DApp";
        document.getElementById('sol-dappUrl').textContent = data.metadata.url || requestOrigin;
        
        if (data.metadata.icon) {
            document.getElementById('sol-dappLogo').src = data.metadata.icon;
            document.getElementById('sol-dappLogo').onerror = () => {
                document.getElementById('sol-dappLogo').src = "https://via.placeholder.com/40";
            };
        } else {
            document.getElementById('sol-dappLogo').src = "https://via.placeholder.com/40";
        }
    } else {
        document.getElementById('sol-dappName').textContent = "Unknown DApp";
        document.getElementById('sol-dappUrl').textContent = requestOrigin;
        document.getElementById('sol-dappLogo').src = "https://via.placeholder.com/40";
    }
}

// Handle Solana sign request
function handleSolSignRequest(data, title, description) {
    // Hide all request panels first
    hideAllPanels();
    
    // Show Solana sign request panel
    document.getElementById('sol-signRequest').style.display = 'block';
    
    document.getElementById('sol-signTitle').textContent = title;
    document.getElementById('sol-signDescription').textContent = description;
    
    // Display DApp information
    if (data.metadata) {
        document.getElementById('sol-signDappName').textContent = data.metadata.title || "Unknown DApp";
        document.getElementById('sol-signDappUrl').textContent = data.metadata.url || requestOrigin;
        
        if (data.metadata.icon) {
            document.getElementById('sol-signDappLogo').src = data.metadata.icon;
            document.getElementById('sol-signDappLogo').onerror = () => {
                document.getElementById('sol-signDappLogo').src = "https://via.placeholder.com/40";
            };
        } else {
            document.getElementById('sol-signDappLogo').src = "https://via.placeholder.com/40";
        }
    } else {
        document.getElementById('sol-signDappName').textContent = "Unknown DApp";
        document.getElementById('sol-signDappUrl').textContent = requestOrigin;
        document.getElementById('sol-signDappLogo').src = "https://via.placeholder.com/40";
    }
    
    // Display transaction or message details
    let displayData = '';
    
    if (data.type === "SOL_SIGN_TRANSACTION") {
        displayData = JSON.stringify(data.payload.transaction, null, 2);
    } else if (data.type === "SOL_SIGN_ALL_TRANSACTIONS") {
        displayData = JSON.stringify(data.payload.transactions, null, 2);
    } else if (data.type === "SOL_SIGN_AND_SEND_TRANSACTION") {
        displayData = JSON.stringify(data.payload.transaction, null, 2);
    } else if (data.type === "SOL_SIGN_MESSAGE") {
        // Try to decode the base64 message
        try {
            const messageBytes = atob(data.payload.message);
            displayData = `Message (decoded): ${messageBytes}`;
        } catch (e) {
            displayData = `Message (base64): ${data.payload.message}`;
        }
    }
    
    document.getElementById('sol-transactionDetails').textContent = displayData;
}

// Hide all request panels
function hideAllPanels() {
    document.getElementById('eth-connectRequest').style.display = 'none';
    document.getElementById('eth-signRequest').style.display = 'none';
    document.getElementById('sol-connectRequest').style.display = 'none';
    document.getElementById('sol-signRequest').style.display = 'none';
    document.getElementById('welcomeState').style.display = 'none';
}

// Reset wallet to welcome state
function resetWallet() {
    hideAllPanels();
    document.getElementById('welcomeState').style.display = 'block';
    window.close(); // Close the popup when done
}

// Ethereum connect request buttons
document.getElementById('eth-approveConnectBtn').addEventListener('click', () => {
    const response = {
        type: "CONNECT_WALLET",
        network: "ethereum",
        payload: {
            success: true,
            message: "Successfully connected",
            result: {
                address: MOCK_ACCOUNTS.ethereum.address,
                chainId: MOCK_ACCOUNTS.ethereum.chainId
            }
        }
    };
    console.log("Sending approval response to:", requestOrigin, response);

    window.opener.postMessage(response, requestOrigin);
    console.log("Response sent, closing window");
    resetWallet();
});

document.getElementById('eth-rejectConnectBtn').addEventListener('click', () => {
    const response = {
        type: "CONNECT_WALLET",
        network: "ethereum",
        payload: {
            success: false,
            message: "User rejected the connection request",
            errorCode: 4001 // USER_REJECTED
        }
    };
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});

// Ethereum sign request buttons
document.getElementById('eth-approveSignBtn').addEventListener('click', () => {
    let response;
    
    if (requestData.type === "ETH_SIGN_TRANSACTION") {
        response = {
            type: "ETH_SIGN_TRANSACTION",
            network: "ethereum",
            payload: {
                success: true,
                message: "Transaction signed successfully",
                result: {
                    hash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                    signedTransaction: "0x" + Array(128).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                    from: requestData.payload.from,
                    to: requestData.payload.to,
                    value: requestData.payload.value
                }
            }
        };
    } else if (requestData.type === "ETH_SIGN_MESSAGE") {
        response = {
            type: "ETH_SIGN_MESSAGE",
            network: "ethereum",
            payload: {
                success: true,
                message: "Message signed successfully",
                result: {
                    signature: "0x" + Array(130).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
                }
            }
        };
    }
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});

document.getElementById('eth-rejectSignBtn').addEventListener('click', () => {
    const response = {
        type: requestData.type,
        network: "ethereum",
        payload: {
            success: false,
            message: "User rejected the request",
            errorCode: 4001 // USER_REJECTED
        }
    };
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});

// Solana connect request buttons
document.getElementById('sol-approveConnectBtn').addEventListener('click', () => {
    const response = {
        type: "CONNECT_WALLET",
        network: "solana",
        payload: {
            success: true,
            message: "Successfully connected",
            result: {
                publicKey: MOCK_ACCOUNTS.solana.publicKey
            }
        }
    };
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});

document.getElementById('sol-rejectConnectBtn').addEventListener('click', () => {
    const response = {
        type: "CONNECT_WALLET",
        network: "solana",
        payload: {
            success: false,
            message: "User rejected the connection request",
            errorCode: 4001 // USER_REJECTED
        }
    };
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});

// Solana sign request buttons
document.getElementById('sol-approveSignBtn').addEventListener('click', () => {
    let response;
    
    if (requestData.type === "SOL_SIGN_TRANSACTION") {
        response = {
            type: "SOL_SIGN_TRANSACTION",
            network: "solana",
            payload: {
                success: true,
                message: "Transaction signed successfully",
                result: {
                    signedTransaction: "signed-solana-transaction-" + Date.now()
                }
            }
        };
    } else if (requestData.type === "SOL_SIGN_ALL_TRANSACTIONS") {
        // Get the count of transactions to create the same number of responses
        const txCount = Array.isArray(requestData.payload.transactions) ? 
                         requestData.payload.transactions.length : 2;
        
        const signedTransactions = Array(txCount).fill(0).map((_, i) => 
            `signed-solana-transaction-${i}-${Date.now()}`
        );
        
        response = {
            type: "SOL_SIGN_ALL_TRANSACTIONS",
            network: "solana",
            payload: {
                success: true,
                message: "All transactions signed successfully",
                result: {
                    signedTransactions: signedTransactions
                }
            }
        };
    } else if (requestData.type === "SOL_SIGN_AND_SEND_TRANSACTION") {
        response = {
            type: "SOL_SIGN_AND_SEND_TRANSACTION",
            network: "solana",
            payload: {
                success: true,
                message: "Transaction signed and sent successfully",
                result: {
                    signature: "solana-signature-" + Date.now()
                }
            }
        };
    } else if (requestData.type === "SOL_SIGN_MESSAGE") {
        response = {
            type: "SOL_SIGN_MESSAGE",
            network: "solana",
            payload: {
                success: true,
                message: "Message signed successfully",
                result: {
                    signature: "solana-message-signature-" + Date.now()
                }
            }
        };
    }
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});

document.getElementById('sol-rejectSignBtn').addEventListener('click', () => {
    const response = {
        type: requestData.type,
        network: "solana",
        payload: {
            success: false,
            message: "User rejected the request",
            errorCode: 4001 // USER_REJECTED
        }
    };
    
    window.opener.postMessage(response, requestOrigin);
    resetWallet();
});