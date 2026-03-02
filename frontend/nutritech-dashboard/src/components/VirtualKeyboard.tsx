import React, { useState, useEffect } from 'react';

const VirtualKeyboard = ({ onKeyPress, onClose, visible }) => {
  const keys = [
    '1','2','3','4','5','6','7','8','9','0',
    'Q','W','E','R','T','Y','U','I','O','P',
    'A','S','D','F','G','H','J','K','L','@',
    'Z','X','C','V','B','N','M','.',',','/',
    'SPACE', 'BACKSPACE', 'DONE'
  ];

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-[#0f172a] border-t border-slate-800 p-4 z-[9999] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all duration-300">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-end mb-2">
          <button 
            onClick={(e) => { e.preventDefault(); onClose(); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-[0.65rem] font-bold text-slate-400 hover:text-white transition-colors border border-slate-700"
          >
            <span className="material-symbols-outlined text-sm">keyboard_hide</span>
            HIDE KEYBOARD
          </button>
        </div>
        <div className="grid grid-cols-10 gap-2">
        {keys.map((key) => {
          let span = 'col-span-1';
          let color = 'bg-slate-800/50 hover:bg-slate-700';
          if (key === 'SPACE') {
            span = 'col-span-3';
            color = 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300';
          }
          if (key === 'BACKSPACE' || key === 'DONE') {
            span = 'col-span-2';
            color = 'bg-slate-700 hover:bg-slate-600';
          }

          return (
            <button
              key={key}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onKeyPress(key);
              }}
              className={`${span} ${color} py-3 rounded-lg border border-slate-700/50 text-xs font-bold transition-all active:scale-95 flex items-center justify-center`}
            >
              {key}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
};

export default VirtualKeyboard;
