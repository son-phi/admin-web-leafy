import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import { environment } from './environment';

const env = import.meta.env;
const useEmulators = environment.kind === 'emulator' || (environment.kind === 'dev' && env.VITE_USE_EMULATORS === 'true');
const projectId = env.VITE_FIREBASE_PROJECT_ID;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  projectId,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  appId: env.VITE_FIREBASE_APP_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
});

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, env.VITE_FUNCTIONS_REGION || 'us-central1');
export const storage = getStorage(app);
export const rtdb = getDatabase(app);

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
}
