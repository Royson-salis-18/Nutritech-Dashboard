/**
 * PipelineControl.jsx
 * Panel to trigger and monitor the data pipeline.
 */
import { useState, useEffect } from "react";
import API from "../services/api.js";

export default function PipelineControl({ experimentId, onComplete }) {
    const [status, setStatus] = useState(null);
    const [running, setRunning] = useState(false);
    const [lastResult, setLastResult] = useState(null);
    const [retrain, setRetrain] = useState(false);
    const [error, setError] = useState(null);

    // Load last pipeline status on mount
    useEffect(() => {
        API.get("/pipeline/status")
            .then(res => setStatus(res.data))
            .catch(() => { });
    }, []);

    const runPipeline = async () => {
        if (!experimentId) return;
        setRunning(true);
        setError(null);
        try {
            const res = await API.post("/pipeline/run", { experiment_id: experimentId, retrain });
            setLastResult(res.data);
            setStatus(res.data);
            if (onComplete) onComplete();
        } catch (e) {
            setError(e.response?.data?.message || e.message);
        } finally {
            setRunning(false);
        }
    };

    const stat = lastResult || status;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>

            {/* Trigger card */}
            <div className="glass" style={{ padding: "1.75rem" }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>Run Full Pipeline</div>
                <div style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 20 }}>
                    Fetches unprocessed sensor rows for experiment #{experimentId || "—"},
                    cleans them, computes physics scores, trains/runs XGBoost models,
                    and writes everything back to Supabase.
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "#94a3b8", cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={retrain}
                            onChange={e => setRetrain(e.target.checked)}
                            style={{ accentColor: "#22d3ee", width: 14, height: 14 }}
                        />
                        Force retrain ML models
                    </label>
                </div>

                <button
                    id="btn-run-pipeline"
                    onClick={runPipeline}
                    disabled={running || !experimentId}
                    className="btn btn-primary"
                    style={{ opacity: (running || !experimentId) ? 0.5 : 1, cursor: (running || !experimentId) ? "not-allowed" : "pointer" }}
                >
                    {running ? (
                        <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Running…</>
                    ) : (
                        <>▶ Run Pipeline</>
                    )}
                </button>

                {error && (
                    <div style={{ marginTop: 16, padding: "0.75rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, color: "#f87171", fontSize: "0.8rem" }}>
                        ⚠ {error}
                    </div>
                )}
            </div>

            {/* Last run results */}
            {stat && stat.status !== "never_run" && (
                <div className="glass" style={{ padding: "1.75rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>
                        Last Run {stat.ran_at ? `— ${new Date(stat.ran_at).toLocaleString()}` : ""}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
                        {[
                            { label: "Rows Fetched", value: stat.rows_fetched, color: "#22d3ee" },
                            { label: "After Cleaning", value: stat.rows_after_cleaning, color: "#34d399" },
                            { label: "Proc. Readings", value: stat.processed_readings_inserted, color: "#a3e635" },
                            { label: "Scores Written", value: stat.computed_scores_inserted, color: "#818cf8" },
                            { label: "Predictions", value: stat.predictions_written, color: "#c4b5fd" },
                        ].map(item => (
                            <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "0.9rem" }}>
                                <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                                    {item.label}
                                </div>
                                <div style={{ fontSize: "1.4rem", fontWeight: 800, color: item.color }}>
                                    {item.value ?? "—"}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cleaning report */}
                    {stat.cleaning_report && (
                        <div>
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#64748b", marginBottom: 12 }}>
                                Cleaning Report
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                                {[
                                    { label: "Input Rows", value: stat.cleaning_report.input_rows },
                                    { label: "Dropped", value: stat.cleaning_report.dropped_missing_id },
                                    { label: "Nulls Filled", value: stat.cleaning_report.nulls_filled },
                                    { label: "Values Clipped", value: stat.cleaning_report.clipped },
                                    { label: "Outliers Flagged", value: stat.cleaning_report.outliers_flagged },
                                    { label: "Output Rows", value: stat.cleaning_report.output_rows },
                                ].map(item => (
                                    <div key={item.label} style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                                        <span style={{ color: "#64748b" }}>{item.label}: </span>
                                        <span style={{ fontWeight: 700, color: "#f1f5f9" }}>{item.value ?? "—"}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {stat?.status === "never_run" && (
                <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    Pipeline has not been run yet. Click "Run Pipeline" to start.
                </div>
            )}
        </div>
    );
}
