import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Experiments from "./pages/Experiments";
import VirtualKeyboard from "./components/VirtualKeyboard";
import API from "./services/api";

function LoginGate({ children }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("nt_token");

  if (token) return children;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await API.post("/login", { email, password });
      if (res.data.success) {
        localStorage.setItem("nt_token", res.data.token);
        window.location.reload();
      } else {
        setError(res.data.message || "Login failed");
      }
    } catch (err) {
      setError("Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050a14] flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-cyan-500/15 p-2 rounded-xl border border-cyan-500/30">
            <span className="material-symbols-outlined text-cyan-400 text-2xl">monitoring</span>
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">nutritech <span className="text-cyan-400 font-semibold text-base">Admin</span></h1>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
              placeholder="admin@nutritech.ai" required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[0.65rem] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Password</label>
            <input 
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
              placeholder="••••••••" required
            />
          </div>
          
          {error && <div className="text-rose-400 text-xs font-bold px-1 animate-pulse">⚠ {error}</div>}
          
          <button 
            type="submit" disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? "AUTHENTICATING..." : "ACCESS DASHBOARD"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [kbVisible, setKbVisible] = useState(false);
  const [activeInput, setActiveInput] = useState(null);

  useEffect(() => {
    const handleFocus = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setActiveInput(e.target);
        setKbVisible(true);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => {
      document.removeEventListener('focusin', handleFocus);
    };
  }, []);

  const handleKeyPress = (key) => {
    if (!activeInput) return;

    if (key === 'BACKSPACE') {
      activeInput.value = activeInput.value.slice(0, -1);
    } else if (key === 'SPACE') {
      activeInput.value += ' ';
    } else if (key === 'DONE') {
      setKbVisible(false);
      activeInput.blur();
    } else {
      activeInput.value += key.toLowerCase();
    }
    
    const event = new Event('input', { bubbles: true });
    activeInput.dispatchEvent(event);
    const changeEvent = new Event('change', { bubbles: true });
    activeInput.dispatchEvent(changeEvent);
  };

  return (
    <>
      <LoginGate>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard/experiments" replace />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/experiments" replace />} />
          <Route path="/dashboard/experiments" element={<Experiments />} />
          <Route path="/dashboard/tubs" element={<Dashboard />} />
          <Route path="/dashboard/experiment/:id" element={<Dashboard />} />
        </Routes>
      </LoginGate>
      
      <div id="virtual-keyboard">
        <VirtualKeyboard 
          visible={kbVisible} 
          onKeyPress={handleKeyPress} 
          onClose={() => setKbVisible(false)} 
        />
      </div>
    </>
  );
}

export default App;
