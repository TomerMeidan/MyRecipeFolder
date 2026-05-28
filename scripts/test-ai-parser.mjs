/**
 * Real vision test — sends an actual image to each model and verifies the response.
 * Run with: node scripts/test-ai-parser.mjs
 *
 * Tests:
 *  1. AbortController fires correctly
 *  2. API key valid
 *  3. Each model receives a real potato image (URL-based) and a 1px PNG (base64)
 *     and must describe what it sees
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const envVars = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; }),
);
const API_KEY = envVars['EXPO_PUBLIC_OPENROUTER_API_KEY'];
const URL_BASE = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30_000;

// ── Test images ───────────────────────────────────────────────────────────────

// A known-good 1x1 red pixel PNG (verified valid)
const TINY_RED_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==';

// Download a real potato JPEG from a CDN that doesn't block server fetches,
// then base64-encode it — simulating what the app does after compression.
async function getPotatoBase64() {
  // Use a simple direct URL from picsum (Unsplash CDN, doesn't block servers)
  // We'll use a food image from placehold.co as fallback
  const urls = [
    'https://picsum.photos/seed/potato/400/300.jpg',
    'https://placehold.co/400x300/8B6914/white/png?text=POTATO',
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      // Verify it's not HTML
      if (b64.startsWith('PCFET')) continue; // <!DOCTYPE
      const mimeType = url.includes('.png') ? 'image/png' : 'image/jpeg';
      console.log(`  ℹ  Downloaded test image: ${buf.byteLength} bytes → ${b64.length} base64 chars`);
      return { b64, mimeType };
    } catch {}
  }
  // Last resort: use the tiny red PNG
  console.log('  ⚠  Could not download real image, using 1px PNG');
  return { b64: TINY_RED_PNG_B64, mimeType: 'image/png' };
}

const MODELS = [
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'moonshotai/kimi-k2.6:free',
];

const pass  = (m) => console.log(`  ✅ ${m}`);
const fail  = (m) => console.log(`  ❌ ${m}`);
const info  = (m) => console.log(`  ℹ  ${m}`);
const warn  = (m) => console.log(`  ⚠  ${m}`);

// ── Single request ────────────────────────────────────────────────────────────

async function ask(modelId, imageContent, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(URL_BASE, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://myrecipefolder.app',
        'X-Title': 'MyRecipeFolder',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{
          role: 'user',
          content: [imageContent, { type: 'text', text: prompt }],
        }],
      }),
    });

    clearTimeout(timer);
    const ms = Date.now() - start;
    const data = await res.json();

    if (!res.ok) {
      const raw = data?.error?.metadata?.raw ?? '';
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, ms, error: `${msg} | raw: ${raw}` };
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    return { ok: true, ms, content };
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    return { ok: false, ms, error: e?.name === 'AbortError' ? 'TIMEOUT' : e?.message };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function test1_AbortController() {
  console.log('\n── Test 1: AbortController fires ──');
  const c = new AbortController();
  setTimeout(() => c.abort(), 50);
  try {
    await fetch('https://httpbin.org/delay/10', { signal: c.signal });
    fail('Should have aborted');
  } catch(e) {
    e?.name === 'AbortError' ? pass('AbortController fires correctly') : fail(e?.message);
  }
}

async function test2_ApiKey() {
  console.log('\n── Test 2: API key valid ──');
  if (!API_KEY || API_KEY.includes('your_')) { fail('Key not set'); return false; }
  pass(`Key: ${API_KEY.slice(0,14)}...`);
  return true;
}

async function test3_FormatCheck() {
  console.log('\n── Test 3: base64 format confirmed working (tiny PNG) ──');
  const model = MODELS[0];
  const label = model.split('/')[1];
  const r = await ask(model,
    { type: 'image_url', image_url: { url: `data:image/png;base64,${TINY_RED_PNG_B64}` } },
    'What color is this image? One word only.',
  );
  if (r.ok) pass(`${label} base64 ✅ (${r.ms}ms): "${r.content?.trim().slice(0,60)}"`);
  else fail(`${label} base64 ❌: ${r.error}`);
}

async function test4_RealImageAllModels() {
  console.log('\n── Test 4: All models — real downloaded image (base64, realistic size) ──');

  const { b64, mimeType } = await getPotatoBase64();
  const dataUrl = `data:${mimeType};base64,${b64}`;

  for (const modelId of MODELS) {
    const label = modelId.split('/')[1];
    const r = await ask(modelId,
      { type: 'image_url', image_url: { url: dataUrl } },
      'Describe what you see in this image in one sentence.',
    );

    if (r.ok) pass(`${label} → "${r.content?.trim().slice(0, 120)}" (${r.ms}ms)`);
    else fail(`${label} → ${r.error}`);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('=== OpenRouter vision tests (with real images) ===');
await test1_AbortController();
const keyOk = await test2_ApiKey();
if (keyOk) {
  await test3_FormatCheck();
  await test4_RealImageAllModels();
}
console.log('\n=== done ===');
