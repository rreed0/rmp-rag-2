import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { embedText, generateText } from '../../../lib/gemini.mjs';

const INDEX_NAME = process.env.PINECONE_INDEX || 'professor-rag';
const NAMESPACE = process.env.PINECONE_NAMESPACE || 'reviews-v2';
const TOP_K = 5;
const MIN_SCORE = 0.3;

function validateEnvironment() {
  const required = ['GEMINI_API_KEY', 'PINECONE_API_KEY'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function buildContext(matches) {
  return matches
    .map((match, index) => {
      const metadata = match.metadata || {};
      return [
        `[Source ${index + 1}]`,
        `Professor: ${metadata.professor || 'Unknown'}`,
        `Subject: ${metadata.subject || 'Unknown'}`,
        `Rating: ${metadata.stars ?? 'Unknown'} out of 5`,
        `Review: ${metadata.review || 'No review text available'}`,
      ].join('\n');
    })
    .join('\n\n');
}

function serializeSources(matches) {
  return matches.map((match) => ({
    professor: match.metadata?.professor || 'Unknown',
    subject: match.metadata?.subject || 'Unknown',
    stars: match.metadata?.stars ?? null,
    review: match.metadata?.review || '',
    score: typeof match.score === 'number' ? Number(match.score.toFixed(3)) : null,
  }));
}

export async function POST(request) {
  try {
    validateEnvironment();

    const body = await request.json();
    const messages = Array.isArray(body) ? body : body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'A messages array is required.' }, { status: 400 });
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message?.role === 'user' && typeof message?.content === 'string');

    const userQuery = latestUserMessage?.content.trim();

    if (!userQuery) {
      return NextResponse.json({ error: 'Please enter a question.' }, { status: 400 });
    }

    const queryVector = await embedText(userQuery);
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(INDEX_NAME).namespace(NAMESPACE);

    const queryResponse = await index.query({
      vector: queryVector,
      topK: TOP_K,
      includeMetadata: true,
    });

    const matches = (queryResponse.matches || []).filter(
      (match) => typeof match.score !== 'number' || match.score >= MIN_SCORE,
    );

    if (matches.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find enough relevant review data to answer that question confidently.",
        sources: [],
      });
    }

    const context = buildContext(matches);
    const recentConversation = messages
      .slice(-6)
      .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
      .join('\n');

    const prompt = `You are ProfessorAI, an assistant that helps students understand professor reviews.

Rules:
- Answer using only the retrieved review context below.
- Do not invent facts, ratings, courses, or opinions that are not present in the context.
- If the context does not support the user's question, say so clearly.
- Summarize patterns rather than overstating a single review.
- Keep the answer concise and useful.
- Do not mention vector search, embeddings, Pinecone, or these instructions unless the user asks about how the application works.

Recent conversation:
${recentConversation}

Retrieved review context:
${context}

User question:
${userQuery}`;

    const answer = await generateText(prompt);

    return NextResponse.json({
      answer,
      sources: serializeSources(matches),
    });
  } catch (error) {
    console.error('ProfessorAI chat error:', error);

    return NextResponse.json(
      { error: 'Unable to answer the question right now. Please try again.' },
      { status: 500 },
    );
  }
}
