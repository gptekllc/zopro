export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic Time (AT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Time (JST)' },
  { value: 'Asia/Shanghai', label: 'China Time (CST)' },
  { value: 'Asia/Kolkata', label: 'India Time (IST)' },
  { value: 'Asia/Dubai', label: 'Gulf Time (GST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZST/NZDT)' },
] as const;

export type TimezoneValue = typeof TIMEZONES[number]['value'];