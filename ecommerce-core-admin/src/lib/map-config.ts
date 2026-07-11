export const MAP_TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL?.trim() ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAP_TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const MAP_TILE_SUBDOMAINS = ['a', 'b', 'c'];

export interface MapSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

const YEMEN_LOCATIONS: Array<MapSearchResult & { keywords: string[] }> = [
  { display_name: 'التحرير، أمانة العاصمة، اليمن', lat: '15.3547', lon: '44.2070', keywords: ['التحرير', 'tahrir', 'sanaa'] },
  { display_name: 'أمانة العاصمة، اليمن', lat: '15.3694', lon: '44.1910', keywords: ['امانة العاصمة', 'أمانة العاصمة', 'صنعاء القديمة', 'sanaa'] },
  { display_name: 'صنعاء، اليمن', lat: '15.3169', lon: '44.4748', keywords: ['صنعاء', 'sana'] },
  { display_name: 'عدن، اليمن', lat: '12.7855', lon: '45.0187', keywords: ['عدن', 'aden'] },
  { display_name: 'تعز، اليمن', lat: '13.5795', lon: '44.0209', keywords: ['تعز', 'taiz'] },
  { display_name: 'إب، اليمن', lat: '13.9667', lon: '44.1833', keywords: ['اب', 'إب', 'ibb'] },
  { display_name: 'الحديدة، اليمن', lat: '14.7978', lon: '42.9545', keywords: ['الحديدة', 'hodeidah'] },
  { display_name: 'حضرموت، اليمن', lat: '15.9430', lon: '48.7873', keywords: ['حضرموت', 'المكلا', 'hadramout', 'mukalla'] },
  { display_name: 'مأرب، اليمن', lat: '15.4701', lon: '45.3229', keywords: ['مارب', 'مأرب', 'marib'] },
  { display_name: 'ذمار، اليمن', lat: '14.5427', lon: '44.4051', keywords: ['ذمار', 'dhamar'] },
  { display_name: 'لحج، اليمن', lat: '13.0582', lon: '44.8838', keywords: ['لحج', 'lahij'] },
  { display_name: 'أبين، اليمن', lat: '13.6343', lon: '46.0563', keywords: ['ابين', 'أبين', 'abyan'] },
  { display_name: 'الضالع، اليمن', lat: '13.6957', lon: '44.7314', keywords: ['الضالع', 'dhale'] },
  { display_name: 'حجة، اليمن', lat: '15.6943', lon: '43.6058', keywords: ['حجة', 'hajjah'] },
  { display_name: 'المحويت، اليمن', lat: '15.4701', lon: '43.5448', keywords: ['المحويت', 'mahweet'] },
  { display_name: 'ريمة، اليمن', lat: '14.6333', lon: '43.6667', keywords: ['ريمة', 'raymah'] },
  { display_name: 'عمران، اليمن', lat: '15.6594', lon: '43.9439', keywords: ['عمران', 'amran'] },
  { display_name: 'صعدة، اليمن', lat: '16.9402', lon: '43.7639', keywords: ['صعدة', 'saada'] },
  { display_name: 'الجوف، اليمن', lat: '16.5975', lon: '44.7222', keywords: ['الجوف', 'jawf'] },
  { display_name: 'شبوة، اليمن', lat: '14.5300', lon: '46.8319', keywords: ['شبوة', 'shabwa'] },
  { display_name: 'المهرة، اليمن', lat: '16.2079', lon: '52.1760', keywords: ['المهرة', 'mahra'] },
  { display_name: 'سقطرى، اليمن', lat: '12.4634', lon: '53.8237', keywords: ['سقطرى', 'socotra'] },
  { display_name: 'البيضاء، اليمن', lat: '14.3589', lon: '45.4498', keywords: ['البيضاء', 'bayda'] },
];

export function searchYemenLocations(query: string): MapSearchResult[] {
  const normalizedQuery = normalizeArabicSearch(query);
  if (!normalizedQuery) {
    return [];
  }

  return YEMEN_LOCATIONS.filter((location) => {
    const haystack = normalizeArabicSearch([location.display_name, ...location.keywords].join(' '));
    return haystack.includes(normalizedQuery) || normalizedQuery.includes(haystack);
  }).slice(0, 6);
}

function normalizeArabicSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ');
}
