// Self-check for src/i18n/strings.ts: run `node scripts/check-i18n.mjs` (Node 22.6+ strips the TS types).
// tsc already guarantees Hebrew has every key; this catches what tsc can't:
// mismatched {placeholders}, empty strings, and broken interpolation.
import assert from 'node:assert/strict';
import { en, he, format } from '../src/i18n/strings.ts';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

for (const key of Object.keys(en)) {
  assert.ok(he[key]?.trim(), `he.${key} is empty`);
  assert.equal(placeholders(he[key]), placeholders(en[key]), `placeholders differ in ${key}`);
  if (key.endsWith('_one')) assert.ok(`${key.slice(0, -4)}_other` in en, `${key} has no _other pair`);
}
assert.equal(Object.keys(he).length, Object.keys(en).length, 'he has extra keys');

assert.equal(format('{count} recipes', { count: 3 }), '3 recipes');
assert.equal(format('Step {n}…', { n: 2 }), 'Step 2…');
assert.equal(format('{missing} stays', {}), '{missing} stays');

console.log(`i18n ok: ${Object.keys(en).length} keys`);
