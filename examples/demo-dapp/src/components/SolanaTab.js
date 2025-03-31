import React, { useState, useEffect } from 'react';
import './TabStyles.css';
import StatusMessage from './StatusMessage';
import TransactionItem from './TransactionItem';
import { Connection, SystemProgram, Transaction, PublicKey, VersionedTransaction, TransactionMessage } from '@solana/web3.js';

const SolanaTab = ({ wallet }) => {
  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [toAddress, setToAddress] = useState('CR1GHp2xaKcxoRoQ8Xye2W1p4CZL5SHZ8p4oPhfJszFb');
  const [amount, setAmount] = useState('0.001');
  const [message, setMessage] = useState('Hello, Solana!');
  const [txCount, setTxCount] = useState(2);
  const [transactions, setTransactions] = useState([]);
  
  // Status messages
  const [connectionStatus, setConnectionStatus] = useState({ message: '', className: '' });
  const [txStatus, setTxStatus] = useState({ message: '', className: '' });
  const [signatureStatus, setSignatureStatus] = useState({ message: '', className: '' });
  const [legacyTxStatus, setLegacyTxStatus] = useState({ message: '', className: '' });
  const [versionedTxStatus, setVersionedTxStatus] = useState({ message: '', className: '' });
  const [signAllTxStatus, setSignAllTxStatus] = useState({ message: '', className: '' });
  
  useEffect(() => {
    if (wallet && wallet.solana) {
      // Set up event listeners
      wallet.solana.on('connect', handleConnect);
      wallet.solana.on('disconnect', handleDisconnect);
      
      // Check if already connected
      if (wallet.solana.isConnected()) {
        setConnected(true);
        setPublicKey(wallet.solana.getPublicKey());
      }
    }
    
    return () => {
      if (wallet && wallet.solana) {
        wallet.solana.off('connect', handleConnect);
        wallet.solana.off('disconnect', handleDisconnect);
      }
    };
  }, [wallet]);

  const handleConnect = (pubKey) => {
    console.log('Connected with public key:', pubKey);
    setConnected(true);
    setPublicKey(pubKey);
  };

  const handleDisconnect = () => {
    console.log('Disconnected from wallet');
    setConnected(false);
    setPublicKey(null);
  };

  const connectWallet = async () => {
    try {
      setConnectionStatus({ message: 'Connecting...', className: '' });
      
      const pubKey = await wallet.solana.connect();
      
      setConnectionStatus({ message: 'Connected!', className: 'success' });
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus({ 
        message: `Connection failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  const disconnectWallet = async () => {
    try {
      await wallet.solana.disconnect();
      
      setConnectionStatus({ message: 'Disconnected', className: '' });
    } catch (error) {
      console.error('Disconnection error:', error);
      setConnectionStatus({ 
        message: `Disconnection failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  // Helper function to truncate strings for display
  const truncateMiddle = (str, maxLength = 16) => {
    if (!str || str.length <= maxLength) return str;
    const halfLength = Math.floor(maxLength / 2);
    return str.substring(0, halfLength) + '...' + str.substring(str.length - halfLength);
  };

  // Create a legacy transaction
  const createLegacyTransaction = (fromPublicKey, toAddress, amount) => {
    if (!fromPublicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert string publicKey to PublicKey objects
      const fromPubkey = new PublicKey(fromPublicKey);
      const toPubkey = new PublicKey(toAddress);
      
      // Convert SOL to lamports (1 SOL = 10^9 lamports)
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      
      // Create a new transaction
      const transaction = new Transaction();
      
      // Add a dummy blockhash
      transaction.recentBlockhash = 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k';
      
      // Set the fee payer
      transaction.feePayer = fromPubkey;
      
      // Add a transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports
        })
      );
      
      return transaction;
    } catch (error) {
      console.error('Error creating legacy transaction:', error);
      throw error;
    }
  };

  // Create a versioned transaction
  const createVersionedTransaction = (fromPublicKey, toAddress, amount) => {
    if (!fromPublicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert string publicKey to PublicKey objects
      const fromPubkey = new PublicKey(fromPublicKey);
      const toPubkey = new PublicKey(toAddress);
      
      // Convert SOL to lamports (1 SOL = 10^9 lamports)
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      
      // Create a transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports
      });
      
      // Create a transaction message
      const messageV0 = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
        instructions: [transferInstruction]
      }).compileToV0Message();
      
      // Create a versioned transaction
      const transaction = new VersionedTransaction(messageV0);
      
      return transaction;
    } catch (error) {
      console.error('Error creating versioned transaction:', error);
      throw error;
    }
  };

  // Sign a legacy transaction
  const signLegacyTransaction = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setLegacyTxStatus({ message: 'Creating legacy transaction...', className: '' });
      
      // Create a legacy transaction
      const transaction = createLegacyTransaction(publicKey, toAddress, amount);
      console.log('Legacy transaction created:', transaction);
      
      setLegacyTxStatus({ message: 'Signing legacy transaction...', className: '' });
      
      // Sign the transaction
      const signedTx = await wallet.solana.signTransaction(transaction);
      
      console.log('Signed legacy transaction:', signedTx);
       // Display the transaction details
      setLegacyTxStatus({ 
        message: `Legacy transaction signed successfully!`, 
        className: 'success',
        details: `Transaction has ${signedTx.signatures.length} signature(s)`
      });
    } catch (error) {
      console.error('Legacy transaction signing error:', error);
      setLegacyTxStatus({ 
        message: `Legacy transaction signing failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  // Sign a versioned transaction
  const signVersionedTransaction = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setVersionedTxStatus({ message: 'Creating versioned transaction...', className: '' });
      
      // Create a versioned transaction
      const transaction = createVersionedTransaction(publicKey, toAddress, amount);
      console.log('Versioned transaction created:', transaction);
      
      setVersionedTxStatus({ message: 'Signing versioned transaction...', className: '' });
      
      // Sign the transaction
      const signedTx = await wallet.solana.signTransaction(transaction);
      
      console.log('Signed versioned transaction:', signedTx);
      // Display the transaction details
      setVersionedTxStatus({ 
        message: `Versioned transaction signed successfully!`, 
        className: 'success',
        details: `Transaction version: ${signedTx.version}, with ${signedTx.signatures ? signedTx.signatures.length : 0} signature(s)`
      });
    } catch (error) {
      console.error('Versioned transaction signing error:', error);
      setVersionedTxStatus({ 
        message: `Versioned transaction signing failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  // Sign multiple transactions (mix of legacy and versioned)
  const signAllTransactions = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setSignAllTxStatus({ message: `Preparing ${txCount} transactions...`, className: '' });
      
      // Create a mix of legacy and versioned transactions
      const transactions = [];
      for (let i = 0; i < txCount; i++) {
        const amount = (0.001 * (i + 1)).toString();
        // Alternate between legacy and versioned transactions
        if (i % 2 === 0) {
          transactions.push(createLegacyTransaction(
            publicKey, 
            'CR1GHp2xaKcxoRoQ8Xye2W1p4CZL5SHZ8p4oPhfJszFb', 
            amount
          ));
        } else {
          transactions.push(createVersionedTransaction(
            publicKey, 
            'CR1GHp2xaKcxoRoQ8Xye2W1p4CZL5SHZ8p4oPhfJszFb', 
            amount
          ));
        }
      }
      
      console.log('Multiple transactions created:', transactions);
      
      setSignAllTxStatus({ message: `Signing ${txCount} transactions...`, className: '' });
      
      // Sign all transactions
      const signedTxs = await wallet.solana.signAllTransactions(transactions);
      console.log('Signed transactions:', signedTxs);
      
      // signedTxs will be an array of Transaction and VersionedTransaction objects
      // Create transaction details HTML
      const txDetails = signedTxs.map((tx, i) => {
        const txType = tx.version !== undefined ? 'Versioned' : 'Legacy';
        const sigCount = tx.signatures ? tx.signatures.length : 'unknown';
        return `Transaction ${i+1}: ${txType} Transaction with ${sigCount} signature(s)`;
      }).join('<br/>');
      
      setSignAllTxStatus({ 
        message: `${txCount} transactions signed successfully`, 
        className: 'success',
        details: txDetails
      });
    } catch (error) {
      console.error('Signing error:', error);
      setSignAllTxStatus({ 
        message: `Signing failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  // Send transaction
  const sendTransaction = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setTxStatus({ message: 'Preparing transaction...', className: '' });
      
      // Create a legacy transaction to send
      const transaction = createLegacyTransaction(publicKey, toAddress, amount);
      console.log('Transaction for sending:', transaction);
      
      setTxStatus({ message: 'Sending transaction...', className: '' });
      
      const signature = await wallet.solana.signAndSendTransaction(transaction);
      console.log('Transaction sent with signature:', signature);
      
      setTxStatus({ message: `Transaction sent: ${signature}`, className: 'success' });
      
      // Add to transaction history
      addTransactionToHistory(signature, toAddress, amount);
    } catch (error) {
      console.error('Transaction error:', error);
      setTxStatus({ 
        message: `Transaction failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  // Sign message
  const signMessage = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setSignatureStatus({ message: 'Signing message...', className: '' });
      
      // Convert the message to Uint8Array
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      console.log('Message bytes:', messageBytes);
      
      const signature = await wallet.solana.signMessage(messageBytes);
      console.log('Message signature:', signature);
      
      setSignatureStatus({ 
        message: `Signature: ${signature}`, 
        className: 'success' 
      });
    } catch (error) {
      console.error('Signing error:', error);
      setSignatureStatus({ 
        message: `Signing failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  // Add transaction to history
  const addTransactionToHistory = (signature, to, amount) => {
    const transaction = {
      signature,
      to,
      amount,
      timestamp: new Date().toLocaleString()
    };
    
    setTransactions(prevTransactions => [transaction, ...prevTransactions]);
  };

  return (
    <div className="solana-tab">
      <div className="card">
        <h2>Wallet Connection</h2>
        <StatusMessage {...connectionStatus} />
        <div className="button-container">
          <button 
            onClick={connectWallet} 
            disabled={connected}
            className="connect-btn"
          >
            Connect Wallet
          </button>
          <button 
            onClick={disconnectWallet} 
            disabled={!connected}
            className="disconnect-btn"
          >
            Disconnect
          </button>
        </div>
      </div>
      
      <div className="card">
        <h2>Account Information</h2>
        <div className="account-info">
          <div><strong>Public Key:</strong> <span className="address">{publicKey || 'Not connected'}</span></div>
        </div>
      </div>
      
      <div className="card">
        <h2>Sign Message</h2>
        <div className="form-group">
          <label htmlFor="sol-message">Message:</label>
          <textarea 
            id="sol-message" 
            value={message} 
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <button 
          onClick={signMessage} 
          disabled={!connected}
          className="sign-btn"
        >
          Sign Message
        </button>
        <StatusMessage {...signatureStatus} />
      </div>

      <div className="card">
        <h2>Sign Legacy Transaction</h2>
        <div className="form-group">
          <label htmlFor="sol-legacy-toAddress">To Address:</label>
          <input 
            type="text" 
            id="sol-legacy-toAddress" 
            value={toAddress} 
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sol-legacy-amount">Amount (SOL):</label>
          <input 
            type="number" 
            id="sol-legacy-amount" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            step="0.001" 
            min="0"
          />
        </div>
        <button 
          onClick={signLegacyTransaction} 
          disabled={!connected}
          className="sign-tx-btn"
        >
          Sign Legacy Transaction
        </button>
        <StatusMessage {...legacyTxStatus} />
      </div>

      <div className="card">
        <h2>Sign Versioned Transaction</h2>
        <div className="form-group">
          <label htmlFor="sol-versioned-toAddress">To Address:</label>
          <input 
            type="text" 
            id="sol-versioned-toAddress" 
            value={toAddress} 
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sol-versioned-amount">Amount (SOL):</label>
          <input 
            type="number" 
            id="sol-versioned-amount" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            step="0.001" 
            min="0"
          />
        </div>
        <button 
          onClick={signVersionedTransaction} 
          disabled={!connected}
          className="sign-tx-btn"
        >
          Sign Versioned Transaction
        </button>
        <StatusMessage {...versionedTxStatus} />
      </div>

      <div className="card">
        <h2>Sign Multiple Transactions</h2>
        <div className="form-group">
          <label htmlFor="sol-txCount">Number of Transactions:</label>
          <input 
            type="number" 
            id="sol-txCount" 
            value={txCount} 
            onChange={(e) => setTxCount(parseInt(e.target.value))} 
            min="1" 
            max="5"
          />
        </div>
        <button 
          onClick={signAllTransactions} 
          disabled={!connected}
          className="sign-all-btn"
        >
          Sign All Transactions
        </button>
        <StatusMessage {...signAllTxStatus} />
      </div>
      
      <div className="card">
        <h2>Sign & Send Transaction</h2>
        <div className="form-group">
          <label htmlFor="sol-toAddress-send">To Address:</label>
          <input 
            type="text" 
            id="sol-toAddress-send" 
            value={toAddress} 
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="sol-amount-send">Amount (SOL):</label>
          <input 
            type="number" 
            id="sol-amount-send" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            step="0.001" 
            min="0"
          />
        </div>
        <button 
          onClick={sendTransaction} 
          disabled={!connected}
          className="send-btn"
        >
          Sign & Send Transaction
        </button>
        <StatusMessage {...txStatus} />
      </div>
      
      <div className="card">
        <h2>Transaction History</h2>
        <div className="transaction-history">
          {transactions.length === 0 ? (
            <p>No transactions yet</p>
          ) : (
            transactions.map((tx, index) => (
              <TransactionItem 
                key={index} 
                transaction={tx} 
                network="solana" 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SolanaTab;