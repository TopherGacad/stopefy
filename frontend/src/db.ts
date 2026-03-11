import { openDB, IDBPDatabase } from 'idb';
import type { DownloadedTrack, Track } from './types';

const DB_NAME = 'stopefy-offline';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded-tracks';

async function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
      }
    },
  });
}

export async function saveTrackOffline(trackId: number, audioBlob: Blob, metadata: Track): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { trackId, audioBlob, metadata, downloadedAt: Date.now() });
}

export async function getOfflineTrack(trackId: number): Promise<DownloadedTrack | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, trackId);
}

export async function removeOfflineTrack(trackId: number): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, trackId);
}

export async function getAllOfflineTracks(): Promise<DownloadedTrack[]> {
  const db = await getDB();
  return db.getAll(STORE_NAME);
}

export async function isTrackDownloaded(trackId: number): Promise<boolean> {
  const db = await getDB();
  const track = await db.get(STORE_NAME, trackId);
  return !!track;
}

export async function getOfflineStorageUsage(): Promise<{ count: number; sizeBytes: number }> {
  const tracks = await getAllOfflineTracks();
  const sizeBytes = tracks.reduce((sum, t) => sum + (t.audioBlob?.size || 0), 0);
  return { count: tracks.length, sizeBytes };
}
