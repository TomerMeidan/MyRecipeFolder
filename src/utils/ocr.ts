const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

export async function extractTextFromImage(
  base64Image: string,
  apiKey: string,
  languageHints: string[] = [],
): Promise<string> {
  const request: Record<string, unknown> = {
    image: { content: base64Image },
    features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
  };

  if (languageHints.length > 0) {
    request.imageContext = { languageHints };
  }

  const response = await fetch(`${VISION_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [request] }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Vision API error ${response.status}`);
  }

  const data = await response.json();
  return (data.responses?.[0]?.fullTextAnnotation?.text ?? '').trim();
}
