/**
 * Gets the favicon URL from the current origin
 * @returns The URL of the favicon, or null if not found
 */
function getFaviconFromOrigin(origin: string): string {
  return `${origin}/favicon.ico`;
}

export function openPopup(url: string): Window | null {
  const popupName = `newwallet-popup-${Date.now()}`;
  const popup = window.open(url, popupName, 'width=400,height=600');
  if (!popup) {
    throw new Error('Failed to open wallet popup. Please allow popups for this site.');
  }
  return popup;
}
