import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";

/* 
  -----------------------------------------------------------------------
  FIREBASE CONFIGURATION
  Uses environment variables via import.meta.env (Vite).
  These identifiers are safe to be public (security handled by Rules).
  -----------------------------------------------------------------------
*/
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

// Custom Error Class for Permissions
export class FirebasePermissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "FirebasePermissionError";
    }
}

// ERROR HELPER: Detailed logs for permission issues
export const handleFirestoreError = (error: any, context: string) => {
    if (error.code === 'permission-denied' || error.code === 'storage/unauthorized') {
        const msg = `Permission Denied in [${context}]. Database rules prevent this action.`;
        console.error(`%c🛑 ${msg}`, "color: red; font-weight: bold;");
        throw new FirebasePermissionError(msg);
    } else {
        console.error(`Firebase Error [${context}]:`, error);
        throw error;
    }
};
