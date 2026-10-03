import { describe, expect, it } from '@jest/globals';
import {
  canCache,
  createKhanAcademyLinkProvider,
  createMockProvider,
  searchProviders,
  type ContentProvider,
} from '../src/domain/contentProvider';
import { redactPersonalData } from '../supabase/functions/pavo-companion/redact';

const khanLink = {
  id: 'photosynthesis',
  title: 'Photosynthesis overview',
  url: 'https://www.khanacademy.org/science/photosynthesis',
  updatedAt: '2026-08-01T00:00:00.000Z',
  gradeLevels: [5],
  subject: 'Science',
  summary: 'How plants make food.',
};

describe('content providers', () => {
  it('serves original demo content offline with attribution', async () => {
    const [item] = await searchProviders([createMockProvider()], 'plant', { gradeLevel: 5 });
    expect(item?.providerId).toBe('pavo-demo');
    expect(item?.body).toContain('Leaves');
    expect(item?.attribution).toMatch(/CC BY 4.0/);
  });

  it('keeps Khan Academy link-only, attributed, and off until a catalog is authorized', async () => {
    expect(await searchProviders([createKhanAcademyLinkProvider(null)], 'plants')).toEqual([]);
    const items = await searchProviders(
      [createKhanAcademyLinkProvider([khanLink, { ...khanLink, id: 'scraped', url: 'https://copy.example/photosynthesis' }])],
      'plants',
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ body: null, canonicalUrl: khanLink.url, authors: ['Khan Academy'] });
    expect(items[0]?.attribution).toMatch(/Not PAVO content/);
    expect(canCache(items[0]!)).toBe(false);
  });

  it('strips bodies whose license does not allow caching and survives a failing provider', async () => {
    const restricted: ContentProvider = createMockProvider([
      { ...(await createMockProvider().search('plant'))[0]!, license: 'All-Rights-Reserved' },
    ]);
    const broken: ContentProvider = { id: 'down', name: 'Down', authorized: true, search: () => Promise.reject(new Error('offline')) };
    const [item] = await searchProviders([restricted, broken], 'plant');
    expect(item?.body).toBeNull();
  });
});

describe('AI context redaction', () => {
  it('removes contact details and ID numbers before text reaches the model', () => {
    const text = 'Ana (LRN 123456789012) mama ana@example.com 0917 123 4567 or +639171234567 scored 8/10';
    const redacted = redactPersonalData(text);
    expect(redacted).not.toMatch(/123456789012|ana@example\.com|0917|639171234567/);
    expect(redacted).toContain('[email]');
    expect(redacted).toContain('scored 8/10');
  });
});
