import { Capacitor } from '@capacitor/core';

/**
 * Checks whether the app is currently running inside the Android native Capacitor shell.
 * Can also be triggered via URL query param (?platform=android) for testing.
 */
export const isAndroid = (): boolean => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('platform') === 'android') {
      return true;
    }
  }
  return Capacitor.getPlatform() === 'android';
};
