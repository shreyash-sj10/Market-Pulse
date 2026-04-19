import { Routes, Route, Outlet } from "react-router-dom";
import AuthPage from "./features/auth/AuthPage.tsx";
import ProtectedRoute from "./features/auth/ProtectedRoute.jsx";
import TradeFlowNavigateBinder from "./components/TradeFlowNavigateBinder.jsx";
import ApiErrorListener from "./v2/components/observability/ApiErrorListener.jsx";
import { ROUTES } from "./v2/routing/routes";

import V2PortfolioPage from "./v2/pages/portfolio/PortfolioPage";
import V2MarketsPage from "./v2/pages/markets/MarketsPage";
import V2HomePage from "./v2/pages/home/HomePage";
import V2JournalPage from "./v2/pages/journal/JournalPage";
import V2ProfilePage from "./v2/pages/profile/ProfilePage";
import V2TracePage from "./v2/pages/trace/TracePage";
import LandingPage from "./v2/pages/landing/LandingPage";
import CreatorPage from "./v2/pages/creator/CreatorPage";

function App() {
  return (
    <>
      <ApiErrorListener />
      <TradeFlowNavigateBinder />
      <Routes>
        <Route path={ROUTES.landing} element={<LandingPage />} />
        <Route path={ROUTES.creator} element={<CreatorPage />} />
        <Route path={ROUTES.login}    element={<AuthPage />} />
        <Route path={ROUTES.register} element={<AuthPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.dashboard} element={<V2HomePage />} />
          <Route path={ROUTES.markets}   element={<V2MarketsPage />} />
          <Route path={ROUTES.portfolio} element={<V2PortfolioPage />} />
          <Route path={ROUTES.journal}   element={<V2JournalPage />} />
          <Route path={ROUTES.profile}   element={<V2ProfilePage />} />
          <Route path={ROUTES.trace}     element={<V2TracePage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
