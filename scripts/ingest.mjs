import { readFile } from 'node:fs/promises';
import { Pinecone } from '@pinecone-database/pinecone';
import {
  EMBEDDING_DIMENSION,
  embedText,
} from '../lib/gemini.mjs';

const INDEX_NAME = process.env.PINECONE_INDEX || 'professor-rag';
const NAMESPACE = process.env.PINECONE_NAMESPACE || 'reviews-v2';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable.');
}

const raw = await readFile(new URL('../reviews.json', import.meta.url), 'utf8');
const { reviews } = JSON.parse(raw);

if (!Array.isArray(reviews) || reviews.length === 0) {
  throw new Error('reviews.json does not contain any reviews.');
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const existingIndexes = await pinecone.listIndexes();
const indexExists = existingIndexes.indexes?.some((index) => index.name === INDEX_NAME);

if (!indexExists) {
  console.log(`Creating Pinecone index "${INDEX_NAME}"...`);
  await pinecone.createIndex({
    name: INDEX_NAME,
    dimension: EMBEDDING_DIMENSION,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: process.env.PINECONE_REGION || 'us-east-1',
      },
    },
  });

  console.log('Waiting for the index to become ready...');
  while (true) {
    const description = await pinecone.describeIndex(INDEX_NAME);
    if (description.status?.ready) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

const index = pinecone.index(INDEX_NAME).namespace(NAMESPACE);

console.log(`Embedding ${reviews.length} reviews...`);
const vectors = [];

for (const [position, review] of reviews.entries()) {
  const text = [
    `Professor: ${review.professor}`,
    `Subject: ${review.subject}`,
    `Rating: ${review.stars} out of 5`,
    `Review: ${review.review}`,
  ].join('\n');

  const values = await embedText(text);

  vectors.push({
    id: `review-${position + 1}`,
    values,
    metadata: {
      professor: review.professor,
      subject: review.subject,
      stars: review.stars,
      review: review.review,
    },
  });
}

await index.upsert(vectors);
console.log(`Upserted ${vectors.length} reviews into ${INDEX_NAME}/${NAMESPACE}.`);
