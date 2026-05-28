/**
 * Quick integration test for the OpenRouter model rotation.
 * Run with: node scripts/test-ai-parser.mjs
 *
 * Tests:
 *  1. API key is valid (auth check)
 *  2. Each vision model responds without response_format
 *  3. AbortController fires after TIMEOUT_MS
 *  4. JSON can be parsed from the raw response
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim())),
);
const API_KEY = envVars['EXPO_PUBLIC_OPENROUTER_API_KEY'];
const URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30_000;

const VISION_MODELS = [
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', label: 'Nemotron 30B Reasoning' },
  { id: 'google/gemma-4-31b-it:free',                         label: 'Gemma 4 31B' },
  { id: 'moonshotai/kimi-k2.6:free',                          label: 'Kimi K2.6' },
  { id: 'google/gemma-4-26b-a4b-it:free',                     label: 'Gemma 4 26B' },
];

// ── helpers ──────────────────────────────────────────────────────────────────

const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);
const info = (msg) => console.log(`  ℹ  ${msg}`);

async function testModel(model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(URL, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'https://myrecipefolder.app',
        'X-Title': 'MyRecipeFolder',
      },
      body: JSON.stringify({
        model: model.id,
        // No response_format — same as our app after the fix
        messages: [
          {
            role: 'system',
            content: 'Return ONLY a valid JSON object: {"hello": "world"}. No markdown, no explanation.',
          },
          { role: 'user', content: 'Say hello as JSON.' },
        ],
      }),
    });

    clearTimeout(timer);
    const ms = Date.now() - start;

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      fail(`${model.label} — HTTP ${res.status}: ${err?.error?.message ?? 'unknown'} (${ms}ms)`);
      return false;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) {
      fail(`${model.label} — empty response (${ms}ms)`);
      return false;
    }

    // Try to parse JSON from the response
    try {
      const stripped = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      JSON.parse(stripped);
      pass(`${model.label} — responded + valid JSON (${ms}ms)`);
      return true;
    } catch {
      info(`${model.label} — responded but non-JSON content: ${content.slice(0, 80)} (${ms}ms)`);
      return false;
    }
  } catch (e) {
    clearTimeout(timer);
    const ms = Date.now() - start;
    if (e?.name === 'AbortError') {
      fail(`${model.label} — TIMED OUT after ${ms}ms`);
    } else {
      fail(`${model.label} — ${e?.message ?? e} (${ms}ms)`);
    }
    return false;
  }
}

// ── TEST: AbortController fires correctly ─────────────────────────────────────

async function testAbortController() {
  console.log('\n── Test 1: AbortController timeout fires ──');
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100); // 100ms — guaranteed timeout

  try {
    await fetch('https://httpbin.org/delay/5', { signal: controller.signal });
    fail('AbortController did NOT fire — this should have timed out');
  } catch (e) {
    if (e?.name === 'AbortError') {
      pass('AbortController fired correctly after 100ms');
    } else {
      fail(`Unexpected error: ${e?.message}`);
    }
  }
}

// ── TEST: API key validity ────────────────────────────────────────────────────

async function testApiKey() {
  console.log('\n── Test 2: API key validity ──');
  if (!API_KEY || API_KEY === 'your_openrouter_api_key_here') {
    fail('EXPO_PUBLIC_OPENROUTER_API_KEY not set in .env');
    return false;
  }
  pass(`Key found: ${API_KEY.slice(0, 12)}...`);
  return true;
}

// ── TEST: Each model responds ─────────────────────────────────────────────────

async function testModels() {
  console.log('\n── Test 3: Each model (text-only, no image) ──');
  info('Skipping image — this tests JSON output + API availability per model');
  let passed = 0;
  for (const model of VISION_MODELS) {
    const ok = await testModel(model);
    if (ok) passed++;
  }
  console.log(`\n  ${passed}/${VISION_MODELS.length} models passed`);
  return passed > 0;
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('=== aiParser integration tests ===');
await testAbortController();
const keyOk = await testApiKey();
if (keyOk) await testModels();
console.log('\n=== done ===');
