/**
 * CorrelationMatrix.jsx
 * Grid display of parameter correlations.
 */
import React from 'react';

const CorrelationMatrix = ({ tubLabel = "Tub 01" }) => {
    // Hardcoded for UI demo as in the screenshot
    const params = ["PH", "MOIST", "NITROGEN", "PHOSPH"];
    const matrix = [
        [1.00, 0.03, -0.21, -0.39],
        [0.03, 1.00, 0.31, 0.28],
        [-0.21, 0.31, 1.00, 0.93],
        [-0.39, 0.28, 0.93, 1.00]
    ];

    const getColor = (val) => {
        if (val === 1) return "#22d3ee";
        if (val > 0.5) return "#06b6d4";
        if (val > 0) return "#0e7490";
        if (val < -0.5) return "#1e293b";
        return "#0f172a";
    };

    return (
        <div className="glass p-6 rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6">
                <div className="size-2 rounded-sm bg-cyan-400" />
                <h3 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-slate-400">
                    Parameter Correlation Matrix — {tubLabel}
                </h3>
            </div>

            <div className="grid grid-cols-5 gap-1 text-[0.65rem] font-bold text-slate-500 mb-2 uppercase tracking-widest">
                <div />
                {params.map(p => <div key={p} className="text-center">{p}</div>)}
            </div>

            <div className="space-y-1">
                {params.map((p, i) => (
                    <div key={p} className="grid grid-cols-5 gap-1 items-center">
                        <div className="text-left text-slate-500 pr-2 truncate">{p}</div>
                        {matrix[i].map((val, j) => (
                            <div 
                                key={j}
                                className="aspect-square flex items-center justify-center rounded-sm transition-all hover:scale-105 cursor-default border border-slate-800/40"
                                style={{ 
                                    backgroundColor: getColor(val),
                                    color: Math.abs(val) > 0.5 ? '#fff' : '#94a3b8'
                                }}
                            >
                                {val.toFixed(2)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[0.6rem] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="text-slate-400">-1.0 (INV)</span>
                    <div className="w-24 h-1 rounded-full bg-gradient-to-r from-slate-900 via-cyan-900 to-cyan-400" />
                    <span className="text-cyan-400">1.0 (POS)</span>
                </div>
            </div>
        </div>
    );
};

export default CorrelationMatrix;
