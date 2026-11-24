import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { CallProvider } from "@/lib/callContext";
import { SystemWarningPopup } from "@/components/SystemWarningPopup";
import NotFound from "@/pages/not-found";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import Create from "@/pages/Create";
import Chat from "@/pages/Chat";
import Community from "@/pages/Community";
import Voice from "@/pages/Voice";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import Admin from "@/pages/Admin";
import DirectMessages from "@/pages/DirectMessages";
import Bookmarks from "@/pages/Bookmarks";
import PostDetail from "@/pages/PostDetail";
import Notebook from "@/pages/Notebook";
import Loops from "@/pages/Loops";
import IcerikOlustur from "@/pages/IcerikOlustur";
import MetinHikayesi from "@/pages/MetinHikayesi";
import Calismalari from "@/pages/Calismalari";
import Kitaplar from "@/pages/Kitaplar";
import KitapDetay from "@/pages/KitapDetay";
import BenimleIlgili from "@/pages/BenimleIlgili";
import Settings from "@/pages/Settings";
import Memberships from "@/pages/Memberships";
import Archive from "@/pages/Archive";
import PrivacySettings from "@/pages/PrivacySettings";
import MentionsRepliesSettings from "@/pages/MentionsRepliesSettings";
import BlockedUsers from "@/pages/BlockedUsers";
import AccountCenter from "@/pages/AccountCenter";
import { StoryNavigation } from "@/components/shared/StoryNavigation";

const queryClient = new QueryClient();

function VoiceRoutePlaceholder() {
  return null;
}

function Router() {
  return (
    <>
      <Voice />
      <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Home} />
      <Route path="/explore" component={Explore} />
      <Route path="/create" component={Create} />
      <Route path="/community" component={Community} />
      <Route path="/community/voice" component={VoiceRoutePlaceholder} />
      <Route path="/chat" component={Chat} />
      <Route path="/voice" component={VoiceRoutePlaceholder} />
      <Route path="/profile/me" component={Profile} />
      <Route path="/profile/:userId" component={Profile} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/admin" component={Admin} />
      <Route path="/dm" component={DirectMessages} />
      <Route path="/dm/group/:groupId" component={DirectMessages} />
      <Route path="/dm/:userId" component={DirectMessages} />
      <Route path="/bookmarks" component={Bookmarks} />
      <Route path="/post/:postId" component={PostDetail} />
      <Route path="/notebook" component={Notebook} />
      <Route path="/loops" component={Loops} />
      <Route path="/icerik-olustur" component={IcerikOlustur} />
      <Route path="/yaz/metin" component={MetinHikayesi} />
      <Route path="/notebook/calismalari" component={Calismalari} />
      <Route path="/kitaplar" component={Kitaplar} />
      <Route path="/kitap/:id" component={KitapDetay} />
      <Route path="/benimle-ilgili" component={BenimleIlgili} />
      <Route path="/settings" component={Settings} />
      <Route path="/memberships" component={Memberships} />
      <Route path="/archive" component={Archive} />
      <Route path="/privacy" component={PrivacySettings} />
      <Route path="/mentions-replies" component={MentionsRepliesSettings} />
      <Route path="/blocked-users" component={BlockedUsers} />
      <Route path="/account-center" component={AccountCenter} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <CallProvider>
              <StoryNavigation>
                <Router />
              </StoryNavigation>
              <SystemWarningPopup />
            </CallProvider>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
        <Sonner richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
