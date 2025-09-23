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

  // Helper function to handle BigInt serialization
  const bigIntReplacer = (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString() + 'n'; // Add 'n' suffix to indicate it was a BigInt
    }
    return value;
  };

  const formatResult = (result) => {
    if (result === null || result === undefined) {
      return 'null';
    }
    if (typeof result === 'bigint') {
      return result.toString() + 'n';
    }
    if (typeof result === 'object') {
      try {
        return JSON.stringify(result, bigIntReplacer, 2);
      } catch (error) {
        console.error('Error formatting result:', error);
        return String(result);
      }
    }
    return String(result);
  };

  const formatJSON = (data) => {
    try {
      if (typeof data === 'string') {
        return data;
      }
      if (typeof data === 'bigint') {
        return data.toString() + 'n';
      }
      return JSON.stringify(data, bigIntReplacer, 2);
    } catch (error) {
      console.error('Error formatting JSON:', error);
      return String(data);
    }
  };

  return (
    <div className="backdrop-blur-md bg-gradient-to-br from-slate-900/50 to-purple-900/50 rounded-2xl p-6 border border-white/10 shadow-xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-3xl">📊</span>
          <span className="bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            Result
          </span>
        </h3>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 transform hover:scale-105"
            onClick={() => copyToClipboard(formatResult(lastResult))}
          >
            {copied ? '✓ Copied' : 'Copy Result'}
          </button>
          <button
            className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-gray-600/25 transition-all duration-300 transform hover:scale-105"
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