/**
 * Gauge.jsx
 * A half-circle gauge to display sensor values.
 */
import React from 'react';

const Gauge = ({ label, value, min = 0, max = 100, unit = "", color = "#22d3ee", subLabel = "" }) => {
    const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
    const rotation = (percentage / 100) * 180 - 90; // -90 to 90 degrees

    return (
        <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-900/40 border border-slate-800/60 shadow-lg backdrop-blur-sm">
            <div className="text-[0.65rem] text-slate-500 uppercase tracking-[0.12em] font-bold mb-3">
                {label}
            </div>
            
            <div className="relative w-32 h-16 overflow-hidden">
                {/* Background arc */}
                <div 
                    className="absolute top-0 left-0 w-32 h-32 rounded-full border-[10px] border-slate-800/40"
                    style={{ clipPath: 'inset(0 0 50% 0)' }}
                />
                
                {/* Progress arc */}
                <div 
                    className="absolute top-0 left-0 w-32 h-32 rounded-full border-[10px]"
                    style={{ 
                        borderColor: color,
                        clipPath: 'inset(0 0 50% 0)',
                        transform: `rotate(${(percentage / 100) * 180}deg)`,
                        transformOrigin: 'center',
                        transition: 'transform 1s ease-out'
                    }}
                />
                
                {/* Needle */}
                <div 
                    className="absolute bottom-0 left-1/2 w-1 h-14 bg-white/80 origin-bottom rounded-full shadow-sm"
                    style={{ 
                        transform: `translateX(-50%) rotate(${rotation}deg)`,
                        transition: 'transform 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                />
                
                {/* Center dot */}
                <div className="absolute bottom-[-4px] left-1/2 w-3 h-3 bg-slate-700 rounded-full border-2 border-slate-900 transform -translate-x-1/2" />
            </div>
            
            <div className="mt-2 text-center">
                <div className="text-xl font-black text-white tracking-tight">
                    {value != null ? value.toFixed(1) : "—"}
                    <span className="text-xs ml-0.5 text-slate-400 font-medium">{unit}</span>
                </div>
                {subLabel && (
                    <div className="text-[0.6rem] uppercase tracking-wider font-bold mt-0.5" style={{ color }}>
                        {subLabel}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Gauge;
