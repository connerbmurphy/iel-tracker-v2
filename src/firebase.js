import { initializeApp } from 'firebase/app';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBGc1iWH_bQCBV5tMkCsX3pASx_CP6MEmA",
  authDomain: "iel-margin-tracker.firebaseapp.com",
  projectId: "iel-margin-tracker",
  storageBucket: "iel-margin-tracker.firebasestorage.app",
  messagingSenderId: "345700353726",
  appId: "1:345700353726:web:12e50df441cd5e8bee40ef"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, { persistence: browserLocalPersistence });
export const db = getFirestore(app);
