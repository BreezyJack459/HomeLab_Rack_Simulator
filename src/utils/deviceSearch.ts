import type { DeviceCategory, DeviceTemplate } from '../types/rack';

const categoryAliases: Partial<Record<DeviceCategory, string[]>> = {
  'mini-pc': ['mini computer'],
  'access-point': ['wireless ap', 'wifi ap'],
  nas: ['network attached storage'],
  ups: ['uninterruptible power supply'],
  pdu: ['power distribution unit'],
  'pdu-0u': ['power distribution unit', 'vertical pdu'],
  sbc: ['single board computer'],
  'printed-mount': ['3d printed', '3d printed mount'],
};

const normalize = (text: string): string => text.normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const compact = (text: string): string => text.replace(/ /g, '');

/** Lower ranks are more relevant; null means that not every search term matched. */
export const getDeviceSearchRank = (
  device: Pick<DeviceTemplate, 'id' | 'name' | 'category' | 'description'>,
  query: string,
  categoryLabel: string = device.category,
): number | null => {
  const search = normalize(query);
  if (!search) return 0;
  const name = normalize(device.name);
  const terms = search.split(' ');
  const categories = [device.category, categoryLabel, ...(categoryAliases[device.category] ?? [])].map(normalize);
  const contains = (text: string): boolean => terms.every(term => text.includes(term)) || compact(text).includes(compact(search));

  if ([name, normalize(device.id)].some(text => compact(text) === compact(search))) return 0;
  // A category query should show its devices before accessories mentioning them.
  if (categories.some(text => compact(text) === compact(search))) return 1;
  if (contains(name)) return 2;
  if (categories.some(contains)) return 3;
  if (contains([name, ...categories, normalize(device.description ?? '')].join(' '))) return 4;
  return null;
};
