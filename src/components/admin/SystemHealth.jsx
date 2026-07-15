import React, { useState, useEffect } from 'react';
import {
    Activity,
    Cpu,
    HardDrive,
    Server,
    Terminal,
    RefreshCw,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { icaffe } from '@/lib/icaffeSDK';

/**
 * SystemHealth - Professional N150 Telemetry Widget
 * Accessible only when running in Electron.
 */
const SystemHealth = () => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isElectron, setIsElectron] = useState(false);
    const [isRebooting, setIsRebooting] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    useEffect(() => {
        if (!window.electron) {
            console.log('🌐 SystemHealth: Running in standard browser, direct OS access disabled.');
            return;
        }

        setIsElectron(true);

        // 1. Initial Fetch
        const fetchInitial = async () => {
            const initialStats = await window.electron.getStats();
            const initialLogs = await window.electron.getLogs(10);
            setStats(initialStats);
            setLogs(initialLogs.split('\n').filter(Boolean).slice(-5));
        };

        fetchInitial();

        // 2. Subscribe to real-time telemetry (N150-App is configured for 60s)
        const unsubscribe = window.electron.onTelemetry((data) => {
            setStats(prev => ({ ...prev, ...data }));
            setLastSync(new Date());

            // Auto-send telemetry to Supabase every 5 min (handled by icaffeSDK)
            handleRemoteTelemetry(data);
        });

        return () => unsubscribe();
    }, []);

    const handleRemoteTelemetry = async (data) => {
        // Simple throttling: Only send to cloud if 5 mins passed
        const now = Date.now();
        const lastCloudSync = parseInt(localStorage.getItem('last_telemetry_sync') || '0');

        if (now - lastCloudSync > 300000) { // 5 minutes
            try {
                await icaffe.system.sendTelemetry({
                    device_id: 'iCaffe-N150',
                    hostname: data.hostname,
                    cpu_load: parseFloat(data.memory), // Using memory usage as proxy for now or extend stats
                    ram_usage: parseFloat(data.memory),
                    docker_ok: data.backendHealthy,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem('last_telemetry_sync', now.toString());
                console.log('📡 Telemetry synced to cloud.');
            } catch (err) {
                console.warn('Failed to sync telemetry:', err);
            }
        }
    };

    const handleRestartDocker = async () => {
        setIsRebooting(true);
        try {
            await window.electron.runCommand('docker-compose restart');
            setTimeout(() => setIsRebooting(false), 3000);
        } catch (err) {
            setIsRebooting(false);
            alert('Reboot failed: ' + err.message);
        }
    };

    if (!isElectron) return null;

    return (
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 font-mono text-xs max-w-sm w-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">iCaffe OS Pulse</h3>
                </div>
                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    LIVE
                </div>
            </div>

            {/* Hardware Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Cpu size={14} />
                        <span>RAM Usage</span>
                    </div>
                    <div className="text-xl font-black text-white">
                        {stats?.memory?.usage || stats?.memory || '0'}%
                    </div>
                </div>
                <div className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <Server size={14} />
                        <span>Backend</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                        {stats?.backendHealthy ? (
                            <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : (
                            <AlertCircle size={16} className="text-rose-400" />
                        )}
                        <span className={stats?.backendHealthy ? 'text-emerald-400' : 'text-rose-400'}>
                            {stats?.backendHealthy ? 'HEALTHY' : 'ERROR'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Docker Status Error Action */}
            {!stats?.backendHealthy && (
                <button
                    onClick={handleRestartDocker}
                    disabled={isRebooting}
                    className="w-full mb-6 bg-rose-500/10 border border-rose-500/30 text-rose-400 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all active:scale-[0.98]"
                >
                    <RefreshCw size={16} className={isRebooting ? 'animate-spin' : ''} />
                    RESTART LOCAL SERVICES
                </button>
            )}

            {/* Log Viewer */}
            <div className="bg-black/40 rounded-2xl p-4 border border-slate-700/30 mb-4">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Terminal size={12} />
                    <span className="text-[10px] uppercase font-bold">Recent Logs</span>
                </div>
                <div className="space-y-1.5 overflow-hidden">
                    {logs.length > 0 ? logs.map((log, i) => (
                        <div key={i} className="text-[9px] text-slate-300 truncate opacity-80 border-l border-slate-700 pl-2">
                            {log}
                        </div>
                    )) : (
                        <div className="text-[9px] text-slate-500 italic">No recent activity</div>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center text-[9px] text-slate-500">
                <span>{stats?.hostname || 'N150-NODE'}</span>
                <span>{lastSync ? lastSync.toLocaleTimeString() : 'Establishing...'}</span>
            </div>
        </div>
    );
};

export default SystemHealth;
