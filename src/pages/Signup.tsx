import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FirebaseError } from "firebase/app";
import { UserPlus } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

function signUpErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "That email is already in use — try logging in instead.";
      case "auth/invalid-email":
        return "That doesn't look like a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/network-request-failed":
        return "Network error — check your connection and try again.";
      case "auth/too-many-requests":
        return "Too many attempts — wait a bit and try again.";
      default:
        return `Couldn't create your account (${error.code}).`;
    }
  }
  return "Couldn't create your account. Try again.";
}

export default function Signup() {
  const { signUp, logInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, displayName);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(signUpErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      await logInWithGoogle();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Couldn't sign up with Google. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md flex-col justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-surface p-8"
      >
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
            <UserPlus size={17} />
          </div>
          <h1 className="font-mono text-xl font-bold text-white">Create your account</h1>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="cursor-target flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface-2 py-2.5 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-surface-2/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FcGoogle size={17} />
          {googleLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="font-mono text-[11px] tracking-wider text-white/30 uppercase">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Display name</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. MrRiveraCS"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-white/50">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-white focus:border-brand-500/50 focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-white/45">
          Already have an account?{" "}
          <Link to="/login" className="cursor-target font-medium text-brand-400 hover:underline">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
