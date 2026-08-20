import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { subscribeToRole } from "../lib/moderation";
import { ensureProfile, subscribeToProfile } from "../lib/profiles";
import type { SiteRole } from "../types";

const googleProvider = new GoogleAuthProvider();

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  role: SiteRole;
  banned: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  syncDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<SiteRole>("member");
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);

      // Keep the Firestore profile name synchronized with Firebase Auth.
      // This also repairs older profiles that were accidentally created as "Player"
      // during the short signup window before updateProfile() completed.
      const authName = u?.displayName?.trim();
      if (u && authName) {
        void ensureProfile(u.uid, authName).catch((error) => {
          console.error("Could not sync profile display name:", error);
        });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setRole("member");
      return;
    }
    return subscribeToRole(user.uid, user.email, setRole);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBanned(false);
      return;
    }
    return subscribeToProfile(user.uid, (profile) => setBanned(profile?.banned ?? false));
  }, [user]);

  async function signUp(email: string, password: string, displayName: string) {
    const cleanDisplayName = displayName.trim();
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Firebase signs the user in immediately after account creation. Other app
    // components can mount during this window, so write the real name to both
    // Auth and Firestore before signup finishes.
    await updateProfile(cred.user, { displayName: cleanDisplayName });
    await ensureProfile(cred.user.uid, cleanDisplayName);
    await sendEmailVerification(cred.user);

    // Keep the actual Firebase User object (do not spread it into a plain object).
    setUser(auth.currentUser ?? cred.user);
  }

  async function logIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const authName = result.user.displayName?.trim();
    if (authName) await ensureProfile(result.user.uid, authName);
  }

  async function logOut() {
    await signOut(auth);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  // Firebase Auth's displayName only gets set once, at signup — nothing else
  // touches it afterward, so any later profile rename leaves it permanently
  // stale everywhere code reads user.displayName. Call this alongside every
  // Firestore profile displayName write to keep the two in sync.
  async function syncDisplayName(name: string) {
    if (!auth.currentUser) return;
    const trimmed = name.trim();
    if (!trimmed || auth.currentUser.displayName === trimmed) return;
    await updateProfile(auth.currentUser, { displayName: trimmed });
    await auth.currentUser.reload();
    setUser(auth.currentUser);
  }

  return (
    <AuthContext.Provider value={{ user, loading, role, banned, signUp, logIn, logInWithGoogle, logOut, syncDisplayName, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
