// Default SVG icons for common social media platforms
// Optimized inline SVG data URIs for PDFs and emails

export const PLATFORM_ICONS: Record<string, string> = {
  // Major Social Platforms
  facebook: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12c0-6.6-5.4-12-12-12S0 5.4 0 12c0 6 4.4 11 10.1 11.9v-8.4H7.1v-3.5h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9v2.2h3.3l-.5 3.5h-2.8v8.4C19.6 23 24 18 24 12z"/></svg>')}`,
  
  instagram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.9.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.9.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.9-.9-1.4-.2-.4-.4-1.1-.4-2.2-.1-1.3-.1-1.6-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.9-.7 1.4-.9.4-.2 1.1-.4 2.2-.4 1.3 0 1.6-.1 4.9-.1M12 0C8.7 0 8.3 0 7 .1 5.7.1 4.8.3 4 .6c-.9.3-1.6.8-2.3 1.5C1 2.8.4 3.5.2 4.4c-.3.8-.5 1.7-.6 3C-.5 8.7-.5 9.1-.5 12.4s0 3.7.1 5c.1 1.3.3 2.2.6 3 .3.9.8 1.6 1.5 2.3.7.7 1.4 1.2 2.3 1.5.8.3 1.7.5 3 .6 1.3.1 1.7.1 5 .1s3.7 0 5-.1c1.3-.1 2.2-.3 3-.6.9-.3 1.6-.8 2.3-1.5.7-.7 1.2-1.4 1.5-2.3.3-.8.5-1.7.6-3 .1-1.3.1-1.7.1-5s0-3.7-.1-5c-.1-1.3-.3-2.2-.6-3-.3-.9-.8-1.6-1.5-2.3-.7-.7-1.4-1.2-2.3-1.5-.8-.3-1.7-.5-3-.6C15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zM12 16a4 4 0 110-8 4 4 0 010 8zm7.8-10.4a1.4 1.4 0 11-2.9 0 1.4 1.4 0 012.9 0z"/></svg>')}`,
  
  linkedin: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.3zM5.3 7.4a2.1 2.1 0 110-4.2 2.1 2.1 0 010 4.2zm1.8 13.1H3.6V9h3.6v11.5zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.5c0 1 .8 1.8 1.8 1.8h20.5c1 0 1.8-.8 1.8-1.7V1.7c0-1-.8-1.7-1.8-1.7z"/></svg>')}`,
  
  twitter: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M24 4.6a10 10 0 01-2.8.8 5 5 0 002.2-2.7 10 10 0 01-3.1 1.2 4.9 4.9 0 00-8.4 4.5A14 14 0 011.6 3.2a5 5 0 001.5 6.6 4.9 4.9 0 01-2.2-.6v.1a4.9 4.9 0 004 4.8 5 5 0 01-2.2.1 4.9 4.9 0 004.6 3.4A9.9 9.9 0 010 19.5a14 14 0 007.6 2.2c9 0 14-7.5 14-14v-.6A10 10 0 0024 4.6z"/></svg>')}`,
  
  x: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M18.2 2.3h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.8-6 6.8H1.7l7.7-8.8L1.3 2.3H8l4.7 6.2zm-1.2 17.5h1.8L7.1 4.1H5.1z"/></svg>')}`,
  
  youtube: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F00"><path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.5a3 3 0 002.1-2.2c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>')}`,
  
  tiktok: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M12.5 0c1.3 0 2.6 0 3.9 0 .1 1.5.6 3.1 1.8 4.2 1.1 1.1 2.7 1.6 4.2 1.8v4a8.5 8.5 0 01-4.2-1c-.6-.3-1.1-.6-1.6-.9v8.8a6.2 6.2 0 01-1.4 3.9c-1.3 1.9-3.6 3.2-5.9 3.2-1.4.1-2.9-.3-4.1-1-2-1.2-3.4-3.4-3.7-5.7 0-.5 0-1 0-1.5.2-1.9 1.1-3.7 2.6-5a6.2 6.2 0 016.2-1.7v4.4a2.8 2.8 0 00-3 .4c-.6.4-1.1 1-1.4 1.7-.2.5-.2 1.1-.1 1.6.2 1.6 1.8 3 3.5 2.9 1.1 0 2.2-.7 2.8-1.6.2-.3.4-.7.4-1.1V0z"/></svg>')}`,
  
  // Messaging Platforms
  whatsapp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-.9-.3-.1-.5-.2-.7.1-.2.3-.8 1-1 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3m-5.4 7.4h0a10 10 0 01-5-1.4l-.4-.2-3.7 1 1-3.7-.2-.4a9.9 9.9 0 01-1.5-5.3c0-5.5 4.4-9.9 9.9-9.9 2.6 0 5.1 1 7 2.9a9.8 9.8 0 012.9 7c0 5.5-4.5 9.9-9.9 10h0m8.4-18.3A11.8 11.8 0 0012 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 005.7 1.5h0c6.5 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.4z"/></svg>')}`,
  
  messenger: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0084FF"><path d="M0 11.6C0 5 5.2 0 12 0s12 5 12 11.6c0 6.7-5.2 11.6-12 11.6-1.2 0-2.4-.2-3.5-.5l-2.4 1.1c-.6.3-1.3-.2-1.3-.9l-.1-2.1A11.4 11.4 0 010 11.6zm8.3-2.2L4.8 15c-.4.5.3 1.1.8.8l3.8-2.9c.3-.2.6-.2.9 0l2.8 2.1c.8.6 2 .4 2.6-.5l3.5-5.6c.4-.5-.3-1.1-.8-.8l-3.8 2.9c-.3.2-.6.2-.9 0l-2.8-2.1a1.8 1.8 0 00-2.6.5z"/></svg>')}`,
  
  telegram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0088CC"><path d="M12 0a12 12 0 100 24 12 12 0 000-24zm5 7.2c.1 0 .3 0 .5.1a.5.5 0 01.2.3v.5c-.2 1.9-1 6.5-1.4 8.6-.2.9-.5 1.2-.8 1.2-.7.1-1.2-.5-1.9-.9-1-.7-1.7-1.1-2.7-1.8-1.2-.8-.4-1.2.3-1.9l3.3-3.2c0-.2-.1-.3-.3-.1-1.8 1.1-5.1 3.3-5.1 3.3-.5.3-.9.5-1.3.5-.4 0-1.2-.2-1.9-.4-.7-.2-1.3-.4-1.3-.8 0-.2.3-.4.9-.7 3.5-1.5 5.8-2.5 7-3 3.3-1.4 4-1.6 4.5-1.6z"/></svg>')}`,
  
  viber: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#7360F2"><path d="M11.4 0C9.5 0 5.3.3 3 2.5 1.3 4.2.5 6.8.4 10c-.1 3.3-.2 9.4 5.7 11.1v2.2c0 .5.5.8.9.5l1.9-2c5.3.5 9.4-.6 9.8-.7.5-.2 3.6-.6 4.1-4.6.5-4.1.3-6.7-.4-8.9-.5-1.4-1.7-2.5-1.7-2.5S18.8 3.5 14.6 3c0 0-1.7-.2-4.5-.2h1.3zm0 2c2.5 0 4.1.2 4.1.2 3.2.4 4.6 1.4 4.6 1.4s1 .7 1.4 2c.6 2.2.4 5.1-.1 8-.4 3.1-2.7 3.3-3.1 3.5-.4.1-3.9 1-8.4.7l-2.6 2.9c-.2.2-.4.2-.5.2v0l-.1-.2V18c-4.9-1.3-4.6-6.4-4.5-9.1.1-2.7.7-4.8 2.1-6.2 1.8-1.7 5.1-1.9 7.1-1.9zm.2 2.3c-.1 0-.2 0-.2 0-.1 0-.2.1-.2.2a.2.2 0 000 .2c.3 2 1.9 3.6 4.1 3.9h.2c.1 0 .2-.2.1-.3-.1-2-1.8-3.7-4-4zm.1 1.5c-.1 0-.2.1-.2.2s.1.2.2.2a2.4 2.4 0 012.3 2c0 .1.1.2.2.2h0c.1 0 .2-.1.2-.2-.1-1.3-1.1-2.3-2.5-2.3zM9.2 8a.7.7 0 00-.5.2c-.1.1-.2.2-.2.4v.2c0 .1.1.2.2.4l.3.6c.1.2.2.3.3.5.2.3.4.6.7.9.4.6.9 1.2 1.5 1.5l.4.3c.3.2.6.4.9.6.3.2.5.3.6.3s.4 0 .4-.2l.1-.1c.1-.1.1-.1.2-.2l.1-.1c.1 0 .1-.1.2-.1.1-.1.1-.2.1-.2s.1-.3.1-.4-.1-.2-.2-.3l-.5-.5c-.2-.2-.3-.3-.5-.5l-.3-.2-.4-.2c-.1 0-.2 0-.3.1-.1.1-.2.2-.3.3l-.1.1h-.1a.4.4 0 01-.2-.1c-.2-.1-.5-.3-.7-.5-.3-.3-.5-.5-.6-.7l-.1-.1 0 0v-.1l.1-.1.1-.1c.1-.1.2-.2.3-.3 0-.1.1-.2.1-.3v-.2l-.2-.4-.2-.4-.3-.5-.1-.2-.2-.1c-.1-.1-.2-.1-.3-.1zm2.5.3c0 .1.1.2.2.2.9.1 1.6.8 1.6 1.6 0 .1.1.2.2.2h0c.1 0 .2-.1.2-.2-.1-1-.9-1.9-2-2-.1 0-.2 0-.2.2z"/></svg>')}`,
  
  threads: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000"><path d="M12.2 24h0c-3.6 0-6.3-1.2-8.2-3.5-1.6-2-2.5-4.9-2.5-8.5v0c0-3.6.9-6.4 2.5-8.5C5.9 1.2 8.6 0 12.2 0h0c2.7 0 5 .7 6.8 2.1 1.7 1.3 2.9 3.1 3.5 5.5l-2 .6c-1.1-4-3.9-6-8.3-6-2.9 0-5.1.9-6.5 2.7-1.3 1.7-2.1 4.1-2.1 7.2s.7 5.5 2.1 7.2c1.4 1.8 3.6 2.7 6.5 2.7 2.6 0 4.4-.6 5.8-2 1.6-1.6 1.6-3.6 1.1-4.8-.3-.7-.9-1.3-1.6-1.8-.2 1.4-.6 2.4-1.3 3.3-.9 1.1-2.1 1.7-3.7 1.8-1.2.1-2.4-.2-3.3-.8-1-.7-1.7-1.7-1.7-3 0-1.2.4-2.3 1.3-3 .9-.7 2-1.1 3.4-1.2 1.2 0 2.2.1 3.2.4v-1.5c0-.9-.2-1.6-.6-2.1-.4-.5-1.1-.8-2.1-.9-.7 0-1.4.2-1.9.5-.5.3-.8.7-.9 1.2l-2-.5c.2-.7.7-1.4 1.4-2 .9-.7 2-.9 3.4-.9 1.5 0 2.7.4 3.5 1.3.8.9 1.2 2.1 1.2 3.7l.2 3.5-.8.3c1 .7 1.8 1.6 2.2 2.6.8 1.7.8 4.5-1.4 6.6-1.8 1.8-4 2.5-7.2 2.6zm-.5-7.9c-.9 0-1.7.3-2.2.7-.5.4-.6.9-.6 1.4.1.9.7 1.6 1.7 1.8.4.1.8.1 1.2.1 1.1 0 1.9-.5 2.5-1.2.5-.6.7-1.4.9-2.3-.9-.3-1.9-.5-3-.5h-.5z"/></svg>')}`,
  
  pinterest: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#BD081C"><path d="M12 0C5.4 0 0 5.4 0 12c0 5.1 3.2 9.4 7.6 11.2-.1-.9-.2-2.4 0-3.4.2-.9 1.4-6 1.4-6s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.3-.1.4-.3 1.2-.3 1.4-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.7 0-3.8 2.7-7.3 7.9-7.3 4.2 0 7.4 3 7.4 6.9 0 4.1-2.6 7.5-6.2 7.5-1.2 0-2.4-.6-2.8-1.4l-.7 2.8c-.3 1-1 2.4-1.5 3.1 1.1.4 2.3.5 3.5.5 6.6 0 12-5.4 12-12S18.6 0 12 0z"/></svg>')}`,
  
  // Google
  google: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9c-.3 1.4-1 2.5-2.2 3.3v2.8h3.6c2.1-1.9 3.3-4.7 3.3-8.1z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8C4 20.5 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.8 14.1c-.2-.7-.3-1.4-.3-2.1s.1-1.4.3-2.1V7.1H2.2C1.4 8.6 1 10.2 1 12s.4 3.5 1.2 4.9l2.8-2.2.8-.6z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 4 3.5 2.2 7.1l3.7 2.8c.9-2.6 3.2-4.5 6.1-4.5z"/></svg>')}`,
  
  // Home Services Platforms
  thumbtack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#009FD9"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 9.6l-1.8 1.8c-.2.2-.5.2-.7 0L12 8l-3.4 3.4c-.2.2-.5.2-.7 0l-1.8-1.8c-.2-.2-.2-.5 0-.7L9.5 5.5c.2-.2.5-.2.7 0L12 7.3l1.8-1.8c.2-.2.5-.2.7 0l3.4 3.4c.2.2.2.5 0 .7zM12 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 4.5c.8 0 1.5.7 1.5 1.5v3c0 .3-.2.5-.5.5h-2c-.3 0-.5-.2-.5-.5v-3c0-.8.7-1.5 1.5-1.5z"/></svg>')}`,
  
  yelp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D32323"><path d="M20.2 12.6l-5 1.4c-1 .3-1.7-.8-1.2-1.6l2.9-4.3c.2-.3.6-.5 1-.5.4 0 .8.2 1 .5l2.1 2.9c.4.5.2 1.3-.5 1.6zm-7-3.7V6c0-1-1.3-1.3-1.8-.5l-4.5 6.9c-.3.4-.2 1 .2 1.3l.8.5 4-.4c.9-.1 1.3-1.1.8-1.8l-1.5-2.2c-.2-.3 0-.8.4-.9zM10.8 15c-.1-.3-.3-.6-.7-.7-.3-.1-.7-.2-1-.1L6 16.7c-1 .3-1 1.7 0 2.1l3 1.1c.4.1.8.1 1.2-.1.3-.2.6-.6.6-1l.4-4c0-.5-.3-1-.8-1.2l-.8-.3z"/></svg>')}`,
  
  angi: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6153"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>')}`,
  
  homeadvisor: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F68315"><path d="M12 2L2 9l1.5 1V20h6v-6h5v6h6V10l1.5-1L12 2zm0 2.5l7 5.5v9h-3v-6H8v6H5v-9l7-5.5z"/></svg>')}`,
  
  bbb: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#005A8C"><path d="M3.75 3v18h16.5V3H3.75zm2.25 2h12v14H6V5zm2 2v2h3V7H8zm5 0v2h3V7h-3zm-5 4v2h3v-2H8zm5 0v2h3v-2h-3zm-5 4v2h8v-2H8z"/></svg>')}`,
  
  nextdoor: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8ED500"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 3a3 3 0 110 6 3 3 0 010-6zm0 14.2c-2.5 0-4.7-1.3-6-3.2 0-2 4-3.1 6-3.1s6 1.1 6 3.1c-1.3 1.9-3.5 3.2-6 3.2z"/></svg>')}`,
  
  networx: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00B2A9"><path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7 3.5-7 3.5-7-3.5 7-3.5zm-8 5.5l7 3.5v6l-7-3.5v-6zm9 9.5v-6l7-3.5v6l-7 3.5z"/></svg>')}`,
  
  houzz: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4DBC15"><path d="M.5.5v23h12.5V12H5.5V.5H.5zm6.5 12v11h16.5v-23H18v12H7z"/></svg>')}`,
  
  craftjack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6B35"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.4-1.4 3.6 3.6 4.6-4.6L18 11l-6 6z"/></svg>')}`,
  
  porch: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00C16E"><path d="M12 3L2 9v12h20V9L12 3zm0 2.5l7 4.5v9H5v-9l7-4.5zM7 13v5h2v-5H7zm4 0v5h2v-5h-2zm4 0v5h2v-5h-2z"/></svg>')}`,
};

// Platform name aliases (case-insensitive matching)
const PLATFORM_ALIASES: Record<string, string> = {
  'fb': 'facebook',
  'ig': 'instagram',
  'insta': 'instagram',
  'li': 'linkedin',
  'tw': 'twitter',
  'yt': 'youtube',
  'tt': 'tiktok',
  'wa': 'whatsapp',
  'tg': 'telegram',
  'pin': 'pinterest',
  'bbb': 'bbb',
  'better business bureau': 'bbb',
  'houzz pro': 'houzz',
  'craft jack': 'craftjack',
  'home advisor': 'homeadvisor',
  'next door': 'nextdoor',
  'angies list': 'angi',
  "angi's": 'angi',
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
