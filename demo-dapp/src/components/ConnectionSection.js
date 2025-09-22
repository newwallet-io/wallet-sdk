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
    <div className="section">
      <h2 className="section-title">🔗 Connection</h2>
      
      <div className="connection-buttons">
        <button
          className="btn btn-primary"
          onClick={onConnectEVM}
          disabled={loading || evmConnected}
        >
          {evmConnected ? '✓ EVM Connected' : 'Connect EVM Chains (ETH/BSC/Base)'}
        </button>
        
        <button
          className="btn btn-primary"
          onClick={onConnectSolana}
          disabled={loading || solanaConnected}
        >
          {solanaConnected ? '✓ Solana Connected' : 'Connect Solana'}
        </button>
        
        {(evmConnected || solanaConnected) && (
          <button
            className="btn btn-danger"
            onClick={onDisconnect}
            disabled={loading}
          >
            Disconnect All
          </button>
        )}
      </div>

      <div className="status-container">
        <div className="status-row">
          <div className={`status-indicator ${evmConnected ? 'connected' : ''}`}></div>
          <span className="status-label">EVM:</span>
          {evmConnected ? (
            <span className="status-value">
              Connected - <span className="account-address">{truncateAddress(evmAccounts[0])}</span>
            </span>
          ) : (
            <span className="status-value dimmed">Not connected</span>
          )}
        </div>
        
        <div className="status-row">
          <div className={`status-indicator ${solanaConnected ? 'connected' : ''}`}></div>
          <span className="status-label">Solana:</span>
          {solanaConnected ? (
            <span className="status-value">
              Connected - <span className="account-address">{truncateAddress(solanaPublicKey)}</span>
            </span>
          ) : (
            <span className="status-value dimmed">Not connected</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConnectionSection;