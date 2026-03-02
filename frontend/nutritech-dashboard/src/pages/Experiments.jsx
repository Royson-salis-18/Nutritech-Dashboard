import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import API from "../services/api.js";
import Navbar from "../components/Navbar";

function statusChip(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed" || normalized === "archived") {
    return {
      label: "Completed",
      className: "bg-emerald-500/10 text-emerald-300 border border-emerald-400/40",
    };
  }
  if (normalized === "paused") {
    return {
      label: "Paused",
      className: "bg-amber-500/10 text-amber-300 border border-amber-400/40",
    };
  }
  return {
    label: "Ongoing",
    className: "bg-cyan-500/10 text-cyan-300 border border-cyan-400/40",
  };
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

export default function Experiments() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ title: "", description: "", num_buckets: 1 });
  const [tubs, setTubs] = useState([]);
  
  const location = useLocation();

  const fetchExperiments = useCallback(() => {
    setLoading(true);
    setError(null);
    API.get("/experiments/")
      .then((res) => {
        setExperiments(res.data.data || []);
      })
      .catch((e) => {
        console.error("Fetch error:", e);
        setError(e.response?.data?.message || e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  const handleNext = () => {
    if (step === 1) {
      if (!formData.title.trim()) {
        setError("Please enter an experiment title");
        return;
      }
      setError(null);
      const count = parseInt(formData.num_buckets) || 1;
      const initialTubs = Array.from({ length: count }, (_, i) => ({
        bucket_number: i + 1,
        soil_type: "Standard",
        plant_type: ""
      }));
      setTubs(initialTubs);
      setStep(2);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Create the experiment
      const expRes = await API.post("/experiments/", formData);
      
      if (!expRes.data.success) {
        throw new Error(expRes.data.message || "Failed to create experiment");
      }

      const expId = expRes.data.experiment.id;
      
      // 2. Create all tubs/buckets
      for (const tub of tubs) {
        const tubRes = await API.post(`/experiments/${expId}/buckets`, tub);
        if (!tubRes.data.success) {
          throw new Error(tubRes.data.message || `Failed to create tub ${tub.bucket_number}`);
        }
      }
      
      setShowAddModal(false);
      setStep(1);
      setFormData({ title: "", description: "", num_buckets: 1 });
      fetchExperiments();
    } catch (e) {
      console.error("Create error:", e);
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalOngoing = experiments.filter(
    (e) => (e.status || "").toLowerCase() === "ongoing" || (e.status || "").toLowerCase() === "active",
  ).length;

  return (
    <div className="min-h-screen bg-background-dark text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight font-display">
              Active Experiments
            </h2>
            <p className="text-sm text-slate-400 max-w-md">
              Managed research protocols and nutrient cycling tracking.
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/50 text-xs text-slate-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-slate-900 font-bold text-xs uppercase tracking-widest hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              New Protocol
            </button>
            <button
              onClick={fetchExperiments}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/50 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              Sync
            </button>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass p-4 rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">
                Total Ongoing
              </span>
              <span className="material-symbols-outlined text-emerald-300 text-lg">
                equalizer
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{totalOngoing}</span>
              <span className="text-[0.65rem] font-semibold text-emerald-300 uppercase tracking-[0.18em]">
                Active
              </span>
            </div>
          </div>

          <div className="glass p-4 rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">
                Total Experiments
              </span>
              <span className="material-symbols-outlined text-cyan-300 text-lg">
                science
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {experiments.length}
              </span>
            </div>
          </div>

          <div className="glass p-4 rounded-xl border border-slate-800 bg-slate-900/70">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">
                Archived
              </span>
              <span className="material-symbols-outlined text-slate-400 text-lg">
                inventory_2
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {
                  experiments.filter(
                    (e) =>
                      (e.status || "").toLowerCase() === "completed" ||
                      (e.status || "").toLowerCase() === "archived",
                  ).length
                }
              </span>
            </div>
          </div>
        </div>

        {error && !showAddModal && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            ⚠ {error}
          </div>
        )}

        {/* Modal Overlay */}
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="font-black uppercase tracking-widest text-sm text-cyan-400">
                  {step === 1 ? "Initialize Protocol" : "Configure Tubs"}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-6">
                {error && (
                  <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 animate-in fade-in slide-in-from-top-1">
                    ⚠ {error}
                  </div>
                )}
                {step === 1 ? (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest ml-1">Experiment Title</label>
                      <input 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                        placeholder="e.g. Hydroponic Phase Alpha"
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                      <textarea 
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm h-24 focus:ring-1 focus:ring-cyan-500 outline-none"
                        placeholder="Research objectives and parameters..."
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest ml-1">Number of Tubs</label>
                      <input 
                        type="number"
                        min="1" max="12"
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                        value={formData.num_buckets}
                        onChange={e => setFormData({...formData, num_buckets: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                    {tubs.map((tub, i) => (
                      <div key={i} className="p-4 bg-slate-950/30 border border-slate-800/50 rounded-2xl flex gap-4 items-end">
                        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400">
                          #{tub.bucket_number}
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest ml-1">Plant Name</label>
                          <input 
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                            placeholder="Tomato / Lettuce"
                            value={tub.plant_type}
                            onChange={e => {
                              const newTubs = [...tubs];
                              newTubs[i].plant_type = e.target.value;
                              setTubs(newTubs);
                            }}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest ml-1">Soil Type</label>
                          <select 
                            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                            value={tub.soil_type}
                            onChange={e => {
                              const newTubs = [...tubs];
                              newTubs[i].soil_type = e.target.value;
                              setTubs(newTubs);
                            }}
                          >
                            <option value="Standard">Standard</option>
                            <option value="Sandy">Sandy</option>
                            <option value="Clay">Clay</option>
                            <option value="Loam">Loam</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex justify-end gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  CANCEL
                </button>
                {step === 1 ? (
                  <button 
                    onClick={handleNext}
                    className="px-6 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-all"
                  >
                    NEXT: CONFIGURE TUBS
                  </button>
                ) : (
                  <button 
                    onClick={handleCreate}
                    className="px-6 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {loading ? "SAVING..." : "FINALIZE PROTOCOL"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="spinner w-8 h-8" />
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {experiments.map((exp) => {
              const chip = statusChip(exp.status);
              return (
                <Link
                  key={exp.id}
                  to={`/dashboard/experiment/${exp.id}`}
                  className="group rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-cyan-400/50 transition-all overflow-hidden flex flex-col"
                >
                  <div className="relative h-28 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-slate-500 group-hover:text-cyan-300 transition-colors">
                      lab_panel
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">
                          {exp.title || `Exp ${exp.id}`}
                        </div>
                        <div className="text-[0.7rem] text-slate-500">
                          Linked Tubs: —
                        </div>
                      </div>
                      <span
                        className={[
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.15em]",
                          chip.className,
                        ].join(" ")}
                      >
                        {chip.label}
                      </span>
                    </div>

                    <div className="mt-1 text-[0.7rem] text-slate-500 flex justify-between">
                      <span>Start Date</span>
                      <span className="text-slate-200">
                        {formatDate(exp.started_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
            {!experiments.length && !error && (
              <div className="text-slate-500 text-sm">
                No experiments found in Supabase yet.
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-auto px-6 md:px-10 py-3 border-t border-slate-800 text-[0.6rem] text-slate-500 uppercase tracking-[0.15em] flex items-center justify-between">
        <span>NutriTech Experimental Platform</span>
        <span>Experiments · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

