import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { addFavorite, removeFavorite, subscribeToFavorites } from "../lib/favorites";

export default function FavoriteButton({ serverId }: { serverId: string }) {
  const { user } = useAuth();
  const [favorite, setFavorite] = useState(false);
  useEffect(() => {
    if (!user) return;
    return subscribeToFavorites(user.uid, (ids) => setFavorite(ids.includes(serverId)));
  }, [serverId, user]);
  if (!user) return null;
  return <button type="button" onClick={() => favorite ? removeFavorite(user.uid, serverId) : addFavorite(user.uid, serverId)} aria-label={favorite ? "Remove favorite" : "Add favorite"} className={`cursor-target flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${favorite ? "border-pink-400/40 bg-pink-400/10 text-pink-300" : "border-border text-white/45 hover:text-pink-300"}`}><Heart size={13} fill={favorite ? "currentColor" : "none"}/>{favorite ? "Saved" : "Favorite"}</button>;
}
