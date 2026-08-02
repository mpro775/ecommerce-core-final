const dateTimeFormatter = new Intl.DateTimeFormat('ar-YE', {
  timeZone: 'Asia/Aden',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatCommercialDate(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatCommercialMoney(amount: string, currency: string): string {
  return `${amount} ${currency}`;
}

export function newIdempotencyKey(scope: string): string {
  return `${scope}-${crypto.randomUUID()}`;
}
