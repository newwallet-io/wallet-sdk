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
    { id: 'solana_signMessage', label: 'Sign Message', icon: '✍️' },
    { id: 'solana_signTransaction', label: 'Sign Transaction', icon: '📝' },
    { id: 'solana_signAllTransactions', label: 'Sign All Transactions', icon: '📚' },
    { id: 'solana_signAndSendTransaction', label: 'Sign & Send Transaction', icon: '🚀' }
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
          <div className="bg-black/20 rounded-xl p-6 mt-4 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Message to Sign:
              </label>
              <textarea
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Enter message to sign"
                rows={3}
              />
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
              <p className="text-cyan-300 text-sm">
                Public key will be automatically included: 
                <code className="ml-2 text-cyan-400 font-mono">{truncateAddress(publicKey)}</code>
              </p>
            </div>
            <button 
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
              Sign Message
            </button>
          </div>
        );
        
      case 'solana_signTransaction':
      case 'solana_signAndSendTransaction':
        return (
          <div className="bg-black/20 rounded-xl p-6 mt-4 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Recipient Address:</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder="Solana address"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Amount (SOL):</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="number"
                step="0.001"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.001"
              />
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
              <p className="text-cyan-300 text-sm">
                Network: <span className="font-semibold">{environment === 'mainnet' ? 'Mainnet' : environment === 'testnet' ? 'Testnet' : 'Localhost'}</span>
              </p>
            </div>
            <button 
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
              {activeAction === 'solana_signTransaction' ? 'Sign Transaction' : 'Sign & Send Transaction'}
            </button>
          </div>
        );
        
      case 'solana_signAllTransactions':
        return (
          <div className="bg-black/20 rounded-xl p-6 mt-4 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Number of Transactions:</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="number"
                min="2"
                max="5"
                value={formData.txCount}
                onChange={(e) => setFormData({...formData, txCount: parseInt(e.target.value) || 2})}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Recipient Address:</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                value={formData.recipient}
                onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                placeholder="Solana address"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Amount per Transaction (SOL):</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                type="number"
                step="0.001"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.001"
              />
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
              <p className="text-cyan-300 text-sm">
                Will create {formData.txCount} transactions of {formData.amount} SOL each
              </p>
            </div>
            <button 
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
              Sign All Transactions
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="text-3xl">☀️</span>
        <span className="text-cyan-400">
          Solana
        </span>
      </h2>
      
      <div>
        {/* Public Key Display */}
        <div className="bg-black/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-gray-300 font-semibold">Public Key:</span>
            <code className="flex-1 px-3 py-1 bg-white/10 rounded-md text-cyan-300 text-sm font-mono">
              {truncateAddress(publicKey)}
            </code>
            <button
              className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 rounded-md text-white text-sm font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
              onClick={() => navigator.clipboard.writeText(publicKey)}
              title="Copy full address"
            >
              Copy
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {actions.map(action => (
            <button
              key={action.id}
              className={`
                px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105
                ${activeAction === action.id 
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25' 
                  : 'bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 hover:text-white'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => setActiveAction(action.id)}
              disabled={loading}
            >
              <span className="mr-2">{action.icon}</span>
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