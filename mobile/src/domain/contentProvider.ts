import type { LICENSES } from './packageV2';

type License = (typeof LICENSES)[number];

/**
 * External learning content, kept separate from PAVO-authored packages.
 * `body` is only present when the license allows PAVO to store a copy;
 * otherwise the item is a link to the provider's canonical page.
 */
export interface ExternalContentItem {
  providerId: string;
  externalId: string;
  title: string;
  canonicalUrl: string;
  authors: string[];
  license: License | 'Provider-Terms';
  attribution: string;
  updatedAt: string;
  gradeLevels: number[];
  subject: string;
  summary: string;
  body: string | null;
}

export interface ContentProvider {
  id: string;
  name: string;
  /** False until written content rights or API credentials are configured. */
  authorized: boolean;
  search(query: string, filter?: { gradeLevel?: number; subject?: string }): Promise<ExternalContentItem[]>;
}

const CACHEABLE_LICENSES = new Set<string>(['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0', 'CC0-1.0']);

export function canCache(item: Pick<ExternalContentItem, 'license'>): boolean {
  return CACHEABLE_LICENSES.has(item.license);
}

/** Drops any body the license does not let PAVO keep, so callers cannot cache it by accident. */
export function forStorage(item: ExternalContentItem): ExternalContentItem {
  return canCache(item) ? item : { ...item, body: null };
}

function matches(item: ExternalContentItem, query: string, filter: { gradeLevel?: number; subject?: string } = {}): boolean {
  const text = `${item.title} ${item.summary}`.toLocaleLowerCase();
  return (
    query
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((word) => text.includes(word)) &&
    (filter.gradeLevel === undefined || item.gradeLevels.includes(filter.gradeLevel)) &&
    (filter.subject === undefined || item.subject.toLocaleLowerCase() === filter.subject.toLocaleLowerCase())
  );
}

// Original PAVO demo content so development never depends on a third party.
const DEMO_ITEMS: ExternalContentItem[] = [
  {
    providerId: 'pavo-demo',
    externalId: 'plant-parts',
    title: 'Parts of a plant and what they do',
    canonicalUrl: 'https://pavo.invalid/demo/plant-parts',
    authors: ['PAVO demo team'],
    license: 'CC-BY-4.0',
    attribution: 'Original PAVO demo content, CC BY 4.0.',
    updatedAt: '2026-09-01T00:00:00.000Z',
    gradeLevels: [4, 5],
    subject: 'Science',
    summary: 'Roots take in water, stems carry it, and leaves make food using sunlight.',
    body: '# Parts of a plant\n\nRoots hold the plant and take in water. Stems carry water up. Leaves use sunlight to make food.',
  },
  {
    providerId: 'pavo-demo',
    externalId: 'fractions-halves',
    title: 'Halves and quarters',
    canonicalUrl: 'https://pavo.invalid/demo/fractions-halves',
    authors: ['PAVO demo team'],
    license: 'CC-BY-4.0',
    attribution: 'Original PAVO demo content, CC BY 4.0.',
    updatedAt: '2026-09-01T00:00:00.000Z',
    gradeLevels: [3, 4],
    subject: 'Mathematics',
    summary: 'Split a whole into two or four equal parts and name each part.',
    body: '# Halves and quarters\n\nA half is one of two equal parts. A quarter is one of four equal parts.',
  },
];

export function createMockProvider(items: ExternalContentItem[] = DEMO_ITEMS): ContentProvider {
  return {
    id: 'pavo-demo',
    name: 'PAVO demo library',
    authorized: true,
    search: async (query, filter) => items.filter((item) => matches(item, query, filter)),
  };
}

export interface KhanAcademyLink {
  id: string;
  title: string;
  url: string;
  updatedAt: string;
  gradeLevels: number[];
  subject: string;
  summary: string;
}

/**
 * Link-only adapter. PAVO has no Khan Academy partnership; this never scrapes
 * or stores lesson content. It lists outbound links from a catalog the school
 * is authorized to use (an official feed or a teacher-curated list) and stays
 * unauthorized, returning nothing, until such a catalog is supplied.
 */
export function createKhanAcademyLinkProvider(catalog: KhanAcademyLink[] | null): ContentProvider {
  const items: ExternalContentItem[] = (catalog ?? [])
    .filter((link) => /^https:\/\/(?:www\.)?khanacademy\.org\//.test(link.url))
    .map((link) => ({
      providerId: 'khan-academy',
      externalId: link.id,
      title: link.title,
      canonicalUrl: link.url,
      authors: ['Khan Academy'],
      license: 'Provider-Terms',
      attribution: 'From Khan Academy. Opens on khanacademy.org under its terms of service. Not PAVO content.',
      updatedAt: link.updatedAt,
      gradeLevels: link.gradeLevels,
      subject: link.subject,
      summary: link.summary,
      body: null,
    }));
  return {
    id: 'khan-academy',
    name: 'Khan Academy (links only)',
    authorized: catalog !== null,
    search: async (query, filter) => items.filter((item) => matches(item, query, filter)),
  };
}

export async function searchProviders(
  providers: ContentProvider[],
  query: string,
  filter?: { gradeLevel?: number; subject?: string },
): Promise<ExternalContentItem[]> {
  const results = await Promise.allSettled(providers.filter((provider) => provider.authorized).map((provider) => provider.search(query, filter)));
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value.map(forStorage) : []));
}
