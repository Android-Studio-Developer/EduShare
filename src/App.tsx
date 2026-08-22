import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { UiVersionProvider, useUiVersion } from "./context/UiVersionContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BackgroundProvider, useBackground } from "./context/BackgroundContext";
import { VoiceCallProvider } from "./context/VoiceCallContext";
import { MusicProvider } from "./context/MusicContext";
import { isFirebaseConfigured } from "./lib/firebase";
import { isReduceMotion } from "./lib/accessibility";
import ProtectedRoute from "./components/ProtectedRoute";
import BackgroundFX from "./components/BackgroundFX";
import GalaxyBackground from "./components/GalaxyBackground";
import TargetCursor from "./components/TargetCursor";
import FirebaseSetupNotice from "./components/FirebaseSetupNotice";
import SiteGate from "./components/SiteGate";
import PatchNotesModal from "./components/PatchNotesModal";
import PlaytimeTracker from "./components/PlaytimeTracker";
import NotificationSound from "./components/NotificationSound";
import PersistentVoiceAudio from "./components/PersistentVoiceAudio";
import BannedNotice from "./components/BannedNotice";
import StealthMode from "./components/StealthMode";
import ClickSpark from "./components/ClickSpark";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import V3Shell from "./components/V3Shell";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CreateServer from "./pages/CreateServer";
import ServerDetail from "./pages/ServerDetail";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import Moderation from "./pages/Moderation";
import ServerShop from "./pages/ServerShop";
import ReportServer from "./pages/ReportServer";
import DisputeRoom from "./pages/DisputeRoom";
import Favorites from "./pages/Favorites";
import ServerStats from "./pages/ServerStats";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Players from "./pages/Players";
import Chat from "./pages/Chat";
import Shares from "./pages/Shares";
import Friends from "./pages/Friends";
import Voice from "./pages/Voice";
import Guide from "./pages/Guide";
import Team from "./pages/Team";
import PartyGuild from "./pages/PartyGuild";
import Changelog from "./pages/Changelog";
import Recover from "./pages/Recover";
const Fun = lazy(() => import("./pages/Fun"));

const UNLOCK_KEY = "edushare-gate-unlocked";

function AppContent() {
  const { banned, role } = useAuth();
  const { uiVersion } = useUiVersion();

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/team" element={<Team />} />
      <Route path="/staff" element={<Team />} />
      <Route path="/changelog" element={<Changelog />} />
      <Route
        path="/fun"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="py-32 text-center text-white/40">Loading…</div>}>
              <Fun />
            </Suspense>
          </ProtectedRoute>
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
      <Route path="/voice" element={<ProtectedRoute><Voice /></ProtectedRoute>} />
      <Route path="/shares" element={<ProtectedRoute><Shares /></ProtectedRoute>} />
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
  );

  const body = banned && role !== "owner" ? <BannedNotice /> : routes;

  if (uiVersion === "v3") {
    return <V3Shell>{body}</V3Shell>;
  }

  if (uiVersion === "v2") {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
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
  const { background } = useBackground();
  if (reduceMotion) return null;
  if ((uiVersion === "v2" || uiVersion === "v3") && background === "galaxy") return <GalaxyBackground />;
  return <BackgroundFX />;
}

function RealApp() {
  if (!isFirebaseConfigured) {
    return <FirebaseSetupNotice />;
  }

  const reduceMotion = isReduceMotion();

  return (
    <UiVersionProvider>
      <ThemeProvider>
        <BackgroundProvider>
          <AuthProvider>
            <MusicProvider>
              <VoiceCallProvider>
                <TargetCursor
                  targetSelector=".cursor-target"
                  cursorColor="#e7e9ee"
                  cursorColorOnTarget="#a78bfa"
                  spinDuration={reduceMotion ? 0 : 2.2}
                  hoverDuration={0.12}
                />
                <SiteBackground reduceMotion={reduceMotion} />
                <PlaytimeTracker />
                <NotificationSound />
                <PersistentVoiceAudio />
                <PatchNotesModal />
                <StealthMode />
                {!reduceMotion && <ClickSpark sparkColor="#93b4ff" sparkCount={8} sparkRadius={18} duration={450} />}
                <AppContent />
              </VoiceCallProvider>
            </MusicProvider>
          </AuthProvider>
        </BackgroundProvider>
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
