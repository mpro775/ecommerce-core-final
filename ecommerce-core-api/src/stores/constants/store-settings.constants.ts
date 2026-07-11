export const STORE_CURRENCY_CODES = [
  'YER',
  'SAR',
  'USD',
  'AED',
  'OMR',
  'QAR',
  'KWD',
  'BHD',
  'EUR',
  'GBP',
] as const;

export const STORE_TIMEZONES = [
  'Asia/Aden',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Africa/Cairo',
  'Europe/Istanbul',
  'UTC',
] as const;

export const DEFAULT_STORE_COUNTRY = 'اليمن';

export const YEMEN_GOVERNORATES = [
  'أمانة العاصمة',
  'عدن',
  'تعز',
  'لحج',
  'أبين',
  'الضالع',
  'إب',
  'الحديدة',
  'حجة',
  'المحويت',
  'ريمة',
  'ذمار',
  'صنعاء',
  'عمران',
  'صعدة',
  'الجوف',
  'مأرب',
  'شبوة',
  'حضرموت',
  'المهرة',
  'سقطرى',
  'البيضاء',
] as const;

export const STORE_WORKING_DAYS = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

export const STORE_SOCIAL_LINK_KEYS = [
  'instagram',
  'facebook',
  'x',
  'tiktok',
  'snapchat',
  'whatsapp',
  'telegram',
  'youtube',
  'website',
] as const;

export const STORE_BUSINESS_CATEGORIES = [
  'beauty',
  'fashion',
  'abayas',
  'electronics',
  'books_stationery',
  'kids_toys',
  'furniture_decor',
  'health_wellness',
  'other',
] as const;

export const STORE_LANGUAGES = ['ar', 'en'] as const;

export const CURRENCY_SYMBOL_POSITIONS = ['before', 'after'] as const;

export const CURRENCY_PRICING_MODES = ['fixed', 'exchange_rate'] as const;

export const ORDER_CONFIRMATION_MODES = ['automatic', 'manual'] as const;

export const STOCK_DEDUCTION_TIMINGS = ['creation', 'confirmation'] as const;

export const WAREHOUSE_SELECTION_MODES = ['automatic', 'manual', 'priority'] as const;

export const TAX_PRICE_MODES = ['inclusive', 'exclusive'] as const;
