// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyB-oeQCCLGysUG4iuyFpcufMLouAtek4Xs",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "callilog.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "callilog",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "callilog.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "205557324481",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:205557324481:web:c90e650b3493f005535240",
};

// Initialize Firebase singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Provider
const provider = new GoogleAuthProvider();

// 🔥 FORCES GOOGLE TO SHOW THE ACCOUNT CHOOSER EVERY TIME:
provider.setCustomParameters({
  prompt: "select_account",
});

export const login = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);
