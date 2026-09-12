import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FirebaseError } from "firebase/app";
import { ArrowRight, Check, Eye, EyeOff, Rocket } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useAuth } from "../context/AuthContext";
import AuthShell from "../components/AuthShell";

function signUpErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use": return "That email is already in use — try logging in instead.";
      case "auth/invalid-email": return "That doesn't look like a valid email address.";
      case "auth/weak-password": return "Password must be at least 6 characters.";
      case "auth/network-request-failed": return "Network error — check your connection and try again.";
      case "auth/too-many-requests": return "Too many attempts — wait a bit and try again.";
      default: return `Couldn't create your account (${error.code}).`;
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
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try { await signUp(email, password, displayName); navigate("/dashboard", { replace: true }); }
    catch (err) { setError(signUpErrorMessage(err)); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try { await logInWithGoogle(); navigate("/dashboard", { replace: true }); }
    catch { setError("Couldn't sign up with Google. Try again."); }
    finally { setGoogleLoading(false); }
  }

  return (
    <AuthShell eyebrow="Begin your journey" title="Create your account" description="One account for your classes, community, and games." icon={Rocket}>
      <button type="button" onClick={handleGoogle} disabled={googleLoading} className="cursor-target auth-google-button"><FcGoogle size={18} />{googleLoading ? "Signing in..." : "Continue with Google"}</button>
      <div className="auth-divider"><span>or use email</span></div>
      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field"><span>Display name</span>
          <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" placeholder="What should we call you?" />
        </label>
        <label className="auth-field"><span>Email address</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
        </label>
        <label className="auth-field">
          <span className="auth-field-label"><span>Password</span><small className={password.length >= 6 ? "is-valid" : ""}><Check size={12} /> 6+ characters</small></span>
          <span className="auth-password-wrap">
            <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Create a password" />
            <button type="button" className="cursor-target auth-password-toggle" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </span>
        </label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button type="submit" className="cursor-target auth-primary-button" disabled={loading}>{loading ? "Creating account..." : <><span>Launch your account</span><ArrowRight size={17} /></>}</button>
      </form>
      <div className="auth-links"><p>Already have an account? <Link to="/login" className="cursor-target">Log in</Link></p><p className="mt-2 text-[10px] text-white/30">Successful logins record email, public IP, browser, and operating system for owner/dabug security review. Passwords and tokens are never logged.</p></div>
    </AuthShell>
  );
}
