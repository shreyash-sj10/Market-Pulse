import { useQuery } from "@tanstack/react-query";
import {
  User,
  ShieldCheck,
  Zap,
  Activity,
  BarChart3,
  History,
  ShieldAlert,
  CheckCircle,
  Info,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getUserProfile } from "../../services/user.api.js";
import { ErrorState } from "../../components/common/ExperienceStates";
import { queryKeys } from "../../constants/queryKeys";

/**
 * TRADER PROFILE - PERFORMANCE IDENTITY ACTIVE
 * Dynamic representation of skill, behavior, and growth.
 */
export default function ProfilePage() {
  const { user: authUser } = useAuth();

  const { data: profile, isLoading: profileLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const response = await getUserProfile();
      return response?.data || {};
    },
  });

  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const audit = {
    score: profile?.skillScore || 0,
    level: profile?.skillScore >= 80 ? "ADVANCED" : profile?.skillScore >= 60 ? "STABLE" : "EMERGING",
    trend: profile?.winRate >= 50 ? "IMPROVING" : "STABLE",
    suggestion: profile?.recentLearning?.[0]?.correction || "Maintain protocol adherence to improve your trader profile.",
  };
  const recentReflections = profile?.recentLearning || [];
  const tags = profile?.tags || [];

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity size={32} className="text-indigo-600 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="app-page px-2 pt-4 pb-20">
      <header className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm mb-12 flex flex-col md:flex-row items-center gap-12">
        <div className="relative">
          <div className="w-32 h-32 bg-slate-900 rounded-[2.5rem] flex items-center justify-center border-4 border-indigo-500/20">
            <User size={48} className="text-white" />
          </div>
          <div className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2 rounded-xl shadow-lg border-2 border-white">
            <ShieldCheck size={16} />
          </div>
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{authUser?.name || "Institutional Trader"}</h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mx-auto md:mx-0">
              {audit.level} • {audit.trend}
            </div>
          </div>
          <p className="text-slate-500 font-bold max-w-xl leading-relaxed">
            {audit.suggestion}
          </p>
        </div>

        <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] text-center min-w-[180px] shadow-xl shadow-slate-900/10">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Global Skill Score</span>
          <span className="text-5xl font-black text-emerald-400">{audit.score}</span>
          <span className="block text-[8px] font-bold text-slate-600 mt-2 tracking-[0.2em] uppercase underline decoration-indigo-500 decoration-2">Verified Skillset</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-10">
              <BarChart3 size={18} className="text-indigo-600" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Institutional Breakdown</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[
                { label: "Total Trades", value: profile?.totalTrades || 0 },
                { label: "Win Rate", value: `${profile?.winRate || 0}%` },
                { label: "Skill Score", value: audit.score },
                { label: "Learning Tags", value: tags.length },
              ].map((item) => (
                <div key={item.label} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{item.label}</span>
                    <span className="text-lg font-black text-slate-900">{item.value}</span>
                  </div>
                  <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-10">
              <Zap size={18} className="text-amber-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Profile Tags</span>
            </div>

            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <div key={tag} className="flex items-center gap-3 px-4 py-3 bg-emerald-50 rounded-2xl text-emerald-700 font-bold text-[11px]">
                  <CheckCircle size={14} />
                  {tag}
                </div>
              ))}
              {tags.length === 0 && (
                <div className="py-12 w-full text-center border border-dashed border-slate-200 rounded-[2.5rem]">
                  <CheckCircle size={32} className="mx-auto text-emerald-500 mb-4" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No profile tags recorded yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 px-2">
            <div className="flex items-center gap-3 mb-4">
              <History size={16} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Executive Reflections</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recentReflections.map((reflection, i) => (
                <div key={`${reflection.symbol}-${i}`} className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
                  <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                    <div>
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2 block">
                        {reflection.symbol} • {reflection.verdict}
                      </span>
                      <p className="text-sm font-bold text-slate-200 leading-relaxed italic">"{reflection.insight}"</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Correction</span>
                      <span className="text-[10px] font-black text-emerald-400">{reflection.confidence ?? 50}%</span>
                    </div>
                  </div>
                </div>
              ))}
              {recentReflections.length === 0 && (
                <div className="md:col-span-2 py-12 text-center border border-dashed border-slate-200 rounded-[2.5rem] bg-white">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No recent learning snapshots available.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-xl">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-emerald-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Protocol Alignment</span>
              </div>
              <Info size={14} className="text-slate-600" />
            </div>

            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-40 h-40 rounded-full border-8 border-white/5 flex items-center justify-center relative shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                <div className="text-center">
                  <span className="text-4xl font-black text-white">{profile?.winRate || 0}%</span>
                  <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Win Rate</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-8 border-t border-white/5">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Total Trades</span>
                <span className="text-indigo-400">{profile?.totalTrades || 0}</span>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-slate-500">Recent Learning</span>
                <span className="text-emerald-400">{recentReflections.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <CheckCircle size={18} className="text-emerald-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Key Strengths</span>
            </div>

            <div className="space-y-3">
              {tags.map((tag) => (
                <div key={tag} className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl text-emerald-700 font-bold text-[11px]">
                  <CheckCircle size={14} />
                  {tag}
                </div>
              ))}
              {tags.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 italic">Evaluating performance vectors...</p>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <ShieldAlert size={18} className="text-rose-500" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Warning Signatures</span>
            </div>

            <div className="space-y-3">
              {recentReflections.map((reflection, i) => (
                <div key={`${reflection.primaryMistake}-${i}`} className="flex items-center gap-3 p-4 bg-rose-50 rounded-2xl text-rose-700 font-bold text-[11px]">
                  <ShieldAlert size={14} />
                  {reflection.primaryMistake}
                </div>
              ))}
              {recentReflections.length === 0 && (
                <p className="text-[10px] font-bold text-slate-400 italic">No critical signatures detected.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
