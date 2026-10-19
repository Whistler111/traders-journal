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
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
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
        signUpWithEmail: async (email, password) => {
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
          await sendPasswordResetEmail(firebaseClient().auth, email.trim());
        },
        signOut: async () => {
          const auth = firebaseClient().auth;
          const uid = auth.currentUser?.uid;
          await firebaseSignOut(auth);
          // Alert delivery records can contain trade context; do not leave them for a later account.
          if (uid)
            try {
              localStorage.removeItem(`trade-notes-alert-runtime-v1:${uid}`);
            } catch {
              /* Optional device metadata. */
            }
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
  return (
    <div className="auth-loading" role="status">
      Opening your trading space…
    </div>
  );
}
export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return user ? <Outlet key={user.uid} /> : <Navigate to="/login" replace />;
}
