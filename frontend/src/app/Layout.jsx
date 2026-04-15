import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { DegradedState } from "../components/common/ExperienceStates";
import { useMarketStatus } from "../hooks/useMarket";

export default function Layout() {
  const location = useLocation();
  const { status } = useMarketStatus();
  const MotionDiv = motion.div;

  const isDegraded = status?.degraded;

  return (
    <div className="min-h-screen font-sans text-slate-900 overflow-hidden selection:bg-blue-200">
      {isDegraded && <DegradedState />}
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'font-medium shadow-xl border border-slate-100',
        }}
      />
      <Navbar />

      <div className="flex h-screen pt-16">
        <Sidebar />

        {/* Dynamic Outlet Area with Framer Motion Page Transitions */}
        <main className="flex-1 ml-64 p-6 overflow-y-auto w-full scroll-smooth relative">
          <AnimatePresence mode="wait">
            <MotionDiv
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full w-full"
            >
              <Outlet />
            </MotionDiv>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
