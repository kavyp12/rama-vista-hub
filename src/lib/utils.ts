import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


// Country codes with flag emojis
export const COUNTRY_CODES = [
  // South Asia
  { code: '+91',   iso: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+92',   iso: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880',  iso: 'BD', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+94',   iso: 'LK', flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+977',  iso: 'NP', flag: '🇳🇵', name: 'Nepal' },
  { code: '+975',  iso: 'BT', flag: '🇧🇹', name: 'Bhutan' },
  { code: '+960',  iso: 'MV', flag: '🇲🇻', name: 'Maldives' },
  { code: '+93',   iso: 'AF', flag: '🇦🇫', name: 'Afghanistan' },
  // Middle East
  { code: '+971',  iso: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+966',  iso: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+965',  iso: 'KW', flag: '🇰🇼', name: 'Kuwait' },
  { code: '+974',  iso: 'QA', flag: '🇶🇦', name: 'Qatar' },
  { code: '+973',  iso: 'BH', flag: '🇧🇭', name: 'Bahrain' },
  { code: '+968',  iso: 'OM', flag: '🇴🇲', name: 'Oman' },
  { code: '+962',  iso: 'JO', flag: '🇯🇴', name: 'Jordan' },
  { code: '+961',  iso: 'LB', flag: '🇱🇧', name: 'Lebanon' },
  { code: '+972',  iso: 'IL', flag: '🇮🇱', name: 'Israel' },
  { code: '+964',  iso: 'IQ', flag: '🇮🇶', name: 'Iraq' },
  { code: '+98',   iso: 'IR', flag: '🇮🇷', name: 'Iran' },
  // South-East Asia
  { code: '+65',   iso: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+60',   iso: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+62',   iso: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+63',   iso: 'PH', flag: '🇵🇭', name: 'Philippines' },
  { code: '+66',   iso: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: '+84',   iso: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+855',  iso: 'KH', flag: '🇰🇭', name: 'Cambodia' },
  { code: '+856',  iso: 'LA', flag: '🇱🇦', name: 'Laos' },
  { code: '+95',   iso: 'MM', flag: '🇲🇲', name: 'Myanmar' },
  { code: '+673',  iso: 'BN', flag: '🇧🇳', name: 'Brunei' },
  // East Asia
  { code: '+86',   iso: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+81',   iso: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+82',   iso: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+852',  iso: 'HK', flag: '🇭🇰', name: 'Hong Kong' },
  { code: '+853',  iso: 'MO', flag: '🇲🇴', name: 'Macao' },
  { code: '+886',  iso: 'TW', flag: '🇹🇼', name: 'Taiwan' },
  // Europe
  { code: '+44',   iso: 'GB', flag: '🇬🇧', name: 'UK' },
  { code: '+33',   iso: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+49',   iso: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+39',   iso: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+34',   iso: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+31',   iso: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+32',   iso: 'BE', flag: '🇧🇪', name: 'Belgium' },
  { code: '+41',   iso: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+43',   iso: 'AT', flag: '🇦🇹', name: 'Austria' },
  { code: '+351',  iso: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+46',   iso: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: '+47',   iso: 'NO', flag: '🇳🇴', name: 'Norway' },
  { code: '+45',   iso: 'DK', flag: '🇩🇰', name: 'Denmark' },
  { code: '+358',  iso: 'FI', flag: '🇫🇮', name: 'Finland' },
  { code: '+48',   iso: 'PL', flag: '🇵🇱', name: 'Poland' },
  { code: '+7',    iso: 'RU', flag: '🇷🇺', name: 'Russia' },
  { code: '+380',  iso: 'UA', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+30',   iso: 'GR', flag: '🇬🇷', name: 'Greece' },
  { code: '+420',  iso: 'CZ', flag: '🇨🇿', name: 'Czech Rep.' },
  { code: '+36',   iso: 'HU', flag: '🇭🇺', name: 'Hungary' },
  { code: '+40',   iso: 'RO', flag: '🇷🇴', name: 'Romania' },
  // Americas
  { code: '+1',    iso: 'US', flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+52',   iso: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+55',   iso: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+54',   iso: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57',   iso: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56',   iso: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+51',   iso: 'PE', flag: '🇵🇪', name: 'Peru' },
  { code: '+58',   iso: 'VE', flag: '🇻🇪', name: 'Venezuela' },
  // Africa
  { code: '+27',   iso: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: '+234',  iso: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254',  iso: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: '+233',  iso: 'GH', flag: '🇬🇭', name: 'Ghana' },
  { code: '+20',   iso: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: '+212',  iso: 'MA', flag: '🇲🇦', name: 'Morocco' },
  { code: '+216',  iso: 'TN', flag: '🇹🇳', name: 'Tunisia' },
  { code: '+213',  iso: 'DZ', flag: '🇩🇿', name: 'Algeria' },
  { code: '+255',  iso: 'TZ', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+260',  iso: 'ZM', flag: '🇿🇲', name: 'Zambia' },
  { code: '+263',  iso: 'ZW', flag: '🇿🇼', name: 'Zimbabwe' },
  // Oceania
  { code: '+61',   iso: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+64',   iso: 'NZ', flag: '🇳🇿', name: 'New Zealand' },
];

// Sort by code length descending so longer prefixes match first (e.g. +971 before +9)
const _sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

export function getPhoneInfo(phone: string | undefined | null) {
  if (!phone) return { iso: 'IN', code: '+91', flag: '🇮🇳', name: 'India', number: '', nationalNumber: '' };
  
  let cleanPhone = phone.trim();
  
  // Only assume Indian number if it's 10 digits AND starts with a valid Indian mobile prefix (6,7,8,9).
  // This prevents random/test numbers like 1234567898 from being wrongly tagged as India.
  if (/^[6-9]\d{9}$/.test(cleanPhone)) {
    cleanPhone = '+91' + cleanPhone;
  }
  
  // Match longest prefix first to avoid +1 capturing +1868 etc.
  const country = _sorted.find(c => cleanPhone.startsWith(c.code));
  
  return {
    // iso='' when unknown — callers should handle this by showing a generic icon
    iso:            country ? country.iso  : '',
    flag:           country ? country.flag : '🌐',
    name:           country ? country.name : 'Unknown',
    code:           country ? country.code : '',
    number:         cleanPhone,
    nationalNumber: country ? cleanPhone.slice(country.code.length).trim() : cleanPhone,
  };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
