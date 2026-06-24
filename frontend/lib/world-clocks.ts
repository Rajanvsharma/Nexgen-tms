export interface ClockZone {
  label: string;
  sub:   string;
  tz:    string;
  flag:  string;
}

export const ALL_CLOCKS: ClockZone[] = [
  { label: 'Los Angeles', sub: 'Pacific',       tz: 'America/Los_Angeles', flag: '🇺🇸' },
  { label: 'Chicago',     sub: 'Central',        tz: 'America/Chicago',     flag: '🇺🇸' },
  { label: 'New York',    sub: 'Eastern',        tz: 'America/New_York',    flag: '🇺🇸' },
  { label: 'Toronto',     sub: 'Canada East',    tz: 'America/Toronto',     flag: '🇨🇦' },
  { label: 'São Paulo',   sub: 'Brazil',         tz: 'America/Sao_Paulo',   flag: '🇧🇷' },
  { label: 'London',      sub: 'GMT / BST',      tz: 'Europe/London',       flag: '🇬🇧' },
  { label: 'Paris',       sub: 'CET',            tz: 'Europe/Paris',        flag: '🇫🇷' },
  { label: 'Berlin',      sub: 'Germany',        tz: 'Europe/Berlin',       flag: '🇩🇪' },
  { label: 'Dubai',       sub: 'Gulf Standard',  tz: 'Asia/Dubai',          flag: '🇦🇪' },
  { label: 'Mumbai',      sub: 'India IST',      tz: 'Asia/Kolkata',        flag: '🇮🇳' },
  { label: 'Singapore',   sub: 'SGT',            tz: 'Asia/Singapore',      flag: '🇸🇬' },
  { label: 'Beijing',     sub: 'China CST',      tz: 'Asia/Shanghai',       flag: '🇨🇳' },
  { label: 'Hong Kong',   sub: 'HKT',            tz: 'Asia/Hong_Kong',      flag: '🇭🇰' },
  { label: 'Tokyo',       sub: 'Japan JST',      tz: 'Asia/Tokyo',          flag: '🇯🇵' },
  { label: 'Sydney',      sub: 'AEST',           tz: 'Australia/Sydney',    flag: '🇦🇺' },
];

export const DEFAULT_CLOCK_TZS = [
  'America/Los_Angeles',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Asia/Shanghai',
];

export const CLOCK_STORAGE_KEY = 'world_clock_enabled';

export function loadClockPrefs(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CLOCK_TZS;
  try {
    const v = localStorage.getItem(CLOCK_STORAGE_KEY);
    return v ? JSON.parse(v) : DEFAULT_CLOCK_TZS;
  } catch { return DEFAULT_CLOCK_TZS; }
}

export function saveClockPrefs(tzs: string[]) {
  localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(tzs));
}
