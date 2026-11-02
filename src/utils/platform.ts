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
