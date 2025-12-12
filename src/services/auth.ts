import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

/* 
  -----------------------------------------------------------------------
  AUTH SERVICE
  Handles Login for the Admin
  -----------------------------------------------------------------------
*/
export const AuthService = {
    login: async (email: string, pass: string) => {
        return await signInWithEmailAndPassword(auth, email, pass);
    },
    loginWithGoogle: async () => {
        return await signInWithPopup(auth, googleProvider);
    },
    logout: async () => {
        return await signOut(auth);
    },
    onAuthStateChanged: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, callback);
    }
};
