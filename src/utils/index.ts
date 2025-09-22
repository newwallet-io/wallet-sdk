// src/utils/index.ts - Utility functions

/**
 * Open a popup window for wallet interaction
 */
export function openPopup(url: string): Window | null {
  // Check if we're in a test environment
  if (typeof window === 'undefined') {
    throw new Error('Window is not defined');
  }
  
  const popupName = `newwallet-popup-${Date.now()}`;
  const width = 400;
  const height = 600;
  
  // Center the popup
  const left = (window.screen?.width || 1024 - width) / 2;
  const top = (window.screen?.height || 768 - height) / 2;
  
  const popup = window.open(
    url,
    popupName,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
  
  // In test environment, window.open might be mocked
  if (!popup && process.env.NODE_ENV !== 'test') {
    throw new Error('Failed to open wallet popup. Please allow popups for this site.');
  }
  
  // Focus the popup if it exists
  if (popup && popup.focus) {
    popup.focus();
  }
  
  return popup;
}

/**
 * Get favicon URL from origin
 */
export function getFaviconUrl(origin: string): string {
  try {
    const url = new URL(origin);
    return `${url.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
