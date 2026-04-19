import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { loginUser, registerUser } from "../../v2/api/auth.api.js";
import { ROUTES } from "../../v2/routing/routes";

type FormState = {
  name: string;
  email: string;
  password: string;
  experienceLevel: string;
};

function getAuthErrorMessage(err: unknown, isLoginMode: boolean): string {
  const e = err as {
    response?: {
      status?: number;
      data?: { message?: string; errors?: Array<{ message?: string }> };
    };
  };
  if (!e.response) {
    return "Unable to authenticate";
  }
  const errors = e.response?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const joined = errors
      .map((x) => x.message)
      .filter((m): m is string => typeof m === "string" && m.length > 0)
      .join(". ");
    if (joined) return joined;
  }
  const status = e.response?.status;
  if (isLoginMode) {
    if (status === 401 || status === 403 || status === 400) {
      return "Invalid credentials";
    }
    return "Unable to authenticate";
  }
  const msg = e.response?.data?.message;
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim();
  }
  return "Unable to authenticate";
}

const inputClass =
  "w-full rounded-[var(--radius-md)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-card)] px-3 py-2.5 text-[length:var(--text-sm)] text-[var(--v2-text-primary)] shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-[var(--v2-text-muted)] focus:border-[var(--v2-accent-border)] focus:ring-2 focus:ring-[var(--v2-accent-focus)]";

const labelClass =
  "mb-1.5 block text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-wider)] text-[var(--v2-text-muted)]";

