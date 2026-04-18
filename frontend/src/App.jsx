import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import AuthPage from "./features/auth/AuthPage.jsx";
import ProtectedRoute from "./features/auth/ProtectedRoute.jsx";
import TradeFlowNavigateBinder from "./components/TradeFlowNavigateBinder.jsx";
import { ROUTES } from "./v2/routing/routes";

import V2PortfolioPage from "./v2/pages/portfolio/PortfolioPage";
import V2MarketsPage from "./v2/pages/markets/MarketsPage";
import V2HomePage from "./v2/pages/home/HomePage";
import V2JournalPage from "./v2/pages/journal/JournalPage";
import V2ProfilePage from "./v2/pages/profile/ProfilePage";
import V2TracePage from "./v2/pages/trace/TracePage";

function App() {
  return (
    <>
      <TradeFlowNavigateBinder />
      <Routes>
        <Route path={ROUTES.login}    element={<AuthPage />} />
        <Route path={ROUTES.register} element={<AuthPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to={ROUTES.dashboard} replace />} />
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
