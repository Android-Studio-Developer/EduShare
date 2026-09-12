import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { UiVersionProvider, useUiVersion } from "./context/UiVersionContext";
import { ThemeProvider } from "./context/ThemeContext";
import { VoiceCallProvider } from "./context/VoiceCallContext";
import { MusicProvider } from "./context/MusicContext";
import { isFirebaseConfigured } from "./lib/firebase";
import { playUnlockMusicOnce } from "./lib/unlockMusic";
import { subscribeToProfile } from "./lib/profiles";
import { isLowPowerDevice, isReduceMotion } from "./lib/accessibility";
import ProtectedRoute from "./components/ProtectedRoute";
import BackgroundFX from "./components/BackgroundFX";
import TargetCursor from "./components/TargetCursor";
import FirebaseSetupNotice from "./components/FirebaseSetupNotice";
import SiteGate from "./components/SiteGate";
import PatchNotesModal from "./components/PatchNotesModal";
import PlaytimeTracker from "./components/PlaytimeTracker";
import NotificationSound from "./components/NotificationSound";
import LoginUiPrompt from "./components/LoginUiPrompt";
import PersistentVoiceAudio from "./components/PersistentVoiceAudio";
import BannedNotice from "./components/BannedNotice";
import StealthMode from "./components/StealthMode";
import ClickSpark from "./components/ClickSpark";
import ReferralRewardPopup from "./components/ReferralRewardPopup";
import CosmeticsNudge from "./components/CosmeticsNudge";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import V3Shell from "./components/V3Shell";
import V4Shell from "./components/V4Shell";
import V5Shell from "./components/V5Shell";
import Footer from "./components/Footer";
const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const CreateServer = lazy(() => import("./pages/CreateServer"));
const ServerDetail = lazy(() => import("./pages/ServerDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Moderation = lazy(() => import("./pages/Moderation"));
const ServerShop = lazy(() => import("./pages/ServerShop"));
const ReportServer = lazy(() => import("./pages/ReportServer"));
const DisputeRoom = lazy(() => import("./pages/DisputeRoom"));
const Favorites = lazy(() => import("./pages/Favorites"));
const ServerStats = lazy(() => import("./pages/ServerStats"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const Players = lazy(() => import("./pages/Players"));
const Chat = lazy(() => import("./pages/Chat"));
const ChatServers = lazy(() => import("./pages/ChatServers"));
const CommunityServer = lazy(() => import("./pages/CommunityServer"));
const Shares = lazy(() => import("./pages/Shares"));
const Memes = lazy(() => import("./pages/Memes"));
const Calculator = lazy(() => import("./pages/Calculator"));
const BedwarsRanked = lazy(() => import("./pages/BedwarsRanked"));
const Friends = lazy(() => import("./pages/Friends"));
const Voice = lazy(() => import("./pages/Voice"));
const VoiceLab = lazy(() => import("./pages/VoiceLab"));
const MovieDrop = lazy(() => import("./pages/MovieDrop"));
const Messages = lazy(() => import("./pages/Messages"));
const Guide = lazy(() => import("./pages/Guide"));
const Team = lazy(() => import("./pages/Team"));
const PartyGuild = lazy(() => import("./pages/PartyGuild"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Recover = lazy(() => import("./pages/Recover"));
const Develop = lazy(() => import("./pages/Develop"));
const Fun = lazy(() => import("./pages/Fun"));

const UNLOCK_KEY = "edushare-site-gate-v2";

function AppContent() {
  const { banned, role } = useAuth();
  const { uiVersion } = useUiVersion();
  const location = useLocation();

  const routes = (
    <Suspense fallback={<div className="py-32 text-center text-white/40">Loading…</div>}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/team" element={<Team />} />
      <Route path="/staff" element={<Team />} />
      <Route path="/changelog" element={<Changelog />} />
      <Route
        path="/fun"
        element={
          <ProtectedRoute><Fun /></ProtectedRoute>
        }
      />
      <Route path="/login" element={<Login />} />
      <Route path="/recover" element={<Recover />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/server/:id" element={<ServerDetail />} />
      <Route path="/server/:id/shop" element={<ProtectedRoute><ServerShop /></ProtectedRoute>} />
      <Route path="/server/:id/report" element={<ProtectedRoute><ReportServer /></ProtectedRoute>} />
      <Route path="/dispute/:id" element={<ProtectedRoute><DisputeRoom /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
      <Route path="/server/:id/stats" element={<ProtectedRoute><ServerStats /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
      <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
      <Route path="/party" element={<ProtectedRoute><PartyGuild /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/chat/servers/:serverId" element={<ProtectedRoute><CommunityServer /></ProtectedRoute>} />
      <Route path="/chat-servers" element={<ProtectedRoute><ChatServers /></ProtectedRoute>} />
      <Route path="/chat-servers/:serverId" element={<ProtectedRoute><CommunityServer /></ProtectedRoute>} />
      <Route path="/voice" element={<ProtectedRoute><Voice /></ProtectedRoute>} />
      <Route path="/voice-lab" element={<ProtectedRoute><VoiceLab /></ProtectedRoute>} />
      <Route path="/movie-drop" element={<ProtectedRoute><MovieDrop /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/messages/:otherId" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/shares" element={<ProtectedRoute><Shares /></ProtectedRoute>} />
      <Route path="/memes" element={<ProtectedRoute><Memes /></ProtectedRoute>} />
      <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
      <Route path="/bedwars" element={<ProtectedRoute><BedwarsRanked /></ProtectedRoute>} />
      <Route path="/develop" element={<ProtectedRoute><Develop /></ProtectedRoute>} />
      <Route
        path="/moderation"
        element={
          <ProtectedRoute>
            <Moderation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create"
        element={
          <ProtectedRoute>
            <CreateServer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );

  const body = banned && role !== "owner" ? <BannedNotice /> : routes;

  if (location.pathname === "/login" || location.pathname === "/signup") {
    return body;
  }

  if (uiVersion === "v5") {
    return <V5Shell>{body}</V5Shell>;
  }

  if (uiVersion === "v4") {
    return <V4Shell>{body}</V4Shell>;
  }

  if (uiVersion === "v3") {
    return <V3Shell>{body}</V3Shell>;
  }

  if (uiVersion === "v2") {
    return (
      <div className="flex min-h-screen">
        <div className="hidden shrink-0 md:block"><Sidebar /></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="md:hidden"><Navbar /></div>
          <main className="flex-1">{body}</main>
          <Footer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{body}</main>
      <Footer />
    </div>
  );
}

function SiteBackground({ reduceMotion }: { reduceMotion: boolean }) {
  const { uiVersion } = useUiVersion();
  const { user } = useAuth();
  const [backgroundUrl, setBackgroundUrl] = useState("");

  useEffect(() => {
    setBackgroundUrl("");
    if (!user) return;
    return subscribeToProfile(user.uid, (profile) => setBackgroundUrl(profile?.backgroundUrl?.trim() ?? ""));
  }, [user]);

  if (backgroundUrl) {
    const shade = uiVersion === "v4" || uiVersion === "v5" ? "linear-gradient(rgba(3, 9, 14, .18), rgba(3, 9, 14, .32))" : "linear-gradient(rgba(3, 9, 14, .58), rgba(3, 9, 14, .72))";
    return <div className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `${shade}, url(${JSON.stringify(backgroundUrl)})` }} />;
  }
  if (reduceMotion) return null;
  return <BackgroundFX />;
}

// RealApp only mounts fresh right when the site gate is bypassed (App swaps
// SiteGate for RealApp), so a mount-once effect here fires at exactly that
// moment — still close enough to the unlock click/keypress to count as a
// user gesture for autoplay-with-sound purposes.
function UnlockMusicTrigger() {
  useEffect(() => {
    playUnlockMusicOnce();
  }, []);
  return null;
}

function RealApp() {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupNotice />;
  }

  const reduceMotion = isReduceMotion() || isLowPowerDevice();

  return (
    <UiVersionProvider>
      <ThemeProvider>
        <AuthProvider>
          <MusicProvider>
            <VoiceCallProvider>
                {!reduceMotion && <TargetCursor
                  targetSelector=".cursor-target"
                  cursorColor="#e7e9ee"
                  cursorColorOnTarget="#a78bfa"
                  spinDuration={reduceMotion ? 0 : 2.2}
                  hoverDuration={0.12}
                />}
                <SiteBackground reduceMotion={reduceMotion} />
                <PlaytimeTracker />
                <UnlockMusicTrigger />
                <NotificationSound />
                <LoginUiPrompt />
                <PersistentVoiceAudio />
                <PatchNotesModal />
                <ReferralRewardPopup />
                <CosmeticsNudge />
                <StealthMode />
                {!reduceMotion && <ClickSpark sparkColor="#93b4ff" sparkCount={8} sparkRadius={18} duration={450} />}
                <AppContent />
            </VoiceCallProvider>
          </MusicProvider>
        </AuthProvider>
      </ThemeProvider>
    </UiVersionProvider>
  );
}

function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(UNLOCK_KEY) === "1",
  );

  useEffect(() => {
    if (unlocked) sessionStorage.setItem(UNLOCK_KEY, "1");
  }, [unlocked]);

  return (
    <AnimatePresence mode="wait">
      {!unlocked ? (
        <motion.div key="gate" exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
          <SiteGate onUnlock={() => setUnlocked(true)} />
        </motion.div>
      ) : (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          <RealApp />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
