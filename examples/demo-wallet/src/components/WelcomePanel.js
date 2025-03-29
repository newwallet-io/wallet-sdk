import React from 'react';

const WelcomePanel = ({ accounts }) => {
  return (
    <div className="welcome-state">
      <div className="welcome-icon">💼</div>
      <h2>NewWallet Demo</h2>
      <p>Waiting for requests from DApps...</p>
      <div className="accounts-section">
        <div className="network-section">
          <h3>Ethereum</h3>
          <div className="account-item">
            <div className="account-label">Address:</div>
            <div className="account-value">{accounts.ethereum.address}</div>
          </div>
        </div>
        <div className="network-section">
          <h3>Solana</h3>
          <div className="account-item">
            <div className="account-label">Public Key:</div>
            <div className="account-value">{accounts.solana.publicKey}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePanel;