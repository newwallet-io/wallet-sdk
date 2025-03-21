// Ethereum specific message types
export enum EthereumMessageType {
  READY = 'READY',
  CONNECT_WALLET = 'CONNECT_WALLET',
  SIGN_TRANSACTION = 'ETH_SIGN_TRANSACTION',
  SIGN_MESSAGE = 'ETH_SIGN_MESSAGE',
}

// Solana specific message types
export enum SolanaMessageType {
  READY = 'READY',
  CONNECT_WALLET = 'CONNECT_WALLET',
  SIGN_MESSAGE = 'SOL_SIGN_MESSAGE',
  SIGN_TRANSACTION = 'SOL_SIGN_TRANSACTION',
  SIGN_ALL_TRANSACTIONS = 'SOL_SIGN_ALL_TRANSACTIONS',
  SIGN_AND_SEND_TRANSACTION = 'SOL_SIGN_AND_SEND_TRANSACTION',
}
export type MessageType = EthereumMessageType | SolanaMessageType;

// These error messages are inspired by Ethereum's EIP-1474 and EIP-1193.
export enum ErrorCode {
  // User interaction errors (from EIP-1193)
  USER_REJECTED = 4001, // User rejected the request
  UNAUTHORIZED = 4100, // The requested method and/or account has not been authorized
  UNSUPPORTED_METHOD = 4200, // The Provider does not support the requested method
  DISCONNECTED = 4900, // The Provider is disconnected
  CHAIN_DISCONNECTED = 4901, // The Provider is not connected to the requested chain
  CHAIN_NOT_ADDED = 4902, // Chain has not been added to provider

  // Standard JSON-RPC 2.0 errors (from EIP-1474)
  PARSE_ERROR = -32700, // Invalid JSON
  INVALID_REQUEST = -32600, // JSON is not a valid request object
  METHOD_NOT_FOUND = -32601, // Method does not exist
  INVALID_PARAMS = -32602, // Invalid method parameters
  INTERNAL_ERROR = -32603, // Internal JSON-RPC error

  // Common blockchain errors
  INVALID_INPUT = -32000, // Missing or invalid parameters
  RESOURCE_NOT_FOUND = -32001, // Requested resource not found
  RESOURCE_UNAVAILABLE = -32002, // Requested resource not available
  TRANSACTION_REJECTED = -32003, // Transaction creation failed
  METHOD_NOT_SUPPORTED = -32004, // Method is not implemented
  LIMIT_EXCEEDED = -32005, // Request exceeds defined limit
  VERSION_NOT_SUPPORTED = -32006, // Version of JSON-RPC not supported

  // Generic error
  UNKNOWN_ERROR = -1, // Unknown or unspecified error
}

// Standard error messages for each error code
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // User interaction errors
  [ErrorCode.USER_REJECTED]: 'The request was rejected by the user',
  [ErrorCode.UNAUTHORIZED]: 'The requested method and/or account has not been authorized',
  [ErrorCode.UNSUPPORTED_METHOD]: 'The requested method is not supported',
  [ErrorCode.DISCONNECTED]: 'The provider is disconnected',
  [ErrorCode.CHAIN_DISCONNECTED]: 'The provider is not connected to the requested chain',
  [ErrorCode.CHAIN_NOT_ADDED]: 'The requested chain has not been added to the provider',

  // Standard JSON-RPC 2.0 errors
  [ErrorCode.PARSE_ERROR]: 'Invalid JSON was received by the server',
  [ErrorCode.INVALID_REQUEST]: 'The JSON sent is not a valid request object',
  [ErrorCode.METHOD_NOT_FOUND]: 'The method does not exist / is not available',
  [ErrorCode.INVALID_PARAMS]: 'Invalid method parameter(s)',
  [ErrorCode.INTERNAL_ERROR]: 'Internal JSON-RPC error',

  // Common blockchain errors
  [ErrorCode.INVALID_INPUT]: 'Missing or invalid parameters',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Requested resource not found',
  [ErrorCode.RESOURCE_UNAVAILABLE]: 'Requested resource not available',
  [ErrorCode.TRANSACTION_REJECTED]: 'Transaction creation failed',
  [ErrorCode.METHOD_NOT_SUPPORTED]: 'Method is not implemented',
  [ErrorCode.LIMIT_EXCEEDED]: 'Request exceeds defined limit',
  [ErrorCode.VERSION_NOT_SUPPORTED]: 'Version of JSON-RPC protocol not supported',

  // Generic error
  [ErrorCode.UNKNOWN_ERROR]: 'Unknown error',
};

export function getErrorMessage(code: ErrorCode, customMessage?: string): string {
  // Return custom message if provided, otherwise use standard message
  return customMessage || ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

// Error class for SDK use
export class ProviderError extends Error {
  code: ErrorCode;
  data?: unknown;

  constructor(code: ErrorCode, message?: string, data?: unknown) {
    // Use standard message if custom message not provided
    super(getErrorMessage(code, message));
    this.code = code;
    this.data = data;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

// Create an error response
export function createErrorResponse(
  type: MessageType,
  network: string,
  code: ErrorCode,
  message?: string,
  data?: unknown
): MessageResponse {
  return {
    type,
    network,
    payload: {
      success: false,
      message: getErrorMessage(code, message),
      errorCode: code,
      result: data, // Include data in result if needed
    },
  };
}

// Create a success response
export function createSuccessResponse(
  type: MessageType,
  network: string,
  result: any,
  message = 'Success'
): MessageResponse {
  return {
    type,
    network,
    payload: {
      success: true,
      message,
      result,
    },
  };
}

export interface MessageRequest {
  type: MessageType;
  network: string;
  timestamp?: number;
  payload?: any;
}

export interface MessageResponse {
  type: MessageType;
  network: string;
  payload: {
    success: boolean;
    message: string;
    result?: any;
    errorCode?: ErrorCode;
  };
}
