import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import Create from "@/pages/Create";
import Chat from "@/pages/Chat";
import Voice from "@/pages/Voice";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Home} />
      <Route path="/explore" component={Explore} />
      <Route path="/create" component={Create} />
      <Route path="/chat" component={Chat} />
      <Route path="/voice" component={Voice} />
      <Route path="/profile/me" component={Profile} />
      <Route path="/profile/:userId" component={Profile} />
      <Route path="/notifications" component={Notifications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
