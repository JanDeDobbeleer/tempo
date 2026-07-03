// Shared Azure Blob Storage client for the Tempo API.
// A single storage account backs two containers:
//   - "state": one JSON document (tempo.json) holding the whole app state.
//   - "attachments": files referenced by entries, keyed by "<entryId>/<attachmentId>-<fileName>".
//
// Auth to Storage uses a connection string in local dev and a managed identity
// (via DefaultAzureCredential) in Azure, selected automatically based on which
// app settings are present.

import { BlobServiceClient, StorageSharedKeyCredential, type ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

const STATE_CONTAINER = process.env.TEMPO_STATE_CONTAINER ?? 'state';
const ATTACHMENTS_CONTAINER = process.env.TEMPO_ATTACHMENTS_CONTAINER ?? 'attachments';
export const STATE_BLOB_NAME = 'tempo.json';

let cachedClient: BlobServiceClient | null = null;

export function getBlobServiceClient(): BlobServiceClient {
  if (cachedClient) {
    return cachedClient;
  }

  const connectionString = process.env.TEMPO_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    cachedClient = BlobServiceClient.fromConnectionString(connectionString);
    return cachedClient;
  }

  // Managed identity path: TEMPO_STORAGE_ACCOUNT_URL e.g. https://<account>.blob.core.windows.net
  const accountUrl = process.env.TEMPO_STORAGE_ACCOUNT_URL;
  if (!accountUrl) {
    throw new Error('Set TEMPO_STORAGE_CONNECTION_STRING or TEMPO_STORAGE_ACCOUNT_URL.');
  }

  cachedClient = new BlobServiceClient(accountUrl, new DefaultAzureCredential());
  return cachedClient;
}

export function getStateContainerClient(): ContainerClient {
  return getBlobServiceClient().getContainerClient(STATE_CONTAINER);
}

export function getAttachmentsContainerClient(): ContainerClient {
  return getBlobServiceClient().getContainerClient(ATTACHMENTS_CONTAINER);
}

// Used only for generating user-delegation SAS tokens when running with a
// managed identity. In local dev with a connection string, azurite's fixed
// shared key credential is used instead.
export function getSharedKeyCredential(): StorageSharedKeyCredential | null {
  const accountName = process.env.TEMPO_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.TEMPO_STORAGE_ACCOUNT_KEY;
  if (!accountName || !accountKey) {
    return null;
  }
  return new StorageSharedKeyCredential(accountName, accountKey);
}
