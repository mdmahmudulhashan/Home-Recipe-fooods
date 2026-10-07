import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

// Always use the provisioned Firebase project `storied-tine-xz0s9`
// (`ai-studio-b4dc5539-9253-4b65-a3c3-da3fa3998007`) as the single source of truth,
// preventing any mismatched VITE_FIREBASE_* environment variables on Netlify from overriding it.
const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
  firestoreDatabaseId: appletConfig.firestoreDatabaseId,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// ============================================================================
// Mandatory Firestore Error Handler (Skill Section 3)
// ============================================================================
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ============================================================================
// Connection Validation on Authenticated Session (Skill Section 1)
// ============================================================================
auth.onAuthStateChanged(async (fbUser) => {
  if (!fbUser) return;
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    // Ignore permission-denied on unconfigured probe docs; only warn if truly misconfigured
    if (
      error instanceof Error &&
      error.message.includes('projectId')
    ) {
      console.warn('Firebase configuration warning:', error.message);
    }
  }
});

// ============================================================================
// Firebase Storage Helper for Employee Profile Photos (Requirement 4)
// Structure: employee-photos/{employeeId}/profile.jpg
// ============================================================================
export async function uploadEmployeePhotoToStorage(
  employeeCode: string,
  dataUrl: string
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  const cleanCode = employeeCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `employee-photos/${cleanCode}/profile.jpg`;
  const photoRef = ref(storage, storagePath);

  try {
    await uploadString(photoRef, dataUrl, 'data_url');
    const downloadUrl = await getDownloadURL(photoRef);
    return downloadUrl;
  } catch (err) {
    console.warn('Direct Firebase Storage upload fallback:', err);
    return dataUrl;
  }
}

export async function deleteEmployeePhotoFromStorage(employeeCode: string) {
  try {
    const cleanCode = employeeCode.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `employee-photos/${cleanCode}/profile.jpg`;
    const photoRef = ref(storage, storagePath);
    await deleteObject(photoRef);
  } catch {
    // Ignore if file didn't exist in storage
  }
}

export {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
};
