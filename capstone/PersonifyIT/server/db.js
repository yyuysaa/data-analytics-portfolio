/**
 * db.js — DynamoDB store for session data.
 *
 * Single table (PersonifyIT-Sessions), ONE record per session containing
 * everything together: email, rating, low-rating reason, and full transcript.
 *
 * Environment variables (DYNAMO_ prefix, separate from Bedrock creds):
 *   DYNAMO_ACCESS_KEY_ID, DYNAMO_SECRET_ACCESS_KEY, DYNAMO_SESSION_TOKEN (optional)
 *   DYNAMO_REGION, DYNAMO_TABLE_NAME
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// ─── Client setup ─────────────────────────────────────────────────────────────

const credentials = {
  accessKeyId: process.env.DYNAMO_ACCESS_KEY_ID,
  secretAccessKey: process.env.DYNAMO_SECRET_ACCESS_KEY,
  ...(process.env.DYNAMO_SESSION_TOKEN && {
    sessionToken: process.env.DYNAMO_SESSION_TOKEN,
  }),
};

const client = new DynamoDBClient({
  region: process.env.DYNAMO_REGION || 'us-west-2',
  credentials,
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMO_TABLE_NAME || 'PersonifyIT-Sessions';

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Save a complete session (rating + email + transcript — all in one record).
 *
 * @param {object} data
 * @param {string} [data.sessionId]       — use as the record id if provided
 * @param {string} data.agentId
 * @param {string} data.language
 * @param {string|null} data.email
 * @param {number} data.rating            — 1–5
 * @param {string|null} data.lowRatingReason
 * @param {Array} data.transcript          — [{ role, text, ts }]
 * @returns {object} the saved record
 */
export async function saveSession(data) {
  const record = {
    id: data.sessionId || randomUUID(),
    agentId: data.agentId || 'alex-it-support',
    language: data.language || 'en',
    email: data.email || null,
    rating: data.rating,
    lowRatingReason: data.lowRatingReason || null,
    transcript: data.transcript || [],
    createdAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: record }));
  console.log(`[db] session ${record.id} saved (rating=${record.rating}, email=${record.email ? 'yes' : 'none'}, msgs=${record.transcript.length})`);
  return record;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get sessions, optionally filtered by rating range.
 */
export async function getSessions(filters = {}) {
  const expressions = [];
  const exprValues = {};

  if (filters.minRating != null) {
    expressions.push('rating >= :minR');
    exprValues[':minR'] = filters.minRating;
  }
  if (filters.maxRating != null) {
    expressions.push('rating <= :maxR');
    exprValues[':maxR'] = filters.maxRating;
  }

  const params = { TableName: TABLE_NAME };
  if (expressions.length > 0) {
    params.FilterExpression = expressions.join(' AND ');
    params.ExpressionAttributeValues = exprValues;
  }

  const result = await docClient.send(new ScanCommand(params));
  const sessions = result.Items || [];
  sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sessions;
}
