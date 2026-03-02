/**
 * TimeseriesPanel.jsx
 * Line chart of scores over time for a single tub.
 * mode = "physical"  → health_t, stress_t, risk_t
 * mode = "predicted" → pred_health_t, pred_stress_t, pred_risk_t
 */
import { useEffect, useState } from "react";
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend,
} from "recharts";
import API from "../services/api.js";

const PHYSICAL_SERIES = [
    { key: "health_t", label: "Health", color: "#34d399" },
    { key: "stress_t", label: "Stress", color: "#fbbf24" },
    { key: "risk_t", label: "Risk", color: "#f87171" },
];

const PREDICTED_SERIES = [
    { key: "pred_health_t", label: "↯ Health", color: "#818cf8" },
    { key: "pred_stress_t", label: "↯ Stress", color: "#a78bfa" },
    { key: "pred_risk_t", label: "↯ Risk", color: "#c4b5fd" },
];

const QUALITY_SERIES = [
    { key: "q_moisture", label: "Q Moisture", color: "#22d3ee" },
    { key: "q_climate", label: "Q Climate", color: "#38bdf8" },
    { key: "q_nutrient", label: "Q Nutrient", color: "#7dd3fc" },
    { key: "vpd_stress", label: "VPD Stress", color: "#fb923c" },
];

function fmtTime(ts) {
    try {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return ts; }
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: "#0d1829", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.77rem" }}>
            <div style={{ color: "#64748b", marginBottom: 8 }}>{label}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
                    {p.name}: {p.value != null ? (p.value * 100).toFixed(1) + "%" : "—"}
                </div>
            ))}
        </div>
    );
};

export default function TimeseriesPanel({ tubId, experimentId, mode = "physical", tubLabel }) {
    const [scores, setScores] = useState([]);
    const [quality, setQuality] = useState([]);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(100);

    useEffect(() => {
        if (!tubId || !experimentId) return;
        setLoading(true);
        API.get(`/dashboard/tub/${tubId}/timeseries?experiment_id=${experimentId}&limit=${limit}`)
            .then(res => {
                setScores(res.data.scores || []);
                setQuality(res.data.quality || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [tubId, experimentId, limit]);

    const series = mode === "physical" ? PHYSICAL_SERIES : PREDICTED_SERIES;

    const chartData = scores.map((s, i) => {
        const q = quality[i] || {};
        const point = { time: fmtTime(s.timestamp) };
        series.forEach(sr => { point[sr.label] = s[sr.key]; });
        QUALITY_SERIES.forEach(qs => { point[qs.label] = q[qs.key]; });
        return point;
    });

    if (loading) {
        return <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><div className="spinner" style={{ width: 28, height: 28 }} /></div>;
    }

    if (!scores.length) {
        return <div style={{ color: "#64748b", padding: "2rem" }}>No time-series data for this tub. Run the pipeline first.</div>;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Score timeseries */}
            <div className="glass" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <div style={{ fontWeight: 700 }}>{tubLabel || `Tub ${tubId}`} — {mode === "physical" ? "Physical Scores" : "ML Predictions"}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{scores.length} data points</div>
                    </div>
                    <select
                        value={limit}
                        onChange={e => setLimit(Number(e.target.value))}
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#f1f5f9", borderRadius: 8, padding: "0.3rem 0.6rem", fontSize: "0.78rem" }}
                    >
                        {[50, 100, 200, 500].map(v => <option key={v} value={v}>{v} pts</option>)}
                    </select>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                        {series.map(s => (
                            <Line key={s.key} type="monotone" dataKey={s.label} stroke={s.color} strokeWidth={2} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Quality indices */}
            {mode === "physical" && quality.length > 0 && (
                <div className="glass" style={{ padding: "1.5rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: 16 }}>Quality Indices</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                            {QUALITY_SERIES.map(s => (
                                <Line key={s.key} type="monotone" dataKey={s.label} stroke={s.color} strokeWidth={1.5} dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
