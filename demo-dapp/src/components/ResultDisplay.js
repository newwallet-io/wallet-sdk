// components/ResultDisplay.js
import React, { useState } from 'react';

function ResultDisplay({ lastAction, lastResult, lastError, requestData, onClear }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatResult = (result) => {
    if (result === null || result === undefined) {
      return 'null';
    }
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  };

  const formatJSON = (data) => {
    try {
      if (typeof data === 'string') {
        return data;
      }
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <div className="result-section">
      <div className="result-header">
        <h3 className="result-title">📊 Result</h3>
        <div className="result-actions">
          <button
            className="btn btn-small btn-secondary"
            onClick={() => copyToClipboard(formatResult(lastResult))}
          >
            {copied ? '✓ Copied' : 'Copy Result'}
          </button>
          <button
            className="btn btn-small btn-secondary"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>

      {lastError && (
        <div className="error-message">
          <strong>Error:</strong> {lastError}
        </div>
      )}

      <div className="result-content">
        <div className="result-item">
          <div className="result-label">Last Action:</div>
          <div className="result-value">{lastAction || '-'}</div>
        </div>

        <div className="result-item">
          <div className="result-label">Result:</div>
          <div className="result-value">
            <pre>{formatResult(lastResult)}</pre>
          </div>
        </div>

        {requestData && (
          <div className="result-item">
            <div className="result-label">Request Details:</div>
            <div className="json-display">
              <pre>{formatJSON(requestData)}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultDisplay;