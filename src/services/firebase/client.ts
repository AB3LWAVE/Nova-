import { getApps, initializeApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  Firestore,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { getRemoteConfig, fetchAndActivate, getValue, RemoteConfig } from 'firebase/remote-config';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAI, GoogleAIBackend, AI } from 'firebase/ai';
import firebaseConfig from '../../../firebase-applet-config.json';

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

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/calendar.events',
];

type ConfigWithDb = typeof firebaseConfig & { firestoreDatabaseId?: string };
const config = firebaseConfig as ConfigWithDb;

const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(config);
export const auth = getAuth(app);
export const db: Firestore = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const firebaseAi: AI = getAI(app, { backend: new GoogleAIBackend() });

let remoteConfigInstance: RemoteConfig | null = null;
try {
  if (typeof window !== 'undefined') {
    remoteConfigInstance = getRemoteConfig(app);
    remoteConfigInstance.settings.minimumFetchIntervalMillis = 3600000;
    remoteConfigInstance.defaultConfig = {
      nova_hybrid_default_mode: 'automatic',
      nova_enable_verification: true,
      nova_hackathon_banner: 'Firebase #BuildHybridAI Hackathon Edition',
    };
  }
} catch {
  remoteConfigInstance = null;
}

export function initOptionalAppCheck() {
  if (typeof window === 'undefined') return null;
  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || config.recaptchaSiteKey;
  if (!siteKey) return null;
  try {
    return initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('App Check initialization skipped:', err);
    return null;
  }
}

export async function fetchNovaRemoteFlags(): Promise<{
  defaultRoutingMode: string;
  enableVerification: boolean;
  bannerText: string;
}> {
  if (!remoteConfigInstance) {
    return {
      defaultRoutingMode: 'automatic',
      enableVerification: true,
      bannerText: 'Firebase #BuildHybridAI Hackathon Edition',
    };
  }
  try {
    await fetchAndActivate(remoteConfigInstance);
    return {
      defaultRoutingMode: getValue(remoteConfigInstance, 'nova_hybrid_default_mode').asString() || 'automatic',
      enableVerification: getValue(remoteConfigInstance, 'nova_enable_verification').asBoolean(),
      bannerText: getValue(remoteConfigInstance, 'nova_hackathon_banner').asString() || 'NOVA AI Workspace',
    };
  } catch {
    return {
      defaultRoutingMode: 'automatic',
      enableVerification: true,
      bannerText: 'NOVA AI Workspace',
    };
  }
}

// Memory-only OAuth access token cache for Google Workspace APIs (never persisted to localStorage)
let cachedWorkspaceAccessToken: string | null = null;
let isSigningIn = false;

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceAccessToken;
}

export const googleProvider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  googleProvider.addScope(scope);
}

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string | null;
  idToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedWorkspaceAccessToken = credential?.accessToken ?? null;
    const idToken = await result.user.getIdToken();
    return {
      user: result.user,
      accessToken: cachedWorkspaceAccessToken,
      idToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signOutUser(): Promise<void> {
  cachedWorkspaceAccessToken = null;
  await firebaseSignOut(auth);
}

export function subscribeToAuth(
  onUser: (user: User | null, hasWorkspaceToken: boolean) => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedWorkspaceAccessToken = null;
    } else if (!isSigningIn && !cachedWorkspaceAccessToken) {
      // User session restored without fresh OAuth token; Workspace mutations will prompt re-auth
    }
    onUser(user, Boolean(cachedWorkspaceAccessToken));
  });
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      return { connected: false, error: 'Firestore client appears offline.' };
    }
    // Permission denied on /test/connection still proves server reachability
    return { connected: true };
  }
}

export async function saveUserProfileToFirestore(
  user: User,
  prefs: { routingMode: string; privacyPreference: string }
) {
  const path = `users/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        displayName: (user.displayName || user.email || 'NOVA User').slice(0, 120),
        email: user.email || '',
        routingMode: prefs.routingMode,
        privacyPreference: prefs.privacyPreference,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('Profile sync skipped or rejected by rules:', error);
  }
}

export async function saveConversationMetaToFirestore(
  uid: string,
  conv: {
    id: string;
    title: string;
    folder: string;
    pinned: boolean;
    archived: boolean;
    modelId: string;
    personaId: string;
    messageCount: number;
  }
) {
  const safeId = conv.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `conversations/${safeId}`;
  try {
    await setDoc(
      doc(db, 'conversations', safeId),
      {
        id: safeId,
        userId: uid,
        title: conv.title.slice(0, 160) || 'Untitled Conversation',
        folder: conv.folder.slice(0, 64) || 'General',
        pinned: conv.pinned,
        archived: conv.archived,
        modelId: conv.modelId.slice(0, 80),
        personaId: conv.personaId.slice(0, 80),
        messageCount: Math.max(0, Math.min(10000, conv.messageCount)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteConversationInFirestore(convId: string) {
  const safeId = convId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const path = `conversations/${safeId}`;
  try {
    await deleteDoc(doc(db, 'conversations', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserConversations(
  uid: string,
  onData: (items: Array<Record<string, unknown>>) => void
) {
  const path = 'conversations';
  const q = query(collection(db, 'conversations'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function uploadAssetToFirebaseStorage(
  uid: string,
  folder: 'documents' | 'images' | 'attachments',
  file: File
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageRef = ref(storage, `users/${uid}/${folder}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export { app };
