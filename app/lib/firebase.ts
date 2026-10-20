import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  inMemoryPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Public web-app configuration only. Never load a service-account key here.
export function firebaseClient() {
  if (typeof window === "undefined")
    throw Error("Sign-in is available in the browser.");
  const config = {
    apiKey: import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.appId
  )
    throw Error(
      import.meta.env.DEV
        ? "Firebase is not configured. Check the host's public Firebase environment variables and rebuild."
        : "Sign-in is temporarily unavailable. Please try again later.",
    );
  const app = getApps().length ? getApp() : initializeApp(config);
  let auth;
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/already-initialized")
      throw error;
    auth = getAuth(app);
  }
  // Default web Firestore cache is in-memory; no durable device journal cache.
  return { auth, db: getFirestore(app) };
}
