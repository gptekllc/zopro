// Default SVG icons for common social media platforms
// Optimized inline SVG data URIs for PDFs and emails

export const PLATFORM_ICONS: Record<string, string> = {
  // Major Social Platforms
  facebook: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.2h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/></svg>')}`,
  
  linkedin: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.3zM5.3 7.4a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zm1.8 13.1H3.6V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.5c0 1 .8 1.8 1.8 1.8h20.5c1 0 1.8-.8 1.8-1.7V1.7c0-1-.8-1.7-1.8-1.7z"/></svg>')}`,
  
  x: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M18.2 2.3h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.3 2.3H8l4.7 6.2zm-1.2 17.5h1.8L7.1 4.1H5.1z"/></svg>')}`,
  
  youtube: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F00"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.5a3 3 0 002.1-2.2c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>')}`,
  
  tiktok: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M12.5 0c1.3 0 2.6 0 3.9 0 .1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8v4a8.5 8.5 0 01-4.2-1c-.6-.3-1.1-.6-1.6-.9v8.8a6.2 6.2 0 01-1.4 3.9c-1.3 1.9-3.6 3.2-5.9 3.2-1.4.1-2.9-.3-4.1-1-2-1.2-3.4-3.4-3.7-5.7 0-.5 0-1 0-1.5.2-1.9 1.1-3.7 2.6-5a6.2 6.2 0 016.2-1.7v4.4a2.8 2.8 0 00-3 .4c-.6.4-1.1 1-1.4 1.7-.2.5-.2 1.1-.1 1.6.2 1.6 1.8 3 3.5 2.9 1.1 0 2.2-.7 2.8-1.6.2-.3.4-.7.4-1.1V0z"/></svg>')}`,
  
  // Messaging Platforms
  whatsapp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3m-5.4 7.4h0a10 10 0 01-5-1.4l-.4-.2-3.7 1 1-3.7-.2-.4a9.9 9.9 0 01-1.5-5.3c0-5.5 4.4-9.9 9.9-9.9 2.6 0 5.1 1 7 2.9a9.8 9.8 0 012.9 7c0 5.5-4.5 9.9-9.9 10h0m8.4-18.3A11.8 11.8 0 0012 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 005.7 1.5h0c6.5 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.4z"/></svg>')}`,
  
  messenger: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0084FF"><path d="M0 11.6C0 5 5.2 0 12 0s12 5 12 11.6c0 6.7-5.2 11.6-12 11.6-1.2 0-2.4-.2-3.5-.5l-2.4 1.1c-.6.3-1.3-.2-1.3-.9l-.1-2.1A11.4 11.4 0 010 11.6zm8.3-2.2L4.8 15c-.4.5.3 1.1.8.8l3.8-2.9c.3-.2.6-.2.9 0l2.8 2.1c.8.6 2 .4 2.6-.5l3.5-5.6c.4-.5-.3-1.1-.8-.8l-3.8 2.9c-.3.2-.6.2-.9 0l-2.8-2.1a1.8 1.8 0 00-2.6.5z"/></svg>')}`,
  
  telegram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0088CC"><path d="M12 0a12 12 0 100 24 12 12 0 000-24zm5 7.2c.1 0 .3 0 .5.1a.5.5 0 01.2.3v.5c-.2 1.9-1 6.5-1.4 8.6-.2.9-.5 1.2-.8 1.2-.7.1-1.2-.5-1.9-.9-1-.7-1.7-1.1-2.7-1.8-1.2-.8-.4-1.2.3-1.9l3.3-3.2c0-.2-.1-.3-.3-.1-1.8 1.1-5.1 3.3-5.1 3.3-.5.3-.9.5-1.3.5-.4 0-1.2-.2-1.9-.4-.7-.2-1.3-.4-1.3-.8 0-.2.3-.4.9-.7 3.5-1.5 5.8-2.5 7-3 3.3-1.4 4-1.6 4.5-1.6z"/></svg>')}`,
  
  viber: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="#7F4DA0"><path d="M26 52c14.36 0 26-11.64 26-26S40.36 0 26 0 0 11.64 0 26s11.64 26 26 26zm1.56-10.59c1.77-.22 3.2-.65 4.76-1.41 1.54-.75 2.53-1.47 3.84-2.77 1.22-1.22 1.9-2.15 2.62-3.6 1-2.01 1.57-4.4 1.67-7.03.04-.9.01-1.1-.19-1.36-.39-.5-1.25-.41-1.54.15-.09.18-.12.34-.15 1.06-.05 1.1-.13 1.82-.28 2.67-.61 3.34-2.21 6-4.77 7.91-2.13 1.6-4.34 2.38-7.23 2.55-.98.06-1.15.1-1.37.27-.41.32-.43 1.08-.05 1.44.24.22.41.25 1.25.22.44-.01 1.08-.06 1.43-.1zm-11.75-.55c.18-.06.46-.21.6-.31.98-.65 3.69-4.13 4.58-5.87.51-.99.68-1.73.52-2.27-.16-.59-.44-.89-1.65-1.87-.49-.4-.95-.8-1.02-.91-.18-.27-.34-.79-.34-1.16.01-.86.55-2.42 1.28-3.62.57-.93 1.58-2.12 2.59-3.03 1.18-1.08 2.21-1.81 3.39-2.39 1.51-.75 2.43-.94 3.11-.63.17.08.35.18.41.23.05.05.45.53.87 1.06.83 1.05 1.02 1.22 1.59 1.41.73.25 1.47.18 2.21-.19.57-.29 1.8-1.06 2.6-1.61 1.05-.74 3.29-2.56 3.6-2.93.53-.66.63-1.5.28-2.43-.38-.98-1.86-2.82-2.89-3.6-.94-.71-1.6-.98-2.48-1.02-.72-.04-1.02.02-1.94.4-7.22 2.97-12.98 7.41-17.56 13.53-2.39 3.18-4.2 6.49-5.44 9.91-.73 1.99-.77 2.86-.21 3.91.26.43 1.35 1.5 2.13 2.09 1.33.99 1.94 1.35 2.43 1.46.33.07.91.02 1.28-.11zm12.1-3.17c3.12-.46 5.54-1.9 7.13-4.25.89-1.32 1.45-2.88 1.64-4.55.07-.61.07-1.72 0-1.91-.07-.17-.28-.41-.47-.51-.2-.1-.63-.1-.87.02-.4.2-.52.52-.52 1.38 0 1.33-.34 2.73-.87 3.82-.68 1.24-1.67 2.26-2.87 2.98-1.03.62-2.56 1.07-3.95 1.18-.5.04-.78.14-.98.36-.29.33-.26.88.02 1.26.27.42.68.49 1.91.3zm1.1-3.88c1.01-.22 1.78-.6 2.44-1.22.85-.81 1.32-1.78 1.52-3.18.14-.91.08-1.27-.21-1.57-.3-.28-.86-.29-1.2-.07-.25.18-.33.39-.39.91-.07.7-.19 1.2-.41 1.65-.45.97-1.25 1.48-2.6 1.64-.63.08-.82.15-1.03.39-.38.45-.24 1.17.29 1.44.2.1.28.11.7.08.27-.01.67-.05.88-.08z"/></svg>')}`,
  
  pinterest: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#BD081C"><path d="M12 0C5.4 0 0 5.4 0 12c0 5.1 3.2 9.4 7.6 11.2-.1-.9-.2-2.4 0-3.4.2-.9 1.4-6 1.4-6s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3-.1.4-.3 1.2-.3 1.4-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.7 0-3.8 2.7-7.3 7.9-7.3 4.2 0 7.4 3 7.4 6.9 0 4.1-2.6 7.5-6.2 7.5-1.2 0-2.4-.6-2.8-1.4l-.7 2.8c-.3 1-1 2.4-1.5 3.1 1.1.4 2.3.5 3.5.5 6.6 0 12-5.4 12-12S18.6 0 12 0z"/></svg>')}`,
  
  // Google
  google: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9c-.3 1.4-1 2.5-2.2 3.3v2.8h3.6c2.1-1.9 3.3-4.7 3.3-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8C4 20.5 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.8 14.1c-.2-.7-.3-1.4-.3-2.1s.1-1.4.3-2.1V7.1H2.2C1.4 8.6 1 10.2 1 12s.4 3.5 1.2 4.9l2.8-2.2.8-.6z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 4 3.5 2.2 7.1l3.7 2.8c.9-2.6 3.2-4.5 6.1-4.5z"/></svg>')}`,
  
  // Home Services Platforms
  yelp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#DC0000"><path d="M10.1 16.9l-3.3 4c-.5.6-.2 1.4.4 1.7l3.2 1.3c.7.3 1.5-.2 1.5-1l.1-5.3c0-1-.9-1.5-1.7-.7zM9.5 12.9l-4.9-1.8c-.7-.2-1.4.3-1.4 1l-.1 3.5c0 .7.7 1.3 1.4 1.1l5-1.6c1-.3 1.1-1.8 0-2.2zM15.1 13.5l5-1.4c.7-.2 1-.9.6-1.6l-1.9-2.9c-.4-.6-1.3-.7-1.8 0l-3.1 4.2c-.7.9.1 2 1.2 1.7zM11.5 1.3c0-.9-.8-1.5-1.6-1.3l-4 1.1c-.9.2-1.2 1.2-.7 2l4.5 7.9c.1.1.1.1.1.2.7.8 1.9.5 2.2-.4.1-.2.1-.3.1-.5l-.6-9zM20.2 17.1l-5-1.5c-1-.3-1.8.8-1.2 1.7l3 4.2c.4.6 1.3.6 1.7 0l2.1-2.8c.5-.5.3-1.3-.6-1.6z"/></svg>')}`,
  
  bbb: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#005A8C"><path d="M3.75 3v18h16.5V3H3.75zm2.25 2h12v14H6V5zm2 2v2h3V7H8zm5 0v2h3V7h-3zm-5 4v2h3v-2H8zm5 0v2h3v-2h-3zm-5 4v2h8v-2H8z"/></svg>')}`,
  
  houzz: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4DBC15"><path d="M.5.5v23h12.5V12H5.5V.5H.5zm6.5 12v11h16.5v-23H18v12H7z"/></svg>')}`,
  
  craftjack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6B35"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.4-1.4 3.6 3.6 4.6-4.6L18 11l-6 6z"/></svg>')}`,
  
  porch: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00C16E"><path d="M12 3L2 9v12h20V9L12 3zm0 2.5l7 4.5v9H5v-9l7-4.5zM7 13v5h2v-5H7zm4 0v5h2v-5h-2zm4 0v5h2v-5h-2z"/></svg>')}`,
};

