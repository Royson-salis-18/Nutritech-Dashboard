import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = ({ experimentTitle, selectedExp, experiments, onExpChange }) => {
  const location = useLocation();
  const isDashboard = location.pathname.includes('/dashboard') && !location.pathname.includes('/experiments');

  return (
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
            {isDashboard ? 'Experimental tub monitoring' : 'Experimental protocol overview'}
          </p>
        </div>
      </div>

      <nav className="flex items-center gap-3 text-xs">
        {isDashboard ? (
          <>
            <Link
              to="/dashboard/experiments"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 transition-all active:scale-95 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span className="font-bold tracking-tight">Experiments</span>
            </Link>
            
            <div className="w-[1px] h-8 bg-slate-800 mx-1"></div>

            <a
              href="/entry"
              className="hidden md:flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-5 h-8 rounded-full border-2 border-cyan-500/30 flex items-start justify-center p-1">
                <div className="w-1 h-2 bg-cyan-400/60 rounded-full animate-bounce"></div>
              </div>
              
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[0.75rem] font-black text-white tracking-tight">
                  Admin Console
                </span>
                <span className="text-[0.65rem] text-cyan-400 font-black uppercase tracking-[0.2em]">
                  Live
                </span>
              </div>
            </a>
          </>
        ) : (
          <>
            <Link
              to="/dashboard/tubs"
              className={[
                "px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all",
                location.pathname === "/dashboard/tubs"
                  ? "bg-slate-100 text-slate-900 border-slate-100"
                  : "bg-slate-900/60 text-slate-200 border-slate-700 hover:border-cyan-400/60 hover:text-cyan-300",
              ].join(" ")}
            >
              Tubs
            </Link>
            <Link
              to="/dashboard/experiments"
              className={[
                "px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all",
                location.pathname.startsWith("/dashboard/experiments")
                  ? "bg-cyan-500 text-slate-900 border-cyan-500 shadow-lg shadow-cyan-500/20"
                  : "bg-slate-900/60 text-slate-200 border-slate-700 hover:border-cyan-400/60 hover:text-cyan-300",
              ].join(" ")}
            >
              Experiments
            </Link>
            <a
              href="/"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors ml-2"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Landing
            </a>

            <div className="w-[1px] h-8 bg-slate-800 mx-1"></div>

            <div className="hidden md:flex items-center gap-3">
              <div className="w-5 h-8 rounded-full border-2 border-slate-700/30 flex items-start justify-center p-1">
                <div className="w-1 h-2 bg-slate-500/60 rounded-full"></div>
              </div>
              
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[0.75rem] font-black text-slate-400 tracking-tight">
                  Admin User
                </span>
                <span className="text-[0.65rem] text-slate-500 font-black uppercase tracking-[0.2em]">
                  Kiosk Mode
                </span>
              </div>
            </div>
          </>
        )}

        <div className="size-8 rounded-full bg-slate-900 border border-cyan-500/40 flex items-center justify-center shadow-inner ml-2">
          <span className="text-xs text-cyan-300 font-bold">NT</span>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
