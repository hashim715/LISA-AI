import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import store from "./store/store";
import { Provider } from "react-redux";
import ProtectedRoute from "./components/ProtectedRoute";
import GoogleOAuthCallback from "./components/GoogleOauthCallback";
import NotionOAuthCallback from "./components/NotionOauthCallback";
import OutlookOAuthCallback from "./components/OutlookOauthCallback";
import SignIn from "./components/SignIn";
import Welcome from "./components/Welcome";
import Main from "./components/main";
import Settings from "./components/Settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SlackOAuthCallback from "./components/SlackOauthCallback";
import DemoScreen from "./components/DemoScreen";
import Terms from "./components/Terms";
import About from "./components/About";
import PrivacyPolicy from "./components/PrivacyPolicy";
import ContactUs from "./components/ContactUs";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <Router>
          <Routes>
            <Route path="/login" element={<SignIn />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/contact" element={<ContactUs />} />
            <Route path="/about" element={<About />} />
            <Route
              path="/google/auth/callback"
              element={<GoogleOAuthCallback />}
            />
            <Route
              path="/notion/auth/callback"
              element={<NotionOAuthCallback />}
            />
            <Route
              path="/outlook/auth/callback"
              element={<OutlookOAuthCallback />}
            />
            <Route
              path="/slack/auth/callback"
              element={<SlackOAuthCallback />}
            />
            <Route path="/" element={<DemoScreen />} />
            <Route path="/welcome" element={<Welcome />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/main" element={<Main />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </Provider>
    </QueryClientProvider>
  );
}

export default App;
