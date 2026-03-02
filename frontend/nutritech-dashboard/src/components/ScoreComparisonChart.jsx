/**
 * ScoreComparisonChart.jsx
 * Grouped bar chart: physical vs ML-predicted scores for each tub.
 */
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: "#0d1829", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.78rem",
        }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color, marginBottom: 3 }}>
                    {p.name}: {p.value != null ? (p.value * 100).toFixed(1) + "%" : "—"}
                </div>
            ))}
        </div>
    );
};

export default function ScoreComparisonChart({ data }) {
    if (!data || data.length === 0) {
        return <div style={{ color: "#64748b", padding: "2rem" }}>No data available. Run the pipeline first.</div>;
    }

    const chartData = data.map(tub => ({
        name: tub.tub_label || `Tub ${tub.tub_id}`,
        "Physical Health": tub.health_t,
        "ML Health": tub.pred_health_t,
        "Physical Stress": tub.stress_t,
        "ML Stress": tub.pred_stress_t,
        "Physical Risk": tub.risk_t,
        "ML Risk": tub.pred_risk_t,
    }));

    const sections = [
        {
            title: "Health Score (Higher = Healthier)",
            bars: [
                { key: "Physical Health", color: "#34d399" },
                { key: "ML Health", color: "#059669" },
            ],
        },
        {
            title: "Stress Index (Lower = Better)",
            bars: [
                { key: "Physical Stress", color: "#fbbf24" },
                { key: "ML Stress", color: "#d97706" },
            ],
        },
        {
            title: "Risk Index (Lower = Better)",
            bars: [
                { key: "Physical Risk", color: "#f87171" },
                { key: "ML Risk", color: "#dc2626" },
            ],
        },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {sections.map(section => (
                <div key={section.title} className="glass" style={{ padding: "1.5rem" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 16 }}>
                        {section.title}
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: "0.75rem", paddingTop: 12 }} />
                            {section.bars.map(b => (
                                <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={48} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            ))}
        </div>
    );
}
