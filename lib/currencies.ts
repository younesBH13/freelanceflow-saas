export const currencyOptions = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
]

export const getCurrencyLabel = (code?: string | null) =>
  currencyOptions.find((option) => option.code === code)?.label || code || 'USD'
