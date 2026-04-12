import { NavLink } from "react-router-dom";
import { PieChart, ArrowLeftRight, Layers, Activity, Newspaper, Server, BookOpen, User } from "lucide-react";

const navItems = [
  { path: "/", label: "Dashboard", icon: PieChart },
  { path: "/profile", label: "Trader Profile", icon: User },
  { path: "/market", label: "Market Explorer", icon: Layers },
  { path: "/news", label: "Market Intelligence", icon: Newspaper },
  { path: "/trade", label: "Trade Execution", icon: ArrowLeftRight },
  { path: "/journal", label: "Trading Journal", icon: BookOpen },
  { path: "/trace", label: "System Trace", icon: Activity },
  { path: "/system", label: "System Health", icon: Server },
];

import Watchlist from "../features/watchlist/Watchlist";

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-30 transition-all">
      <div className="h-16 w-full shrink-0" /> {/* Pushes content down below fixed Navbar */}

      <nav className="flex-1 py-8 px-4 flex flex-col gap-2 overflow-y-auto min-h-0">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 hover:translate-x-1"
              }`
            }
          >
            <item.icon size={20} className="shrink-0" />
            <span className="tracking-wide select-none">{item.label}</span>
          </NavLink>
        ))}

        {/* Watchlist Section */}
        <Watchlist />
      </nav>

      <div className="p-6 text-xs flex items-center gap-2 text-slate-500 border-t border-slate-800/60 select-none shrink-0 uppercase tracking-widest font-black">
        <Activity size={14} className="text-blue-500 animate-pulse" />
        <span className="font-mono">SYS.ONLINE v1.0</span>
      </div>
    </aside>
  );
}
