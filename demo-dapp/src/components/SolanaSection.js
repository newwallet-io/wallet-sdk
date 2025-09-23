// components/SolanaSection.js
import React, { useState } from 'react';
import { 
  Transaction, 
  SystemProgram, 
  PublicKey, 
  Connection,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';

function SolanaSection({ sdk, publicKey, onExecute, loading, environment }) {
  const [activeAction, setActiveAction] = useState('');
  const [formData, setFormData] = useState({
    message: 'Hello from Solana!',
    recipient: 'D4vVA53Eox5b7W4YmR27rfPhrdqHmRhDbVayMAMB8Ejq',
    amount: '0.001',
    txCount: 2
  });

  const actions = [
    { id: 'solana_signMessage', label: 'Sign Message' },
    { id: 'solana_signTransaction', label: 'Sign Transaction' },
    { id: 'solana_signAllTransactions', label: 'Sign All Transactions' },
    { id: 'solana_signAndSendTransaction', label: 'Sign & Send Transaction' }
  ];

  // Get RPC endpoint based on environment
  const getRpcEndpoint = () => {
    switch(environment) {
      case 'mainnet':
        return 'https://api.mainnet-beta.solana.com';
      case 'testnet':
        return 'https://api.testnet.solana.com';
      default:
        return 'https://api.testnet.solana.com';
    }
  };

  const createTransferTransaction = async (recipient, amountInSol) => {
    try {
      const connection = new Connection(getRpcEndpoint(), 'confirmed');
      
      // Convert SOL to lamports
      const lamports = Math.floor(parseFloat(amountInSol) * LAMPORTS_PER_SOL);
      
      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(publicKey),
          toPubkey: new PublicKey(recipient),
          lamports: lamports
        })
      );
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new PublicKey(publicKey);
      
      return transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  };

  const handleExecute = async () => {
    try {
      let params;
      
      switch(activeAction) {
        case 'solana_signMessage':
          // Pass message and publicKey as SDK expects
          // The SDK will handle the actual signing format
          params = formData.message;
          break;
          
        case 'solana_signTransaction':
          // Create actual Solana transaction
          const transaction = await createTransferTransaction(
            formData.recipient,
            formData.amount
          );
          params = transaction;
          break;
          
        case 'solana_signAndSendTransaction':
          // Create transaction for sign and send
          const txToSend = await createTransferTransaction(
            formData.recipient,
            formData.amount
          );
          params = {
            transaction: txToSend,
            sendOptions: {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            }
          };
          break;
          
        case 'solana_signAllTransactions':
          // Create multiple transactions
          const transactions = [];
          for (let i = 0; i < formData.txCount; i++) {
            const tx = await createTransferTransaction(
              formData.recipient,
              formData.amount
            );
            transactions.push(tx);
          }
          params = transactions;
          break;
          
        default:
          return;
      }
      
      await onExecute(activeAction, params);
    } catch (error) {
      console.error('Execution failed:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const renderInputs = () => {
    switch(activeAction) {
      case 'solana_signMessage':
        return (
          <div className="input-area">
            <div className="input-group">
              <label className="input-label">Message to Sign:</label>
              <textarea
                className="input-field"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Enter message to sign"
              />
            </div>
            <div className="input-note">
              Public key will be automatically included: {truncateAddress(publicKey)}
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              Sign Message
            </button>
          </div>
        );
        
      case 'solana_signTransaction':
      case 'solana_signAndSendTransaction':
        return (
          <div className="input-area">
            <div className="input-group">
              <label className="input-label">Recipient Address:</label>
              <input
                className="input-field"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder="Solana address"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Amount (SOL):</label>
              <input
                className="input-field"
                type="number"
                step="0.001"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.001"
              />
            </div>
            <div className="input-note">
              Network: {environment === 'mainnet' ? 'Mainnet' : environment === 'testnet' ? 'Testnet' : 'Localhost'}
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              {activeAction === 'solana_signTransaction' ? 'Sign Transaction' : 'Sign & Send Transaction'}
            </button>
          </div>
        );
        
      case 'solana_signAllTransactions':
        return (
          <div className="input-area">
            <div className="input-group">
              <label className="input-label">Number of Transactions:</label>
              <input
                className="input-field"
                type="number"
                min="2"
                max="5"
                value={formData.txCount}
                onChange={(e) => setFormData({...formData, txCount: parseInt(e.target.value) || 2})}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Recipient Address:</label>
              <input
                className="input-field"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder="Solana address"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Amount per Transaction (SOL):</label>
              <input
                className="input-field"
                type="number"
                step="0.001"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.001"
              />
            </div>
            <div className="input-note">
              Will create {formData.txCount} transactions of {formData.amount} SOL each
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              Sign All Transactions
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="section">
      <h2 className="section-title">☀️ Solana</h2>
      
      <div className="chain-section">
        <div className="solana-info">
          <span className="info-label">Public Key:</span>
          <span className="account-address">{truncateAddress(publicKey)}</span>
          <button
            className="btn btn-small btn-secondary"
            onClick={() => navigator.clipboard.writeText(publicKey)}
            title="Copy full address"
          >
            Copy
          </button>
        </div>

        <div className="action-buttons">
          {actions.map(action => (
            <button
              key={action.id}
              className={`action-button ${activeAction === action.id ? 'active' : ''}`}
              onClick={() => setActiveAction(action.id)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>

        {activeAction && renderInputs()}
      </div>
    </div>
  );
}

export default SolanaSection;