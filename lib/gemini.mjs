const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-3.8-flash';
export const FALLBACK_CHAT_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
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

function parseGeminiError(status, details) {
  let parsed;

  try {
    parsed = JSON.parse(details);
  } catch {
    parsed = null;
  }

  const error = new Error(
    `Gemini API request failed (${status}): ${details}`,
  );
  error.status = status;

  const violations = parsed?.error?.details
    ?.filter((detail) => detail?.['@type']?.includes('QuotaFailure'))
    ?.flatMap((detail) => detail.violations || []) || [];

  const dailyQuotaExceeded = violations.some(
    (violation) =>
      violation?.quotaId?.includes('RequestsPerDay') ||
      violation?.quotaId?.includes('GenerateRequestsPerDayPerProjectPerModel'),
  );

  if (dailyQuotaExceeded) {
    error.code = 'DAILY_QUOTA_EXHAUSTED';
  }

  return error;
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
      const error = parseGeminiError(response.status, details);
      lastError = error;

      if (error.code === 'DAILY_QUOTA_EXHAUSTED') {
        throw error;
      }

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
      if (error?.code === 'DAILY_QUOTA_EXHAUSTED') {
        throw error;
      }

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

async function generateWithModel(model, prompt) {
  const data = await geminiRequest(model, 'generateContent', {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1200,
      thinkingConfig: {
        thinkingLevel: 'LOW',
      },
    },
  });

  const candidate = data?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`Gemini response ended unexpectedly (${candidate.finishReason}).`);
  }

  return text;
}

export async function generateText(prompt) {
  try {
    return await generateWithModel(CHAT_MODEL, prompt);
  } catch (error) {
    const canFallback =
      error?.code === 'DAILY_QUOTA_EXHAUSTED' &&
      FALLBACK_CHAT_MODEL &&
      FALLBACK_CHAT_MODEL !== CHAT_MODEL;

    if (!canFallback) {
      throw error;
    }

    console.warn(
      `${CHAT_MODEL} daily quota exhausted. Falling back to ${FALLBACK_CHAT_MODEL}.`,
    );

    try {
      return await generateWithModel(FALLBACK_CHAT_MODEL, prompt);
    } catch (fallbackError) {
      if (fallbackError?.code === 'DAILY_QUOTA_EXHAUSTED') {
        fallbackError.code = 'ALL_CHAT_QUOTAS_EXHAUSTED';
      }
      throw fallbackError;
    }
  }
}
