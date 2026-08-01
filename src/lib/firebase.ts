import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD754gAr8aOjZfbMlWcPbVIUcoxcTb5ebw',
  authDomain: 'tripledger-app.firebaseapp.com',
  projectId: 'tripledger-app',
  storageBucket: 'tripledger-app.firebasestorage.app',
  messagingSenderId: '810723866045',
  appId: '1:810723866045:web:4ea4f961bdf2e7e0620ed4',
};

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
