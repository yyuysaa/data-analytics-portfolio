/**
 * storage/s3-archive.js — Archive full session transcripts to Amazon S3.
 *
 * DynamoDB holds the queryable session metadata; S3 holds the full transcript
 * as a JSON object for cheap long-term archival. Best-effort and non-fatal —
 * if S3 isn't configured or the upload fails, the session still saves fine.
 *
 * Uses the DYNAMO_ credentials (your own AWS account, same as DynamoDB).
 *
 * Environment variables:
 *   DYNAMO_ACCESS_KEY_ID, DYNAMO_SECRET_ACCESS_KEY, DYNAMO_SESSION_TOKEN (optional)
 *   DYNAMO_REGION
 *   S3_ARCHIVE_BUCKET — bucket name (archival is skipped if unset)
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.S3_ARCHIVE_BUCKET || '';

const credentials = {
  accessKeyId: process.env.DYNAMO_ACCESS_KEY_ID,
  secretAccessKey: process.env.DYNAMO_SECRET_ACCESS_KEY,
  ...(process.env.DYNAMO_SESSION_TOKEN && {
    sessionToken: process.env.DYNAMO_SESSION_TOKEN,
  }),
};

const s3 = new S3Client({
  region: process.env.DYNAMO_REGION || 'us-west-2',
  credentials,
});

/**
 * Archive a full session record to S3 as JSON.
 * Key layout: sessions/YYYY-MM-DD/<sessionId>.json
 *
 * @param {object} record — the full session record (from saveSession)
 */
export async function archiveSession(record) {
  if (!BUCKET) {
    // Archival not configured — skip silently.
    return;
  }

  const date = (record.createdAt || new Date().toISOString()).slice(0, 10);
  const key = `sessions/${date}/${record.id}.json`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(record, null, 2),
        ContentType: 'application/json',
      })
    );
    console.log(`[s3] archived session ${record.id} → s3://${BUCKET}/${key}`);
  } catch (err) {
    console.error('[s3] archive failed (non-fatal):', err.message);
  }
}
