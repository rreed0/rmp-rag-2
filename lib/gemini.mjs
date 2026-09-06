const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.8-flash';
export const EMBEDDING_DIMENSION = 768;

const MAX_RETRIES = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  return apiKey;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelay(attempt) {
  const baseDelay = 1000 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 500);
  return baseDelay + jitter;
}

async function geminiRequest(model, method, body) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${GEMINI_API_BASE}/${model}:${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': getApiKey(),
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return response.json();
      }

      const details = await response.text();
      const error = new Error(
        `Gemini API request failed (${response.status}): ${details}`,
      );
      error.status = response.status;
      lastError = error;

      const shouldRetry =
        RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES;

      if (!shouldRetry) {
        throw error;
      }

      const delay = getRetryDelay(attempt);
      console.warn(
        `Gemini API returned ${response.status}. Retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})...`,
      );
      await sleep(delay);
    } catch (error) {
      if (error?.status) {
        if (!RETRYABLE_STATUS_CODES.has(error.status) || attempt >= MAX_RETRIES) {
          throw error;
        }

        lastError = error;
        continue;
      }

      lastError = error;

      if (attempt >= MAX_RETRIES) {
        throw error;
      }

      const delay = getRetryDelay(attempt);
      console.warn(
        `Gemini API network request failed. Retrying in ${delay}ms (${attempt + 1}/${MAX_RETRIES})...`,
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error('Gemini API request failed after retries.');
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
