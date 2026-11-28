import { Capacitor } from '@capacitor/core';

/**
 * Checks whether the app is currently running inside a mobile shell (Android or iOS).
 * Can also be triggered via URL query param (?platform=android | ?platform=ios | ?platform=mobile) for testing.
 */
export const isMobile = (): boolean => {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const p = urlParams.get('platform');
    if (p === 'android' || p === 'ios' || p === 'mobile') {
      return true;
    }
  }
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios';
};

/**
 * Shared mobile check across Android and iOS so both platforms
 * provide the exact same layout, bottom bar, and mobile optimizations.
 */
export const isAndroid = (): boolean => isMobile();

/**
 * Strava OAuth runs through the Worker backend (`/api/strava/*`): same-origin
 * on the web, and through the deployed Worker from the Android/iOS app.
 */
export const supportsServerIntegrations = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (Capacitor.isNativePlatform()) return true;
  return window.location.protocol === 'https:' || window.location.protocol === 'http:';
};
