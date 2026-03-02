import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Experiments from "./pages/Experiments";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/experiments" replace />} />
      <Route path="/dashboard" element={<Navigate to="/dashboard/experiments" replace />} />
      <Route path="/dashboard/experiments" element={<Experiments />} />
      <Route path="/dashboard/tubs" element={<Dashboard />} />
      <Route path="/dashboard/experiment/:id" element={<Home />} />
    </Routes>
  );
}

export default App;
