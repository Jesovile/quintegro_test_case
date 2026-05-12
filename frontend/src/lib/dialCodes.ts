export interface DialCode {
  code: string
  label: string
}

// Compact list — covers the 5 mock-Google countries plus common extras.
// Each entry uses a unique dial code so the native <select> displays cleanly.
export const DIAL_CODES: DialCode[] = [
  { code: '+1', label: '+1 United States' },
  { code: '+44', label: '+44 United Kingdom' },
  { code: '+33', label: '+33 France' },
  { code: '+49', label: '+49 Germany' },
  { code: '+34', label: '+34 Spain' },
  { code: '+39', label: '+39 Italy' },
  { code: '+31', label: '+31 Netherlands' },
  { code: '+55', label: '+55 Brazil' },
  { code: '+52', label: '+52 Mexico' },
  { code: '+61', label: '+61 Australia' },
  { code: '+81', label: '+81 Japan' },
  { code: '+86', label: '+86 China' },
  { code: '+91', label: '+91 India' },
]

// Map free-form country names (and a couple of aliases) to their dial code.
const COUNTRY_TO_CODE: Record<string, string> = {
  'united states': '+1',
  'usa': '+1',
  'us': '+1',
  'canada': '+1',
  'united kingdom': '+44',
  'uk': '+44',
  'great britain': '+44',
  'france': '+33',
  'germany': '+49',
  'spain': '+34',
  'italy': '+39',
  'netherlands': '+31',
  'brazil': '+55',
  'mexico': '+52',
  'australia': '+61',
  'japan': '+81',
  'china': '+86',
  'india': '+91',
}

export const lookupDialCode = (country: string): string | undefined => {
  return COUNTRY_TO_CODE[country.trim().toLowerCase()]
}

export const parsePhone = (phone: string): { dial: string; local: string } => {
  const trimmed = phone.trim()
  const match = trimmed.match(/^(\+\d{1,4})\s*(.*)$/)
  if (match) {
    return { dial: match[1], local: match[2].replace(/\D/g, '') }
  }
  return { dial: '', local: trimmed.replace(/\D/g, '') }
}

export const formatPhone = (dial: string, local: string): string => {
  if (!dial) return local
  if (!local) return dial
  return `${dial} ${local}`
}
