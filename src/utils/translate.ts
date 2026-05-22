const BASE = 'https://translation.googleapis.com/language/translate/v2';

export async function detectLanguage(text: string, apiKey: string): Promise<string> {
  const response = await fetch(`${BASE}/detect?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text.slice(0, 500) }),
  });

  if (!response.ok) {
    throw new Error(`Language detect error ${response.status}`);
  }

  const data = await response.json();
  return data.data?.detections?.[0]?.[0]?.language ?? 'und';
}

export async function translateText(text: string, apiKey: string, targetLang = 'en'): Promise<string> {
  const response = await fetch(`${BASE}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target: targetLang, format: 'text' }),
  });

  if (!response.ok) {
    throw new Error(`Translate API error ${response.status}`);
  }

  const data = await response.json();
  return data.data?.translations?.[0]?.translatedText ?? text;
}
