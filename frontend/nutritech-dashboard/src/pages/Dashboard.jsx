import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import API from "../services/api.js";
import Navbar from "../components/Navbar";
import ScoreComparisonChart from "../components/ScoreComparisonChart";
import TimeseriesPanel from "../components/TimeseriesPanel";
import PipelineControl from "../components/PipelineControl";
import Gauge from "../components/Gauge";
import CorrelationMatrix from "../components/CorrelationMatrix";

const TABS = ["Overview", "Physical Scores", "ML Predictions", "Comparison", "Pipeline"];

const scoreColor = (val) => {
  if (val == null) return "#64748b";
  if (val >= 0.7) return "#34d399";
  if (val >= 0.4) return "#fbbf24";
  return "#f87171";
};

const fmtScore = (v) => (v == null ? "—" : (v * 100).toFixed(1) + "%");

function ScorePill({ label, value, color }) {
  return (
    <div className="text-center">
      <div className="text-[0.65rem] text-slate-500 dark:text-slate-400 uppercase tracking-[0.08em] mb-1">
        {label}
      </div>
      <div
        className="text-[1.05rem] font-extrabold rounded-md px-2 py-1 border"
        style={{
          color,
          backgroundColor: `${color}22`,
          borderColor: `${color}55`,
        }}
      >
        {fmtScore(value)}
      </div>
    </div>
  );
}

