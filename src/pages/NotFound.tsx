import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-32 text-center">
      <h1 className="font-mono text-4xl font-extrabold text-white">404</h1>
      <p className="mt-2 text-white/50">This page fell into the void.</p>
      <Link to="/" className="cursor-target mt-6 inline-block text-sm font-medium text-brand-400 hover:underline">
        ← Back home
      </Link>
    </div>
  );
}
