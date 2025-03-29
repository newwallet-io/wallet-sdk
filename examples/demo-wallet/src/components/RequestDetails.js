import React, { useState, useEffect } from 'react';
import { 
  deserializeSolanaTransaction, 
  formatTransactionDetails, 
  deserializeEthereumTransaction,
  processMultipleTransactions,
  decodeMessage
} from '../utils/transactionUtils';

const RequestDetails = ({ title, description, requestData }) => {
  const [parsedData, setParsedData] = useState(null);
  
  // Parse request data when it changes
  useEffect(() => {
    if (!requestData) return;
    
    try {
      // Handle Solana transactions
      if (requestData.network === 'solana') {
        // Handle single transaction
        if ((requestData.type === 'SOL_SIGN_TRANSACTION' || 
            requestData.type === 'SOL_SIGN_AND_SEND_TRANSACTION') &&
            requestData.payload?.serializedTransaction && 
            requestData.payload?.encoding === 'base64') {
          
          // Deserialize the transaction
          const deserializedTx = deserializeSolanaTransaction(
            requestData.payload.serializedTransaction,
            requestData.payload.isVersionedTransaction,
            requestData.payload.encoding
          );
          
          // Format for display
          const formattedDetails = formatTransactionDetails(
            deserializedTx, 
            requestData.payload.isVersionedTransaction
          );
          
          setParsedData(formattedDetails);
          return;
        } 
        // Handle multiple transactions
        else if (requestData.type === 'SOL_SIGN_ALL_TRANSACTIONS' &&
                 requestData.payload?.serializedTransactions) {
          
          // Process multiple transactions
          const multiTxDetails = processMultipleTransactions(
            requestData.payload.serializedTransactions
          );
          
          setParsedData(multiTxDetails);
          return;
        }
        // Handle message signing
        else if (requestData.type === 'SOL_SIGN_MESSAGE' &&
                 requestData.payload?.message) {
          
          // Decode message using Buffer for proper decoding
          const decodedMessage = decodeMessage(
            requestData.payload.message,
            requestData.payload.encoding || 'utf8'
          );
          
          setParsedData({
            message: decodedMessage,
            encoding: requestData.payload.encoding || 'utf8'
          });
          return;
        }
      }
      // Handle Ethereum requests
      else if (requestData.network === 'ethereum') {
        // Handle transaction signing
        if (requestData.type === 'ETH_SIGN_TRANSACTION' &&
            requestData.payload?.serializedTransaction && 
            requestData.payload?.encoding === 'json') {
          
          // Deserialize Ethereum transaction
          const deserializedTx = deserializeEthereumTransaction(
            requestData.payload.serializedTransaction,
            requestData.payload.encoding
          );
          
          setParsedData(deserializedTx);
          return;
        }
        // Handle message signing
        else if (requestData.type === 'ETH_SIGN_MESSAGE' &&
                 requestData.payload?.message) {
          
          // For Ethereum, check if the message needs decoding
          let messageToDisplay = requestData.payload.message;
          
          // Use Buffer to decode if needed
          if (requestData.payload.encoding) {
            messageToDisplay = decodeMessage(
              requestData.payload.message,
              requestData.payload.encoding
            );
          }
          
          setParsedData({
            message: messageToDisplay,
            address: requestData.payload.address
          });
          return;
        }
      }
      
      // Default case - just use the raw payload
      setParsedData(requestData.payload);
    } catch (error) {
      console.error("Error parsing request data:", error);
      setParsedData({ error: error.message });
    }
  }, [requestData]);
  
  // Format display data
  const formatDisplayData = () => {
    if (!requestData || !requestData.type) return "No data available";
    
    // If we have parsed data, display it properly
    if (parsedData) {
        if (requestData.network === 'solana' && 
            (requestData.type === 'SOL_SIGN_TRANSACTION' || 
             requestData.type === 'SOL_SIGN_AND_SEND_TRANSACTION')) {
          
          return (
            <div className="tx-details">
              {parsedData.transferInfo && (
                <div className="tx-transfer-info">
                  <div className="tx-type">{parsedData.transferInfo.type} Transaction</div>
                  <div className="tx-amount">{parsedData.transferInfo.amount}</div>
                  <div className="tx-addresses">
                    <div><strong>From:</strong> {parsedData.transferInfo.from}</div>
                    <div><strong>To:</strong> {parsedData.transferInfo.to}</div>
                  </div>
                </div>
              )}
              
              <div className="tx-summary">
                <div><strong>Fee:</strong> {parsedData.estimatedFee}</div>
                <div><strong>Programs:</strong> {parsedData.programs.join(', ')}</div>
                <div><strong>Instructions:</strong> {parsedData.instructionCount}</div>
                {parsedData.recentBlockhash && (
                  <div><strong>Recent Blockhash:</strong> {parsedData.recentBlockhash}</div>
                )}
              </div>
              
              {parsedData.instructions && parsedData.instructions.length > 0 && (
                <div className="tx-instructions">
                  <div className="instructions-heading">Instruction Details:</div>
                  {parsedData.instructions.map((instr, idx) => (
                    <div key={idx} className="instruction-item">
                      <div><strong>Program:</strong> {instr.programId}</div>
                      {instr.accounts && (
                        <div><strong>Accounts:</strong> {instr.accounts.length}</div>
                      )}
                      {instr.dataSize && (
                        <div><strong>Data Size:</strong> {instr.dataSize} bytes</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }
      // Special handling for multiple transactions
      if (requestData.type === 'SOL_SIGN_ALL_TRANSACTIONS') {
        return (
          <div className="multi-tx-display">
            <div className="tx-count">{parsedData.count} transaction(s) to sign</div>
            {parsedData.samples && (
              <div className="tx-samples">
                <div className="sample-heading">Sample transactions:</div>
                {parsedData.samples.map((sample, idx) => (
                  <div key={idx} className="tx-sample">
                    <div className="sample-index">Transaction {sample.index + 1}</div>
                    <pre>{JSON.stringify(sample.details, null, 2)}</pre>
                  </div>
                ))}
                {parsedData.hasMore && <div className="more-notice">...and {parsedData.count - parsedData.samples.length} more</div>}
              </div>
            )}
          </div>
        );
      }
      
      // Special handling for messages
      if (requestData.type === 'ETH_SIGN_MESSAGE' || requestData.type === 'SOL_SIGN_MESSAGE') {
        return (
          <div className="message-display">
            <div className="message-label">Message:</div>
            <div className="message-content">{parsedData.message}</div>
            {parsedData.address && (
              <div className="message-signer">To be signed by: {parsedData.address}</div>
            )}
          </div>
        );
      }
      
      // Default JSON display for other data
      return JSON.stringify(parsedData, (key, value) => {
        // Handle BigInt serialization
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }, 2);
    }
    
    // Fallback - display raw payload
    return JSON.stringify(requestData.payload, null, 2);
  };
  
  return (
    <div>
      <div className="request-details">
        <div className="request-title">{title}</div>
        <p>{description}</p>
      </div>
      
      <div className="transaction-data">
        {formatDisplayData()}
      </div>
    </div>
  );
};

export default RequestDetails;