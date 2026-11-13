const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-US');
const date = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatNumber(value: number): string {
  return number.format(value);
}

/** Formats a field value for display, following its describe type. */
export function formatValue(type: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  switch (type) {
    case 'currency':
      return currency.format(Number(value));
    case 'int':
    case 'double':
      return number.format(Number(value));
    case 'percent':
      return `${number.format(Number(value))}%`;
    case 'date':
      return date.format(new Date(`${String(value)}T00:00:00Z`));
    case 'datetime':
      return dateTime.format(new Date(String(value)));
    case 'boolean':
      return value ? 'Yes' : 'No';
    default:
      return String(value);
  }
}
