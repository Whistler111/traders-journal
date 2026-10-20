import { WorkspaceSkeleton } from "../workspace-skeleton";
import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { Navigate, Outlet } from "react-router";
import { firebaseClient } from "../../lib/firebase";
import { authMessage } from "../../lib/firebase-errors";
import { finishSignOut } from "../../lib/sign-out-cleanup";
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
}
const Context = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    let unsubscribe = () => {},
      active = true;
    try {
      const { auth } = firebaseClient();
      // Firebase resolves redirect state before its initial auth notification.
      void getRedirectResult(auth).catch((e) => {
        if (active) setError(authMessage(e));
      });
      unsubscribe = onAuthStateChanged(
        auth,
        (next) => {
          if (active) {
            setUser(next);
            setLoading(false);
          }
        },
        (e) => {
          if (active) {
            setError(authMessage(e));
            setLoading(false);
          }
        },
      );
    } catch (e) {
      setError(authMessage(e));
      setLoading(false);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle: async () => {
          const { auth } = firebaseClient();
          const provider = new GoogleAuthProvider();
          try {
            await signInWithPopup(auth, provider);
          } catch (e) {
            if ((e as { code?: string }).code === "auth/popup-blocked")
              await signInWithRedirect(auth, provider);
            else throw e;
          }
        },
        refreshVerification: async () => {
          const current = firebaseClient().auth.currentUser;
          if (!current) throw Error("Sign in again to check verification.");
          await current.reload();
          await current.getIdToken(true);
          refresh((version) => version + 1);
          return current.emailVerified;
        },
        signUpWithEmail: async (email, password) => {
          if (password.length < 8)
            throw Error("Use at least 8 characters for your password.");
          const credential = await createUserWithEmailAndPassword(
            firebaseClient().auth,
            email.trim(),
            password,
          );
          try {
            await sendEmailVerification(credential.user);
          } catch {
            throw Error(
              "Your account was created, but the verification email could not be sent. Use Resend verification in your account settings.",
            );
          }
        },
        signInWithEmail: async (email, password) => {
          await signInWithEmailAndPassword(
            firebaseClient().auth,
            email.trim(),
            password,
          );
        },
        resetPassword: async (email) => {
          try {
            await sendPasswordResetEmail(firebaseClient().auth, email.trim());
          } catch (error) {
            // Older projects without enumeration protection can reject missing users.
            if (
              ["auth/user-not-found", "auth/user-disabled"].includes(
                (error as { code?: string }).code ?? "",
              )
            )
              return;
            throw error;
          }
        },
        signOut: async () => {
          const auth = firebaseClient().auth;
          await firebaseSignOut(auth);
          await finishSignOut();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw Error("Auth provider missing.");
  return value;
}
export function AuthLoading() {
  return <WorkspaceSkeleton full />;
}
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return user ? <Outlet key={user.uid} /> : <Navigate to="/login" replace />;
}
