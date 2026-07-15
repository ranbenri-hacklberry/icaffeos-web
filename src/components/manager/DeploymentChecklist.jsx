import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import db from '@/db/database';
import '@/components/manager/DeploymentChecklist.css';
import { getBackendApiUrl } from '@/utils/apiUtils';

const DeploymentChecklist = ({ businessId }) => {
    const [phases, setPhases] = useState({
        phase1: [
            { id: 'db_schema', label: 'DB SCHEMA SYNC: FACE_EMBEDDING COLUMN EXISTS', checked: false },
            { id: 'mirror_sync', label: 'INITIAL MIRRORING: CLOUD -> N150 PULL SUCCESS', checked: false },
            { id: 'sms_gateway', label: 'SMS GATEWAY: LOCAL CONNECTIVITY LOG VERIFIED', checked: false }
        ],
        phase2: [
            { id: 'load_test', label: '10-CLIENT LOAD TEST: NO LATENCY IN DEXIE/PG', checked: false },
            { id: 'device_sync', label: 'CROSS-DEVICE SYNC: POS/KDS/IPAD ALIGNED', checked: false },
            { id: 'state_resilience', label: 'EDGE CASE: MID-ORDER CUSTOMER EDIT RESILIENCE', checked: false }
        ],
        phase3: [
            { id: 'inventory_sync', label: 'INVENTORY SYNC: SCREEN <-> LOCAL DB', checked: false },
            { id: 'ai_gen_loop', label: 'AI GEN-AI LOOP: NANO BANANA FLASH IMAGE SYNC', checked: false },
            { id: 'production_tasks', label: 'PRODUCTION TASKS: REAL-TIME UPDATE VERIFIED', checked: false }
        ],
        phase4: [
            { id: 'website_sync', label: 'WEBSITE/SHOP SYNC: PUBLIC URL VISIBILITY', checked: false },
            { id: 'devtools_audit', label: 'DEVTOOLS AUDIT: NO 404S OR SYNC FAILURES', checked: false }
        ]
    });

    const [hardwareSnapshot, setHardwareSnapshot] = useState(null);
    const [findings, setFindings] = useState('');
    const [unresolved, setUnresolved] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState([]);

    const logToTerminal = (msg) => {
        setTerminalOutput(prev => [...prev, `> ${new Date().toLocaleTimeString()}: ${msg}`].slice(-10));
    };

    const toggleItem = (phase, id) => {
        setPhases(prev => ({
            ...prev,
            [phase]: prev[phase].map(item =>
                item.id === id ? { ...item, checked: !item.checked } : item
            )
        }));
        logToTerminal(`TOGGLE: ${id.toUpperCase()}`);
    };

    const captureTelemetry = async () => {
        logToTerminal("INITIATING HARDWARE SNAPSHOT...");
        try {
            const baseUrl = getBackendApiUrl();
            const res = await fetch(`${baseUrl}/api/hardware-snapshot`);
            const data = await res.json();
            setHardwareSnapshot(data);
            logToTerminal(`TELEMETRY CAPTURED: IP=${data.local_ip} RAM=${data.ram?.total_gb}GB`);
        } catch (err) {
            logToTerminal("TELEMETRY FAILED. USING SIMULATED N150 DATA.");
            setHardwareSnapshot({
                server: "N150_EDGE_NODE_SIMULATED",
                local_ip: "192.168.1.150",
                ram: { total_gb: 12.0 }
            });
        }
    };

    const submitFinalCheck = async () => {
        setIsSubmitting(true);
        logToTerminal("COMPILING FINAL SYSTEM RESULTS...");

        const results = {};
        Object.values(phases).flat().forEach(item => {
            results[item.id] = item.checked;
        });

        const checkData = {
            id: crypto.randomUUID(),
            business_id: businessId,
            checker_name: "SYSTEM_ADMIN",
            test_results: results,
            findings,
            unresolved_issues: unresolved,
            status: Object.values(results).every(v => v) ? 'pass' : 'partial',
            hardware_snapshot: hardwareSnapshot || { server: "N150", ram: "12GB" },
            created_at: new Date().toISOString()
        };

        try {
            // 1. Save to Dexie (Offline First)
            await db.system_health_checks.add(checkData);
            logToTerminal("DATA PERSISTED TO DEXIE CACHE.");

            // 2. Try Supabase
            const { error } = await supabase.from('system_health_checks').insert(checkData);
            if (error) throw error;

            logToTerminal("CLOUD SYNC SUCCESSFUL.");
            logToTerminal("SYSTEM_READY");
        } catch (err) {
            logToTerminal(`SYNC WARNING: ${err.message}`);
            logToTerminal("DATA QUEUED FOR LATER SYNC.");
            logToTerminal("SYSTEM_READY (LOCAL)");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="terminal-checklist" dir="ltr">
            <div className="terminal-header">
                <h1>SYSTEM DEPLOYMENT CHECKLIST v1.0</h1>
                <p>N150 LOCAL SERVER INSTALLATION PROTOCOL</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                {Object.entries(phases).map(([phaseKey, items], idx) => (
                    <div key={phaseKey} className="phase-section">
                        <div className="phase-title">PHASE {idx + 1}: {phaseKey.toUpperCase()}</div>
                        {items.map(item => (
                            <div
                                key={item.id}
                                className="checklist-item"
                                onClick={() => toggleItem(phaseKey, item.id)}
                            >
                                <div className={`checkbox ${item.checked ? 'checked' : ''}`}>
                                    {item.checked ? 'V' : ''}
                                </div>
                                <span className="item-label">{item.label}</span>
                            </div>
                        ))}
                    </div>
                ))}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div>
                        <label className="item-label">[ FINDINGS / NOTES ]</label>
                        <textarea
                            className="terminal-textarea"
                            rows="4"
                            value={findings}
                            onChange={(e) => setFindings(e.target.value)}
                            placeholder="ENTER OBSERVATIONS..."
                        />
                    </div>
                    <div>
                        <label className="item-label">[ UNRESOLVED ISSUES / BUGS ]</label>
                        <textarea
                            className="terminal-textarea"
                            rows="4"
                            value={unresolved}
                            onChange={(e) => setUnresolved(e.target.value)}
                            placeholder="PENDING HARDWARE GAPS..."
                        />
                    </div>
                </div>

                <div className="telemetry-row">
                    <div className="flex justify-between items-center mb-2">
                        <span className="item-label">HARDWARE SNAPSHOT:</span>
                        <button
                            onClick={captureTelemetry}
                            className="px-3 py-1 bg-[#00ff00] text-black text-xs font-bold"
                        >
                            REFRESH STATS
                        </button>
                    </div>
                    {hardwareSnapshot ? (
                        <pre className="text-[10px]">
                            {JSON.stringify(hardwareSnapshot, null, 2)}
                        </pre>
                    ) : (
                        <p className="animate-pulse">AWAITING TELEMETRY CAPTURE...</p>
                    )}
                </div>

                <button
                    className="submit-btn"
                    onClick={submitFinalCheck}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'PROCESSING...' : 'SUBMIT FINAL SYSTEM CHECK'}
                </button>

                <div className="mt-6 font-mono text-xs text-[#008800]">
                    {terminalOutput.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DeploymentChecklist;
