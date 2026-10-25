import { describe, expect, test } from 'vitest';
import { copy } from '@/content/copy';

describe('the copy', () => {
  test('copy keeps the pinned labels, the disclaimer, the author line and the image credits', () => {
    expect(copy.aisle.pickForMe).toBe('Pick for me');
    expect(copy.seated).toMatchObject({ choose: 'Choose this seat', another: 'See another' });
    expect(copy.pass.change).toBe('Change seat');
    expect(copy.outro).toMatchObject({ name: 'Name', email: 'E-mail', comment: 'Comment', buy: 'Buy', restart: 'Start again' });
    expect(copy.outro.thanks).toMatch(/concept/);
    expect(copy.footer.disclaimer).toMatch(/fictional/);
    expect(copy.outro.made.lead).toMatch(/Web Audio/);
    expect(copy.author.line).toBe('Concept & code: Aslanov Rustam');
    expect(`${copy.footer.sky.line} · ${copy.footer.sky.licence} · ${copy.footer.sky.clouds}`).toBe('Milky Way: ESO/S. Brunier, adapted · CC BY 4.0 · Clouds: NASA');
  });

  test('the share card speaks the site\u2019s calm tone: the brand, a concept, no exclamations', () => {
    expect(copy.meta.title).toMatch(/^AslanAir/);
    expect(copy.meta.description).toMatch(/concept/i);
    for (const s of [copy.meta.title, copy.meta.description]) expect(s).not.toMatch(/!/);
  });
});
