import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToFavorites } from "../lib/favorites";
import { subscribeToServers } from "../lib/servers";
import type { MinecraftServer } from "../types";
import ServerCard from "../components/ServerCard";

export default function Favorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [servers, setServers] = useState<MinecraftServer[]>([]);
  useEffect(() => user ? subscribeToFavorites(user.uid, setIds) : undefined, [user]);
  useEffect(() => subscribeToServers(setServers), []);
  const favorites = servers.filter((server) => ids.includes(server.id));
  return <div className="mx-auto max-w-6xl px-6 py-14"><h1 className="font-mono text-2xl font-bold text-white"><Heart className="mr-2 inline text-pink-300"/>Favorite servers</h1><p className="mt-2 mb-8 text-sm text-white/45">Your saved worlds in one place.</p>{favorites.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-20 text-center text-white/35">No favorite servers yet.</div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{favorites.map((server, index) => <ServerCard key={server.id} server={server} index={index}/>)}</div>}</div>;
}
