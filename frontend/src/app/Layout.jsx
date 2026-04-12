import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen font-sans text-slate-900 overflow-hidden selection:bg-blue-200">
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
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
