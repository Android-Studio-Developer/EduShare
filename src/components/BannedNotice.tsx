import { ShieldOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Button from "./Button";

export default function BannedNotice() {
  const { logOut } = useAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldOff size={40} className="text-red-400" />
      <h1 className="font-mono text-2xl font-bold text-white">Account banned</h1>
      <p className="max-w-md text-sm text-white/50">
        Your SpawnDex account has been banned by staff. You can't chat, register servers, or use the site while banned.
      </p>
      <Button variant="secondary" onClick={logOut}>Log out</Button>
    </div>
  );
}
