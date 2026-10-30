/** Free-text destinations that mean the same catalog. Keys are already slugified. */
const ALIASES: Record<string, string> = {
  rio: 'rio-de-janeiro',
  rj: 'rio-de-janeiro',
  'rio-rj': 'rio-de-janeiro',
  'rio-de-janeiro-rj': 'rio-de-janeiro',
  'rio-de-janeiro-capital': 'rio-de-janeiro',
};

/** "Florianópolis, SC" → "florianopolis-sc"; empty when there is nothing to key on. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Catalog key for a trip's destination, or null when the trip has none. */
export function destinationKey(destination?: string | null): string | null {
  const slug = slugify(destination ?? '');
  if (!slug) return null;
  return ALIASES[slug] ?? slug;
}
