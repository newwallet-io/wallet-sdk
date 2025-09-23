// components/ConnectionSection.js
import React from 'react';

function ConnectionSection({
  evmConnected,
  solanaConnected,
  evmAccounts,
  solanaPublicKey,
  onConnectEVM,
  onConnectSolana,
  onDisconnect,
  loading
}) {
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="text-3xl">🔗</span>
        <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Connection
        </span>
      </h2>
      
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          className={`
            px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105
            ${evmConnected 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/25' 
              : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:shadow-lg hover:shadow-purple-500/25'
            } 
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={onConnectEVM}
          disabled={loading || evmConnected}
        >
          {evmConnected ? '✓ EVM Connected' : 'Connect EVM Chains (ETH/BSC/Base)'}
        </button>
        
        <button
          className={`
            px-6 py-3 rounded-lg font-semibold text-white transition-all duration-300 transform hover:scale-105
            ${solanaConnected 
              ? 'bg-gradient-to-r from-green-500 to-teal-500 shadow-lg shadow-green-500/25' 
              : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/25'
            }
            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={onConnectSolana}
          disabled={loading || solanaConnected}
        >
          {solanaConnected ? '✓ Solana Connected' : 'Connect Solana'}
        </button>
        
        {(evmConnected || solanaConnected) && (
          <button
            className={`
              px-6 py-3 rounded-lg font-semibold text-white 
              bg-gradient-to-r from-red-500 to-pink-500 
              hover:shadow-lg hover:shadow-red-500/25 
              transition-all duration-300 transform hover:scale-105
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={onDisconnect}
            disabled={loading}
          >
            Disconnect All
          </button>
        )}
      </div>

      <div className="bg-black/20 rounded-xl p-4 space-y-3">
        {/* EVM Status */}
        <div className="flex items-center gap-3">
          <div className={`
            w-3 h-3 rounded-full transition-all duration-500
            ${evmConnected 
              ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' 
              : 'bg-gray-500'
            }
          `}></div>
          <span className="text-gray-300 font-semibold min-w-[80px]">EVM:</span>
          {evmConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400">Connected</span>
              <code className="px-3 py-1 bg-white/10 rounded-md text-blue-300 text-sm font-mono">
                {truncateAddress(evmAccounts[0])}
              </code>
            </div>
          ) : (
            <span className="text-gray-500">Not connected</span>
          )}
        </div>
        
        {/* Solana Status */}
        <div className="flex items-center gap-3">
          <div className={`
            w-3 h-3 rounded-full transition-all duration-500
            ${solanaConnected 
              ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' 
              : 'bg-gray-500'
            }
          `}></div>
          <span className="text-gray-300 font-semibold min-w-[80px]">Solana:</span>
          {solanaConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400">Connected</span>
              <code className="px-3 py-1 bg-white/10 rounded-md text-cyan-300 text-sm font-mono">
                {truncateAddress(solanaPublicKey)}
              </code>
            </div>
          ) : (
            <span className="text-gray-500">Not connected</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConnectionSection;