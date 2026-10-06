import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();

/**
 * Backend database operations persist directly in our primary database via Drizzle ORM.
 * Client-side Firestore operations use the authenticated Firebase client SDK.
 * We keep this helper as a safe no-op on the server so unprivileged container
 * service accounts never trigger 7 PERMISSION_DENIED errors in server logs.
 */
export async function syncDocToFirestore(
  _collectionName: string,
  _docId: string | number,
  _payload: Record<string, any>,
  _isNew = false
) {
  return;
}

export async function deleteDocFromFirestore(
  _collectionName: string,
  _docId: string | number
) {
  return;
}
