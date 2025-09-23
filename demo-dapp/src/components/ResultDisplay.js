// components/ResultDisplay.js
import React, { useState } from 'react';

function ResultDisplay({ lastAction, lastResult, lastError, requestData, onClear }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text) => {
    try {
      // Ensure text is a string
      const textToCopy = typeof text === 'string' ? text : String(text);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Helper function to handle BigInt and other special types serialization
  const specialTypeReplacer = (key, value) => {
    // Handle BigInt
    if (typeof value === 'bigint') {
      return {
        type: 'BigInt',
        value: value.toString()
      };
    }
    // Handle Buffer/Uint8Array (common in crypto operations)
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return {
        type: 'Buffer',
        data: Array.from(value)
      };
    }
    // Handle undefined (which JSON.stringify normally omits)
    if (value === undefined) {
      return 'undefined';
    }
    // Handle functions (for debugging)
    if (typeof value === 'function') {
      return '[Function: ' + (value.name || 'anonymous') + ']';
    }
    return value;
  };

  // Format for display with special handling for crypto/blockchain data
  const formatForDisplay = (data) => {
    if (data === null || data === undefined) {
      return 'null';
    }
    
    // Handle BigInt directly
    if (typeof data === 'bigint') {
      return data.toString() + 'n';
    }
    
    // Handle hex strings (transaction hashes, addresses)
    if (typeof data === 'string' && data.startsWith('0x')) {
      return data;
    }
    
    // Handle arrays of transactions or complex objects
    if (typeof data === 'object') {
      try {
        // Pretty print with special type handling
        const formatted = JSON.stringify(data, specialTypeReplacer, 2);
        
        // Post-process to make BigInt values more readable
        return formatted.replace(
          /"type":\s*"BigInt",\s*"value":\s*"(\d+)"/g, 
          '"$1n"'
        );
      } catch (error) {
        console.error('Error formatting result:', error);
        try {
          // Fallback: try to convert to string
          return String(data);
        } catch {
          return '[Complex Object]';
        }
      }
    }
    
    return String(data);
  };

  const formatResult = (result) => {
    return formatForDisplay(result);
  };

  const formatJSON = (data) => {
    return formatForDisplay(data);
  };

  return (
    <div className="backdrop-blur-md bg-slate-800/50 rounded-2xl p-6 border border-white/10 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <span className="text-green-400">
            Result
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 transform hover:scale-105"
            onClick={() => copyToClipboard(formatResult(lastResult))}
          >
            {copied ? '✓ Copied' : 'Copy Result'}
          </button>
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-gray-600/25 transition-all duration-300 transform hover:scale-105"
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error Message */}
      {lastError && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <strong className="text-red-400 font-semibold">Error:</strong>
              <p className="text-red-300 mt-1">{lastError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result Content */}
      <div className="space-y-4">
        {/* Last Action */}
        <div className="bg-black/30 rounded-xl p-4">
          <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">
            Last Action
          </div>
          <div className="text-cyan-400 font-mono text-lg">
            {lastAction || '-'}
          </div>
        </div>

        {/* Result */}
        <div className="bg-black/30 rounded-xl p-4">
          <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">
            Result
          </div>
          <pre className="text-green-400 font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all">
            {formatResult(lastResult)}
          </pre>
        </div>

        {/* Request Details */}
        {requestData && (
          <div className="bg-black/30 rounded-xl p-4">
            <div className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">
              Request Details
            </div>
            <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
              <pre className="text-blue-300 font-mono text-xs leading-relaxed">
                {formatJSON(requestData)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultDisplay;