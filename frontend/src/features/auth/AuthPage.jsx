import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "./AuthContext.jsx";
import { loginUser, registerUser } from "../../services/auth.api.js";
import { Activity, ArrowRight, TrendingUp } from "lucide-react";

export default function AuthPage() {
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(location.pathname === "/login");
  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { user, login } = useAuth();
  const navigate = useNavigate();

  // ── AUTO-REDIRECT IF ALREADY AUTHENTICATED ──
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleToggle = () => {
    setIsLogin(!isLogin);
    setError("");
    setFormData({ name: "", email: "", password: "", confirmPassword: "" });
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { name: formData.name, email: formData.email, password: formData.password };

      const data = isLogin
        ? await loginUser(payload)
        : await registerUser(payload);

      login(data.token, data.user);
      navigate("/");
    } catch (err) {
      if (err.response?.data?.errors) {
        const fieldErrors = err.response.data.errors.map(e => e.message).join(". ");
        setError(fieldErrors);
      } else {
        const message = err.response?.data?.message || err.message || "Authentication failed. Try again.";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut", staggerChildren: 0.1 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-slate-50 flex p-4 sm:p-8 font-sans selection:bg-blue-200 selection:text-blue-900">

      <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col md:flex-row relative border border-slate-100">

        {/* LEFT PANEL - FINTECH THEME */}
        <div className="w-full md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden hidden md:flex border-r border-slate-800">
          <div className="z-10 mt-8">
            <div className="bg-blue-500/20 text-blue-400 font-bold uppercase tracking-widest text-[10px] px-3 py-1 rounded-full inline-flex mb-6 border border-blue-500/30">
              Enterprise Simulation
            </div>
            <h1 className="text-4xl font-black tracking-tight leading-tight">
              Master the Markets. <br /> Risk-Free.
            </h1>
            <p className="mt-6 text-slate-400 text-lg font-medium leading-relaxed max-w-sm">
              Execute live trades, monitor algorithmic risk analysis, and build a deterministic portfolio edge.
            </p>
          </div>

          <div className="z-10 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <TrendingUp size={20} className="text-white" />
            </div>
            <span className="font-extrabold tracking-tight text-white text-xl">Antigravity<span className="text-blue-500">Fin</span></span>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[1px] border-slate-800 rounded-full opacity-20 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border-[1px] border-slate-800 rounded-full opacity-40 pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600 rounded-full blur-[100px] opacity-20 pointer-events-none" />
        </div>

        {/* RIGHT PANEL - FORM */}
        <div className="w-full md:w-7/12 p-8 sm:p-16 flex flex-col justify-center relative bg-white">
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? "login" : "signup"}
              variants={formVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="max-w-md w-full mx-auto"
            >
              <div className="mb-10 text-center md:text-left">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  {isLogin ? "Welcome Back" : "Create Account"}
                </h2>
                <p className="text-slate-600 mt-2 font-bold uppercase text-[10px] tracking-widest">
                  {isLogin
                    ? "Establish secure connection to trading desk."
                    : "Create an account to begin algorithmic simulation."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">

                {!isLogin && (
                  <motion.div variants={itemVariants}>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="Enter your name"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3.5 text-slate-800 font-bold outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                    />
                  </motion.div>
                )}

                <motion.div variants={itemVariants}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="trader@example.com"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3.5 text-slate-800 font-bold outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3.5 text-slate-800 font-bold outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                  />
                </motion.div>

                {!isLogin && (
                  <motion.div variants={itemVariants}>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl px-4 py-3.5 text-slate-800 font-bold outline-none transition-all placeholder:font-normal placeholder:text-slate-400"
                    />
                  </motion.div>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-rose-50 border border-rose-200 text-rose-600 rounded-xl p-3 text-sm font-bold text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  variants={itemVariants}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 mt-2 rounded-xl flex items-center justify-center gap-2 text-white font-bold text-lg shadow-lg transition-all ${loading
                      ? "bg-slate-400 cursor-not-allowed shadow-none"
                      : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 hover:shadow-blue-600/40"
                    }`}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Authenticating...
                    </span>
                  ) : (
                    <>{isLogin ? "Access Terminal" : "Initialize Account"} <ArrowRight size={18} /></>
                  )}
                </motion.button>

                <motion.div variants={itemVariants} className="mt-6 text-center">
                  <span className="text-slate-500 font-medium text-sm">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                  </span>
                  <button
                    type="button"
                    onClick={handleToggle}
                    className="ml-2 text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors"
                  >
                    {isLogin ? "Register Terminal" : "Log in here"}
                  </button>
                </motion.div>

              </form>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
