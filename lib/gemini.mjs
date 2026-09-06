const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.7-flash';
export const EMBEDDING_DIMENSION = 768;

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  return apiKey;
}

async function geminiRequest(model, method, body) {
  const response = await fetch(`${GEMINI_API_BASE}/${model}:${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': getApiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Gemini API request failed (${response.status}): ${details}`);
  }

  return response.json();
}

export async function embedText(text) {
  const data = await geminiRequest(EMBEDDING_MODEL, 'embedContent', {
    content: {
      parts: [{ text }],
    },
    output_dimensionality: EMBEDDING_DIMENSION,
  });

  const values = data?.embedding?.values;

  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected a ${EMBEDDING_DIMENSION}-dimension embedding, received ${values?.length ?? 'none'}.`,
    );
  }

  return values;
}

export async function generateText(prompt) {
  const data = await geminiRequest(CHAT_MODEL, 'generateContent', {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 500,
    },
  });

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}
