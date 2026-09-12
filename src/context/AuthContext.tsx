import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { subscribeToRole } from "../lib/moderation";
import { ensureProfile, subscribeToProfile } from "../lib/profiles";
import { showLoginUiPrompt } from "../lib/loginUiPrompt";
import { deleteAccountData } from "../lib/account";
import type { SiteRole } from "../types";
import { recordLoginEvent } from "../lib/accountAudit";

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
  deleteAccount: (password: string, usernameLower: string) => Promise<void>;
  syncDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedRole, setAssignedRole] = useState<SiteRole>("member");
  const [isPartner, setIsPartner] = useState(false);
  const [banned, setBanned] = useState(false);
  // Partner is an earned profile rank, but product policy gives it the same
  // moderation surface as an explicitly assigned moderator role.
  const role: SiteRole = assignedRole === "owner" || assignedRole === "moderator" || assignedRole === "actor" || assignedRole === "headmod" || assignedRole === "dabug"
    ? assignedRole
    : isPartner ? "moderator" : "member";

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
      setAssignedRole("member");
      return;
    }
    return subscribeToRole(user.uid, user.email, setAssignedRole);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setBanned(false);
      setIsPartner(false);
      return;
    }
    return subscribeToProfile(user.uid, (profile) => {
      setBanned(profile?.banned ?? false);
      setIsPartner(profile?.rank === "partner");
    });
  }, [user]);

  async function signUp(email: string, password: string, displayName: string) {
    const cleanDisplayName = displayName.trim();
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    // Firebase signs the user in immediately after account creation. Other app
    // components can mount during this window, so write the real name to both
    // Auth and Firestore before signup finishes.
    await updateProfile(cred.user, { displayName: cleanDisplayName });
    const refCode = new URLSearchParams(window.location.search).get("ref") ?? "";
    await ensureProfile(cred.user.uid, cleanDisplayName, refCode);
    // Best-effort: Firebase's verification-email send is rate-limited and can
    // throw (auth/too-many-requests) even though the account itself is fine.
    // Letting that reject the whole signUp() call made users think signup had
    // failed, so they'd retry with a new email — the actual cause of duplicate
    // accounts, not a bug in account creation itself.
    await sendEmailVerification(cred.user).catch((error) => {
      console.error("Could not send verification email:", error);
    });
    void recordLoginEvent(cred.user.uid, "signup").catch(() => undefined);

    // Keep the actual Firebase User object (do not spread it into a plain object).
    setUser(auth.currentUser ?? cred.user);
  }

  async function logIn(email: string, password: string) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    void recordLoginEvent(result.user.uid, "password").catch(() => undefined);
    showLoginUiPrompt();
  }

  async function logInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    const authName = result.user.displayName?.trim();
    if (authName) await ensureProfile(result.user.uid, authName, new URLSearchParams(window.location.search).get("ref") ?? "");
    void recordLoginEvent(result.user.uid, "google").catch(() => undefined);
    showLoginUiPrompt();
  }

  async function logOut() {
    await signOut(auth);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function deleteAccount(password: string, usernameLower: string) {
    const current = auth.currentUser;
    if (!current) throw new Error("You are not signed in.");
    const providers = current.providerData.map((provider) => provider.providerId);

    if (providers.includes("password")) {
      if (!current.email || !password) throw new Error("Enter your password to continue.");
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
    } else if (providers.includes("google.com")) {
      await reauthenticateWithPopup(current, googleProvider);
    } else {
      throw new Error("Please sign out, sign back in, and try again.");
    }

    await deleteAccountData(current.uid, usernameLower);
    await deleteUser(current);
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
    <AuthContext.Provider value={{ user, loading, role, banned, signUp, logIn, logInWithGoogle, logOut, deleteAccount, syncDisplayName, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