function TubCard({ tub, onClick, selected, onPredict, isPredicting }) {
  const hc = scoreColor(tub.health_t);
  const state =
    tub.pred_health_t != null
      ? tub.pred_health_t
      : tub.health_t;

  const stateLabel =
    state == null
      ? "No data"
      : state >= 0.7
      ? "Optimal"
      : state >= 0.4
      ? "Watch"
      : "High Risk";

  const badgeColor =
    state == null
      ? "bg-slate-500/10 text-slate-400"
      : state >= 0.7
      ? "bg-emerald-500/10 text-emerald-400"
      : state >= 0.4
      ? "bg-amber-500/10 text-amber-400"
      : "bg-rose-500/10 text-rose-400";

  return (
    <div
      className={[
        "group rounded-xl border p-5 text-left transition-all w-full relative",
        "bg-slate-100/60 dark:bg-slate-900/60",
        selected
          ? "border-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          : "border-slate-200 dark:border-slate-800 hover:border-cyan-400/60",
      ].join(" ")}
    >
      <div className="cursor-pointer" onClick={onClick}>
        {/* coloured bar */}
        <div
          className="h-1.5 rounded-full mb-3"
          style={{ backgroundColor: hc }}
        />

        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-sm font-bold">
              {tub.tub_label || `Tub ${tub.tub_id}`}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {tub.plant_name || "—"}
            </div>
          </div>
          <span className="badge badge-grey">
            {tub.soil_type || "soil"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <ScorePill
            label="Health"
            value={tub.health_t}
            color={scoreColor(tub.health_t)}
          />
          <ScorePill
            label="Stress"
            value={tub.stress_t}
            color={scoreColor(1 - (tub.stress_t ?? 0))}
          />
          <ScorePill
            label="Risk"
            value={tub.risk_t}
            color={scoreColor(1 - (tub.risk_t ?? 0))}
          />
        </div>

        {tub.pred_health_t != null && (
          <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex gap-2">
            <ScorePill
              label="↯ Hlth"
              value={tub.pred_health_t}
              color="#818cf8"
            />
            <ScorePill
              label="↯ Str"
              value={tub.pred_stress_t}
              color="#818cf8"
            />
            <ScorePill
              label="↯ Risk"
              value={tub.pred_risk_t}
              color="#818cf8"
            />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[0.68rem] text-slate-500 dark:text-slate-400">
          <span>
            {tub.timestamp
              ? new Date(tub.timestamp).toLocaleString()
              : "No timestamp"}
          </span>
          <span
            className={[
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold uppercase tracking-[0.12em]",
              badgeColor,
            ].join(" ")}
          >
            <span className="size-1.5 rounded-full bg-current" />
            {stateLabel}
          </span>
        </div>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onPredict(tub.tub_id); }}
        disabled={isPredicting}
        className="mt-4 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[0.65rem] font-bold text-cyan-400 border border-cyan-400/20 transition-all flex items-center justify-center gap-2"
      >
        {isPredicting ? (
          <div className="size-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="material-symbols-outlined text-sm">psychology</span>
        )}
        {isPredicting ? "ANALYZING..." : "PREDICT"}
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { id } = useParams();
  const [experiments, setExperiments] = useState([]);
  const [selectedExp, setSelectedExp] = useState(id || null);
  const [summary, setSummary] = useState([]);
  const [selectedTub, setSelectedTub] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("Combined View"); // "Combined View" or "Individual Tub View"
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictingId, setPredictingId] = useState(null);

  // Load experiments
  useEffect(() => {
    API.get("/experiments/")
      .then((res) => {
        const exps = res.data.data || [];
        setExperiments(exps);
        if (id) {
          setSelectedExp(id);
        } else if (exps.length) {
          setSelectedExp(exps[0].id);
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Load summary when experiment changes
  const loadSummary = useCallback(() => {
    if (!selectedExp) return;
    setLoading(true);
    setError(null);
    API.get(`/dashboard/summary?experiment_id=${selectedExp}`)
      .then((res) => {
        const data = res.data.data || [];
        setSummary(data);
        if (data.length && !selectedTub) setSelectedTub(data[0].tub_id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedExp, selectedTub]);

  const handlePredict = async (tubId) => {
    setPredictingId(tubId);
    try {
      const res = await API.post("/ml/predict", { tub_id: tubId });
      if (res.data.success) {
        setPredictionResult({
          ...res.data.prediction,
          tub_label: summary.find(t => t.tub_id === tubId)?.tub_label || `Tub ${tubId}`
        });
      }
    } catch (e) {
      setError("Prediction failed: " + e.message);
    } finally {
      setPredictingId(null);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const activeTub = summary.find((t) => t.tub_id === selectedTub);

  const avg = (key) => {
    if (!summary.length) return null;
    const vals = summary
      .map((t) => t[key])
      .filter((v) => v != null);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const avgHealth = avg("health_t");
  const avgStress = avg("stress_t");
  const avgRisk = avg("risk_t");

  return (
    <div className="min-h-screen bg-background-dark text-slate-100 flex flex-col">
      <Navbar 
        selectedExp={selectedExp} 
        experiments={experiments} 
        onExpChange={(id) => {
          setSelectedExp(id);
          setSelectedTub(null);
        }} 
      />

      <main className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full">
        <Link 
          to="/dashboard/experiments" 
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest mb-6"
        >
          <span className="material-symbols-outlined text-[0.8rem]">arrow_back</span>
          Back to Experiments
        </Link>

        {/* View Toggle */}
        <div className="flex gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-800/40 w-fit mb-8 shadow-sm">
          {["Combined View", "Individual Tub View"].map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={[
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                viewMode === v
                  ? "bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/20"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Top row: title + status */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div className="space-y-1">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight font-display text-white">
              {experiments.find(e => e.id === selectedExp)?.title || "Active Tubs"}
            </h2>
            <p className="text-sm text-slate-500 max-w-md font-medium">
              Real-time telemetry from sensor-equipped modular environments.
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/50 text-xs text-slate-400">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              System Online
            </div>
            <button
              onClick={loadSummary}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/50 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">sync</span>
              Sync
            </button>
          </div>
        </div>

        {summary.length === 0 && !loading && (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-16 text-center mb-12">
            <div className="size-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-500">science</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No data for this experiment</h3>
            <p className="text-slate-400 max-w-sm mx-auto mb-8 text-sm">
              We couldn't find any tub telemetry for this protocol. Initialize buckets in the Admin Console to begin tracking.
            </p>
            <a href="/entry" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs uppercase tracking-widest hover:bg-cyan-400 transition-all active:scale-95 shadow-lg shadow-cyan-500/20">
              <span className="material-symbols-outlined text-base">add_circle</span>
              Configure Experiment
            </a>
          </div>
        )}

        {/* Metrics row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">
                Total Tubs
              </span>
              <span className="material-symbols-outlined text-cyan-300 text-lg">
                sensors
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {summary.length || "0"}
              </span>
            </div>
          </div>

          <div className="glass p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">
                Avg Health
              </span>
              <span className="material-symbols-outlined text-emerald-400 text-lg">
                local_florist
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {fmtScore(avgHealth)}
              </span>
            </div>
          </div>

          <div className="glass p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">
                Avg Risk
              </span>
              <span className="material-symbols-outlined text-rose-400 text-lg">
                warning
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">
                {fmtScore(avgRisk)}
              </span>
            </div>
          </div>
        </div>

        {/* Error + loading */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            ⚠ {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-16">
            <div className="spinner w-8 h-8" />
          </div>
        )}

        {/* Tabs (below metrics) */}
        <div className="mt-4 mb-4 border-b border-slate-800 flex gap-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "px-3 py-2 rounded-t-md border-b-2 -mb-px font-semibold tracking-wide",
                tab === t
                  ? "border-cyan-400 text-cyan-300"
                  : "border-transparent text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content for tabs */}
        {!loading && (
          <>
            {tab === "Overview" && (
              <div className="space-y-10">
                {viewMode === "Combined View" ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {summary.map((tub) => (
                        <TubCard
                          key={tub.tub_id}
                          tub={tub}
                          selected={tub.tub_id === selectedTub}
                          onClick={() => setSelectedTub(tub.tub_id)}
                          onPredict={handlePredict}
                          isPredicting={predictingId === tub.tub_id}
                        />
                      ))}
                    {summary.length === 0 && (
                      <div className="text-slate-500 text-sm p-6">
                        No tubs found for this experiment. Run the pipeline first.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    {activeTub ? (
                      <>
                        <div className="flex items-center gap-3 mb-6">
                          <div className="size-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/40" />
                          <h3 className="text-lg font-black uppercase tracking-widest text-white">
                            {activeTub.tub_label || `Tub ${activeTub.tub_id}`} Metrics
                          </h3>
                        </div>

                        {/* Gauges row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                          <Gauge 
                            label="PH BALANCE" 
                            value={6.2} // Hardcoded for demo to match screenshot
                            min={4} max={9} 
                            unit="" 
                            color="#34d399" 
                            subLabel="OPTIMAL RANGE"
                          />
                          <Gauge 
                            label="MOISTURE %" 
                            value={45.8} 
                            min={0} max={100} 
                            unit="%" 
                            color="#22d3ee" 
                            subLabel="ADEQUATE"
                          />
                          <Gauge 
                            label="NITROGEN (N)" 
                            value={124} 
                            min={0} max={500} 
                            unit="" 
                            color="#34d399" 
                            subLabel="STABLE"
                          />
                          <Gauge 
                            label="PHOSPHOROUS (P)" 
                            value={215} 
                            min={0} max={500} 
                            unit="" 
                            color="#f87171" 
                            subLabel="HIGH ALERT"
                          />
                        </div>

                        {/* Correlation Matrix */}
                        <div className="max-w-3xl">
                          <CorrelationMatrix tubLabel={activeTub.tub_label || `Tub ${activeTub.tub_id}`} />
                        </div>
                      </>
                    ) : (
                      <div className="text-slate-500 text-sm p-6">
                        Select a tub from the Combined View first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "Physical Scores" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    Physical Scores
                  </h2>
                  <p className="text-xs text-slate-400 mb-3">
                    Computed from sensor data using the physics-based formula
                    engine.
                  </p>
                </div>
                {activeTub && selectedExp ? (
                  <TimeseriesPanel
                    tubId={selectedTub}
                    experimentId={selectedExp}
                    mode="physical"
                    tubLabel={activeTub.tub_label}
                  />
                ) : (
                  <div className="text-slate-500 text-sm">
                    Select a tub from the Overview tab.
                  </div>
                )}
              </div>
            )}

            {tab === "ML Predictions" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    ML Predictions
                  </h2>
                  <p className="text-xs text-slate-400 mb-3">
                    XGBoost-predicted health, stress &amp; risk — trained on
                    your Supabase data.
                  </p>
                </div>
                {activeTub && selectedExp ? (
                  <TimeseriesPanel
                    tubId={selectedTub}
                    experimentId={selectedExp}
                    mode="predicted"
                    tubLabel={activeTub.tub_label}
                  />
                ) : (
                  <div className="text-slate-500 text-sm">
                    Select a tub from the Overview tab.
                  </div>
                )}
              </div>
            )}

            {tab === "Comparison" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">
                    Physical vs ML Comparison
                  </h2>
                  <p className="text-xs text-slate-400 mb-3">
                    Side-by-side view of computed formula scores vs model
                    predictions for all tubs.
                  </p>
                </div>
                <ScoreComparisonChart data={summary} />
              </div>
            )}

            {tab === "Pipeline" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Data Pipeline</h2>
                  <p className="text-xs text-slate-400 mb-3">
                    Trigger data fetch, cleaning, calculation and ML prediction.
                  </p>
                </div>
                <PipelineControl
                  experimentId={selectedExp}
                  onComplete={loadSummary}
                />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mt-auto px-6 md:px-10 py-3 border-t border-slate-800 text-[0.6rem] text-slate-500 uppercase tracking-[0.15em] flex items-center justify-between">
        <span>NutriTech Experimental Platform</span>
        <span>Dashboard · {new Date().getFullYear()}</span>
      </footer>

      {/* Prediction Result Modal */}
      {predictionResult && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-cyan-500/10 to-transparent">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-cyan-400">psychology</span>
                <h3 className="font-black uppercase tracking-widest text-xs text-white">
                  ML Analysis Result
                </h3>
              </div>
              <button onClick={() => setPredictionResult(null)} className="text-slate-500 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-8 text-center">
              <div className="mb-6">
                <div className="text-[0.65rem] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Target Environment</div>
                <div className="text-xl font-bold text-white">{predictionResult.tub_label}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                  <div className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest mb-1">Pred. Health</div>
                  <div className="text-2xl font-black text-emerald-400">{fmtScore(predictionResult.health_score)}</div>
                </div>
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-2xl">
                  <div className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest mb-1">Pred. Stress</div>
                  <div className="text-2xl font-black text-rose-400">{fmtScore(predictionResult.stress_index)}</div>
                </div>
              </div>

              <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl mb-6">
                <div className="text-[0.6rem] font-black text-cyan-500/70 uppercase tracking-widest mb-1">System Risk Level</div>
                <div className="text-lg font-black text-cyan-400 uppercase tracking-widest">{predictionResult.risk_level}</div>
              </div>

              <p className="text-[0.7rem] text-slate-500 leading-relaxed italic">
                Analysis generated via pre-deployed XGBoost regressor using real-time telemetry from {predictionResult.tub_label}.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800">
              <button 
                onClick={() => setPredictionResult(null)}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold text-xs uppercase tracking-widest hover:bg-slate-700 transition-all active:scale-95"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
