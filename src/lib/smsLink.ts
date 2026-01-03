/**
 * Creates an SMS link with a pre-filled "On My Way" message.
 * Opens the device's native SMS app when used as href.
 */
export function createOnMyWaySmsLink(params: {
  customerPhone: string;
  technicianName: string;
  companyName: string;
  etaMinutes?: number;
}): string {
  const { customerPhone, technicianName, companyName, etaMinutes } = params;
  
  // Build the message
  let message = `Hi, this is ${technicianName} from ${companyName}. I'm on my way to your location!`;
  if (etaMinutes) {
    message += ` ETA: ~${etaMinutes} minutes.`;
  }
  
  // Clean phone number (remove non-digit characters except +)
  const cleanPhone = customerPhone.replace(/[^\d+]/g, '');
  
  // Encode the message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Use sms: protocol - works on both iOS and Android
  return `sms:${cleanPhone}?body=${encodedMessage}`;
}

/**
 * Generates a plain text message for copying (desktop fallback)
 */
export function createOnMyWayMessage(params: {
  technicianName: string;
  companyName: string;
  etaMinutes?: number;
}): string {
  const { technicianName, companyName, etaMinutes } = params;
  
  let message = `Hi, this is ${technicianName} from ${companyName}. I'm on my way to your location!`;
  if (etaMinutes) {
    message += ` ETA: ~${etaMinutes} minutes.`;
  }
  
  return message;
}
