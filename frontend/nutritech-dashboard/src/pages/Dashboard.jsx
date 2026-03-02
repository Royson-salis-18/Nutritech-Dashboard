import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import API from "../services/api.js";
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

function TubCard({ tub, onClick, selected }) {
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
    <button
      type="button"
      onClick={onClick}
      className={[
        "group rounded-xl border p-5 text-left transition-all cursor-pointer w-full",
        "bg-slate-100/60 dark:bg-slate-900/60",
        selected
          ? "border-cyan-400 shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          : "border-slate-200 dark:border-slate-800 hover:border-cyan-400/60",
      ].join(" ")}
    >
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
    </button>
  );
}

export default function Dashboard() {
  const [experiments, setExperiments] = useState([]);
  const [selectedExp, setSelectedExp] = useState(null);
  const [summary, setSummary] = useState([]);
  const [selectedTub, setSelectedTub] = useState(null);
  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("Combined View"); // "Combined View" or "Individual Tub View"

  // Load experiments
  useEffect(() => {
    API.get("/experiments/")
      .then((res) => {
        const exps = res.data.data || [];
        setExperiments(exps);
        if (exps.length) setSelectedExp(exps[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

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
      {/* Header from Stitch-style layout */}
      <header className="flex items-center justify-between border-b border-slate-800 px-6 md:px-10 py-4 bg-background-dark/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/15 p-2 rounded-lg border border-cyan-500/30">
            <span className="material-symbols-outlined text-cyan-300 text-2xl">
              monitoring
            </span>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black tracking-tight font-display">
              nutritech{" "}
              <span className="text-cyan-400 text-sm md:text-base font-semibold">
                Dashboard
              </span>
            </h1>
            <p className="text-[0.7rem] text-slate-500 uppercase tracking-[0.18em]">
              Experimental tub monitoring
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-3 text-xs">
          <Link
            to="/dashboard/experiments"
            className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">
              arrow_back
            </span>
            Experiments
          </Link>

          <select
            value={selectedExp || ""}
            onChange={(e) => {
              setSelectedExp(Number(e.target.value));
              setSelectedTub(null);
            }}
            className="bg-slate-900/60 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          >
            {experiments.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title || `Experiment ${ex.id}`}
              </option>
            ))}
          </select>

          <div className="hidden md:flex items-center gap-2 ml-2">
            <div className="flex flex-col items-end">
              <span className="text-[0.65rem] font-semibold">
                Admin Console
              </span>
              <span className="text-[0.55rem] text-cyan-400 uppercase tracking-[0.2em]">
                Live
              </span>
            </div>
            <div className="size-8 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center">
              <span className="text-xs text-cyan-300 font-bold">NT</span>
            </div>
          </div>
        </nav>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 md:px-10 py-6 max-w-7xl mx-auto w-full">
        <Link 
          to="/dashboard/experiments" 
          className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest mb-4"
        >
          <span className="material-symbols-outlined text-[0.8rem]">arrow_back</span>
          Back to Experiments
        </Link>

        {/* View Toggle (as in screenshot) */}
        <div className="flex gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800/40 w-fit mb-8 shadow-sm">
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

          <div className="flex gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700">
              <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium">System Online</span>
            </div>
            <button
              type="button"
              onClick={loadSummary}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/60 text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                refresh
              </span>
              Sync
            </button>
          </div>
        </div>

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
    </div>
  );
}