export default function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [isLogin, setIsLogin] = useState(location.pathname === ROUTES.login);
  const [formData, setFormData] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    experienceLevel: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      navigate(ROUTES.dashboard);
    }
  }, [user, navigate]);

  useEffect(() => {
    const onLoginRoute = location.pathname === ROUTES.login;
    setIsLogin(onLoginRoute);
  }, [location.pathname]);

  const goLogin = useCallback(() => {
    setError("");
    navigate(ROUTES.login);
  }, [navigate]);

  const goRegister = useCallback(() => {
    setError("");
    navigate(ROUTES.register);
  }, [navigate]);

  const resetForm = useCallback(() => {
    setFormData({ name: "", email: "", password: "", experienceLevel: "" });
  }, []);

  const handleTabLogin = () => {
    resetForm();
    goLogin();
  };

  const handleTabRegister = () => {
    resetForm();
    goRegister();
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { name: formData.name, email: formData.email, password: formData.password };

      const data = isLogin ? await loginUser(payload) : await registerUser(payload);

      login({
        token: data.token,
        user: data.user,
        csrfToken: data.csrfToken,
      });
      navigate(ROUTES.dashboard);
    } catch (err) {
      setError(getAuthErrorMessage(err, isLogin));
    } finally {
      setLoading(false);
    }
  };

  const tabBtn = (active: boolean) =>
    `flex-1 border-b-2 pb-3 text-center text-[length:var(--text-sm)] font-semibold uppercase tracking-wide transition-colors ${
      active
        ? "border-[var(--v2-accent-primary)] text-[var(--v2-text-primary)]"
        : "border-transparent text-[var(--v2-text-muted)] hover:text-[var(--v2-text-secondary)]"
    }`;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--v2-bg-base)] font-sans text-[var(--v2-text-primary)]">
      <div className="flex min-h-0 flex-1 flex-col md:grid md:min-h-screen md:grid-cols-[2fr_3fr]">
        {/* LEFT — system context (~40%) */}
        <aside
          className="relative flex flex-col justify-between border-b border-[var(--v2-border-subtle)] px-6 py-10 md:border-b-0 md:border-r md:px-10 md:py-14"
          style={{
            background:
              "linear-gradient(165deg, var(--v2-bg-section) 0%, var(--v2-bg-base) 55%, rgb(12 18 32) 100%)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden>
            <div className="absolute -left-20 top-1/4 h-64 w-64 rounded-full border border-[var(--v2-accent-primary)]" />
            <div className="absolute -right-10 bottom-1/4 h-48 w-48 rounded-full border border-[var(--v2-border-strong)]" />
          </div>

          <div className="relative z-[1] max-w-md">
            <p className="m-0 font-mono text-[length:var(--text-2xs)] font-semibold uppercase tracking-[var(--tracking-widest)] text-[var(--v2-text-muted)]">
              Noesis
            </p>
            <h1 className="mt-6 text-balance font-black tracking-tight text-[var(--v2-text-primary)]" style={{ fontSize: "var(--text-3xl)" }}>
              Access the system.
            </h1>
            <p className="mt-5 max-w-sm text-pretty leading-relaxed text-[var(--v2-text-secondary)]" style={{ fontSize: "var(--text-md)" }}>
              Your trades are evaluated before execution, and judged after they close.
            </p>
            <ul className="mt-8 list-none space-y-3 p-0 text-[length:var(--text-xs)] text-[var(--v2-text-muted)]">
              <li className="flex gap-2">
                <span className="font-mono text-[var(--v2-text-accent)]">—</span>
                Deterministic decision engine
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[var(--v2-text-accent)]">—</span>
                Behavioral tracking enabled
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-[var(--v2-text-accent)]">—</span>
                Simulation only (no real capital)
              </li>
            </ul>
          </div>

        </aside>

        {/* RIGHT — form (~60%) */}
        <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-8 md:px-12 md:py-10">
          <div className="mx-auto w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)] p-5 shadow-[var(--shadow-md)] sm:p-6 md:p-8">
            <div className="flex gap-2 border-b border-[var(--v2-border-subtle)]">
              <button type="button" className={tabBtn(isLogin)} onClick={handleTabLogin}>
                Sign In
              </button>
              <button type="button" className={tabBtn(!isLogin)} onClick={handleTabRegister}>
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              {!isLogin && (
                <div>
                  <label htmlFor="auth-name" className={labelClass}>
                    Name
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete={isLogin ? "email" : "email"}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="auth-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              {!isLogin && (
                <div>
                  <label htmlFor="auth-experience" className={labelClass}>
                    Experience level <span className="font-normal normal-case text-[var(--v2-text-disabled)]">(optional)</span>
                  </label>
                  <select
                    id="auth-experience"
                    name="experienceLevel"
                    value={formData.experienceLevel}
                    onChange={handleChange}
                    className={`${inputClass} cursor-pointer bg-[var(--v2-bg-card)]`}
                  >
                    <option value="">— Not specified —</option>
                    <option value="new">New to markets</option>
                    <option value="learning">Learning / paper</option>
                    <option value="active">Actively trading</option>
                    <option value="experienced">Experienced</option>
                  </select>
                </div>
              )}

              {error ? (
                <p
                  className="m-0 rounded-[var(--radius-md)] border border-[var(--v2-state-error-bg)] bg-[var(--v2-state-error-bg)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--v2-state-error)]"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--v2-accent-border)] bg-[var(--v2-accent-primary)] py-3 text-[length:var(--text-sm)] font-bold uppercase tracking-wide text-[var(--v2-text-inverse)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Authenticating…" : isLogin ? "Enter Terminal" : "Initialize Account"}
              </button>

              <p className="m-0 text-center text-[length:var(--text-2xs)] text-[var(--v2-text-muted)]">
                Simulation only. No real money involved.
              </p>

              {isLogin ? (
                <p className="m-0 text-center text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">
                  <button
                    type="button"
                    onClick={handleTabRegister}
                    className="border-0 bg-transparent p-0 font-semibold text-[var(--v2-text-accent)] underline-offset-2 hover:underline"
                  >
                    Create account
                  </button>
                </p>
              ) : (
                <p className="m-0 text-center text-[length:var(--text-sm)] text-[var(--v2-text-secondary)]">
                  Already have access?{" "}
                  <button
                    type="button"
                    onClick={handleTabLogin}
                    className="border-0 bg-transparent p-0 font-semibold text-[var(--v2-text-accent)] underline-offset-2 hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </form>
          </div>
        </div>
      </div>

      <footer className="border-t border-[var(--v2-border-subtle)] bg-[var(--v2-bg-section)] px-4 py-3 text-center md:py-3.5">
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[length:var(--text-2xs)] text-[var(--v2-text-muted)]">
          <span>
            <span className="text-[var(--v2-state-success)]" aria-hidden>
              ●
            </span>{" "}
            System ready
          </span>
          <span>
            <span className="text-[var(--v2-state-success)]" aria-hidden>
              ●
            </span>{" "}
            Behavioral engine active
          </span>
          <span>
            <span className="text-[var(--v2-state-warning)]" aria-hidden>
              ●
            </span>{" "}
            Simulation mode
          </span>
        </p>
      </footer>
    </div>
  );
}
