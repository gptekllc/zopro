// Maps navigation helper for opening addresses in native maps apps

export interface AddressComponents {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export function buildAddressString(components: AddressComponents): string {
  return [components.address, components.city, components.state, components.zip]
    .filter(Boolean)
    .join(', ');
}

export function openInMaps(components: AddressComponents): void {
  const address = buildAddressString(components);
  if (!address) return;

  const encodedAddress = encodeURIComponent(address);

  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    // Apple Maps URL scheme
    window.open(`maps://?q=${encodedAddress}`, '_blank');
  } else {
    // Google Maps (works on Android and Desktop)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  }
}

export function hasAddress(components: AddressComponents): boolean {
  return Boolean(components.address || components.city || components.state || components.zip);
}
