import { useEffect, useState } from "react" ; 
import { Link } from "react-router-dom";
import API from "../services/api.js"; 
import Navbar from "../components/Navbar";

function Home(){
    const [tubs, setTubs] = useState([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        fetchTubs();
    }, []);

    const fetchTubs = async () => {
        try{
            setLoading(true);
            const res = await API.get("/tubs/"); 
            setTubs(res.data.data);
        } catch(err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background-dark text-slate-100 flex flex-col">
            <Navbar />

            <div className="flex-1 p-6 md:p-10 max-w-[1600px] mx-auto w-full space-y-8">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black tracking-tight font-display">
                        Active Tubs
                    </h2>
                    <p className="text-slate-400">
                        Real-time telemetry from sensor-equipped modular environments
                    </p>
                </div>

                <div className="flex gap-3 items-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/50 text-xs text-slate-400">
                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                        System Online
                    </div>
                    <button
                        onClick={fetchTubs}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/50 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-sm">sync</span>
                        Sync
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="text-slate-400">Loading tubs...</div>
            )}

            {/* Tub Grid */}
            {!loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {tubs.map((tub) => (
                        <div
                            key={tub.id}
                            className="group rounded-xl bg-slate-900/50 border border-slate-800 p-5 hover:border-primary/50 transition-all cursor-pointer"
                        >
                            <div className="aspect-video w-full rounded-lg mb-4 bg-slate-800 flex items-center justify-center">
                                <span className="text-slate-400 text-xl">
                                    {tub.label}
                                </span>
                            </div>

                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold">
                                    {tub.label}
                                </h3>
                                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary uppercase">
                                    {tub.growth_rate || "none"} 
                                </span>
                            </div>

                            <div className="space-y-1 text-sm text-slate-400">
                                <p>Soil: {tub.soil_type || "N/A"}</p>
                                <p>Plant: {tub.plant_name || "N/A"}</p>
                            </div>
                        </div>
                    ))}

                    {tubs.length === 0 && (
                        <div className="text-slate-400">
                            No tubs found.
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
    );
}

export default Home; 