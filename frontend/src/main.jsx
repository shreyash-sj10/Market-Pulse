import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient.ts";
import { AuthProvider } from "./features/auth/AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import App from "./App.jsx";
import "./index.css";
import "./v2/styles/tokens.css";
import "./v2/styles/base.css";
import { initCurrency } from "./utils/currency.utils";

const isProd =
  import.meta.env.VITE_ENV === "production" || import.meta.env.PROD;

if (!isProd) {
  console.log("[Boot] Initializing Trading Platform (v3)...");
}

// Initialize live currency exchange rate
initCurrency().catch(() => {
  console.warn("[Boot] Currency initialization unavailable; fallback state is visible in UI.");
});

if (!isProd) {
  console.log("[Boot] Rendering App into #root (v3)");
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);
