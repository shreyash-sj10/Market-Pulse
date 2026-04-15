import { Routes, Route } from "react-router-dom";
import AuthPage from "./features/auth/AuthPage.jsx";
import Dashboard from "./features/dashboard/Dashboard.jsx";
import TradeForm from "./features/trades/TradeForm.jsx";
import MarketExplorer from "./features/market/MarketExplorerTerminal.jsx";
import NewsPage from "./features/news/NewsPage.jsx";
import ProtectedRoute from "./features/auth/ProtectedRoute.jsx";
import Layout from "./app/Layout.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

import TracePage from "./features/trace/TracePage.jsx";
import SystemDashboard from "./features/system/SystemDashboard.jsx";
import JournalPage from "./features/trades/JournalPage.jsx";
import ProfilePage from "./features/profile/ProfilePage.jsx";
import V2PortfolioPage from "./v2/pages/portfolio/PortfolioPage.jsx";

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />

        {/* Protected Global App Shell */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/portfolio" element={<V2PortfolioPage />} />
          <Route path="/trade" element={<TradeForm />} />
          <Route path="/market" element={<MarketExplorer />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/journal" element={<JournalPage />} />
          <Route path="/trace" element={<TracePage />} />
          <Route path="/system" element={<SystemDashboard />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