// Platform name aliases (case-insensitive matching)
const PLATFORM_ALIASES: Record<string, string> = {
  'fb': 'facebook',
  'li': 'linkedin',
  'yt': 'youtube',
  'tt': 'tiktok',
  'wa': 'whatsapp',
  'tg': 'telegram',
  'pin': 'pinterest',
  'bbb': 'bbb',
  'better business bureau': 'bbb',
  'houzz pro': 'houzz',
  'craft jack': 'craftjack',
};

/**
 * Get the default icon URL for a platform based on its name
 * Returns null if no matching icon is found
 */
export function getDefaultPlatformIcon(platformName: string): string | null {
  const normalized = platformName.toLowerCase().trim();
  
  // Check direct match first
  if (PLATFORM_ICONS[normalized]) {
    return PLATFORM_ICONS[normalized];
  }
  
  // Check aliases
  if (PLATFORM_ALIASES[normalized]) {
    return PLATFORM_ICONS[PLATFORM_ALIASES[normalized]];
  }
  
  // Try partial matching (e.g., "Facebook Page" matches "facebook")
  for (const [key, icon] of Object.entries(PLATFORM_ICONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }
  
  return null;
}

/**
 * Get list of available platform names for autocomplete
 */
export function getAvailablePlatforms(): string[] {
  return Object.keys(PLATFORM_ICONS).map(
    name => name.charAt(0).toUpperCase() + name.slice(1)
  );
}
