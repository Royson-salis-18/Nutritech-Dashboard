import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Experiments from "./pages/Experiments";
import VirtualKeyboard from "./components/VirtualKeyboard";
import API from "./services/api";

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
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard/experiments" replace />} />
        <Route path="/dashboard" element={<Navigate to="/dashboard/experiments" replace />} />
        <Route path="/dashboard/experiments" element={<Experiments />} />
        <Route path="/dashboard/tubs" element={<Dashboard />} />
        <Route path="/dashboard/experiment/:id" element={<Dashboard />} />
      </Routes>
      
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
