import { useEffect, useState } from "react" ; 
import { Link } from "react-router-dom";
import API from "../services/api.js"; 

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
        <div className="min-h-screen bg-background-dark text-slate-100 p-6 md:p-10">
            <Link 
                to="/dashboard/experiments" 
                className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold text-slate-500 hover:text-cyan-400 transition-colors uppercase tracking-widest mb-6"
            >
                <span className="material-symbols-outlined text-[0.8rem]">arrow_back</span>
                Back to Experiments
            </Link>

            <div className="space-y-8">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black tracking-tight">
                        Active Tubs
                    </h2>
                    <p className="text-slate-400">
                        Real-time telemetry from sensor-equipped modular environments
                    </p>
                </div>

                <button
                    onClick={fetchTubs}
                    className="px-4 py-2 rounded-xl border border-primary text-primary hover:bg-primary/10"
                >
                    Sync
                </button>
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