// GET  /api/state  -> returns the current PersistedData JSON document plus its ETag.
// PUT  /api/state  -> writes a new PersistedData document. Callers must send the ETag
//                     they last read via the "If-Match" header; a mismatch (someone
//                     else saved in between) returns 412 so the client can reload
//                     instead of silently overwriting newer data.

import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import { getStateContainerClient, STATE_BLOB_NAME } from '../blobClient.js';
import { requireOwner } from '../auth.js';
import { RestError } from '@azure/storage-blob';

interface PersistedData {
  customers: unknown[];
  projects: unknown[];
  services: unknown[];
  entries: unknown[];
}

function isPersistedData(value: unknown): value is PersistedData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<PersistedData>;
  return Array.isArray(candidate.customers)
    && Array.isArray(candidate.projects)
    && (candidate.services === undefined || Array.isArray(candidate.services))
    && Array.isArray(candidate.entries);
}

const EMPTY_STATE: PersistedData = { customers: [], projects: [], services: [], entries: [] };

async function getState(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  const container = getStateContainerClient();
  const blob = container.getBlockBlobClient(STATE_BLOB_NAME);

  try {
    const download = await blob.download();
    const body = await streamToString(download.readableStreamBody);
    return {
      status: 200,
      headers: { ETag: download.etag ?? '', 'Content-Type': 'application/json' },
      body,
    };
  } catch (error) {
    if (error instanceof RestError && error.statusCode === 404) {
      // No state saved yet: this is the first run for a fresh environment.
      return {
        status: 200,
        headers: { ETag: '', 'Content-Type': 'application/json' },
        jsonBody: EMPTY_STATE,
      };
    }
    context.error('Failed to read state blob', error);
    return { status: 500, jsonBody: { message: 'Failed to read state.' } };
  }
}

async function putState(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  if (!requireOwner(request)) {
    return { status: 401, jsonBody: { message: 'Not authenticated.' } };
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { status: 400, jsonBody: { message: 'Body must be valid JSON.' } };
  }

  if (!isPersistedData(payload)) {
    return { status: 400, jsonBody: { message: 'Body must contain customers[], projects[], services[]?, entries[].' } };
  }

  const ifMatch = request.headers.get('if-match');
  const container = getStateContainerClient();
  await container.createIfNotExists();
  const blob = container.getBlockBlobClient(STATE_BLOB_NAME);
  const content = JSON.stringify(payload, null, 2);

  try {
    const conditions = ifMatch ? { ifMatch } : ifMatch === '' ? {} : { ifNoneMatch: '*' };
    const result = await blob.upload(content, Buffer.byteLength(content), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
      conditions,
    });
    return { status: 200, headers: { ETag: result.etag ?? '' }, jsonBody: { ok: true } };
  } catch (error) {
    if (error instanceof RestError && (error.statusCode === 412 || error.statusCode === 409)) {
      return { status: 412, jsonBody: { message: 'State changed since you last loaded it. Reload and retry.' } };
    }
    context.error('Failed to write state blob', error);
    return { status: 500, jsonBody: { message: 'Failed to save state.' } };
  }
}

async function streamToString(stream: NodeJS.ReadableStream | undefined): Promise<string> {
  if (!stream) {
    return '';
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

app.http('getState', { methods: ['GET'], authLevel: 'anonymous', route: 'state', handler: getState });
app.http('putState', { methods: ['PUT'], authLevel: 'anonymous', route: 'state', handler: putState });
