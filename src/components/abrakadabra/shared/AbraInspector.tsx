import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Edit, MousePointer2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAbraHat, useMagicSDK } from '@/context/AbraHatContext';

const AbraInspector = () => {
    const { inspectorActive, toggleInspector, isWearingHat, wearHat } = useAbraHat();
    const [hoveredElement, setHoveredElement] = useState<{ rect: DOMRect; path: string; tagName: string } | null>(null);
    const [selectedElement, setSelectedElement] = useState<{ rect: DOMRect; path: string; tagName: string; text: string } | null>(null);
    const [requestInput, setRequestInput] = useState('');
    const [loading, setLoading] = useState(false);
    const sdk = useMagicSDK();

    // Inspector Logic
    useEffect(() => {
        if (!inspectorActive) return;

        const handleMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('#abra-inspector-ui')) return; // Ignore inspector UI

            const rect = target.getBoundingClientRect();
            // Simple path generation
            let path = target.tagName.toLowerCase();
            if (target.id) path += `#${target.id}`;
            if (target.className && typeof target.className === 'string') {
                path += `.${target.className.split(' ')[0]}`;
            }

            setHoveredElement({
                rect,
                path,
                tagName: target.tagName
            });
        };

        const handleClick = (e: MouseEvent) => {
            if (!inspectorActive) return;
            const target = e.target as HTMLElement;
            if (target.closest('#abra-inspector-ui')) return;

            e.preventDefault();
            e.stopPropagation();

            const rect = target.getBoundingClientRect();
            let path = target.tagName.toLowerCase();
            if (target.id) path += `#${target.id}`;

            setSelectedElement({
                rect,
                path,
                tagName: target.tagName,
                text: target.innerText?.slice(0, 50) || ''
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('click', handleClick, true); // Capture phase

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('click', handleClick, true);
        };
    }, [inspectorActive]);

    const handleCastSpell = async () => {
        if (!selectedElement || !requestInput.trim()) return;
        setLoading(true);

        try {
            // Simulate spell casting similar to MayaOverlay
            const isHelloWorld = requestInput.toLowerCase().includes('hello world') || requestInput.includes('הלו וורלד');

            if (isHelloWorld) {
                // Use the same mock logic
                const manifesto = {
                    spell_id: 'kds-hello-world',
                    incantation: 'The Hello World Invocation',
                    effect: 'Adds a magical green Hello World badge to the selected component.',
                    caster: { employee_id: 'inspector', role: 'admin', business_id: '2222' },
                    correlation_id: `abra-inspect-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    target_component: {
                        component_id: 'selected-component',
                        file_path: 'src/pages/kds/components/OrderCard.jsx', // Hardcoded for demo
                        current_behavior: 'Standard display',
                        proposed_behavior: 'Visual confirmation of Abrakadabra integration.'
                    },
                    impact_analysis: {
                        affected_screens: [],
                        affected_supabase_tables: [],
                        affected_dexie_tables: [],
                        affected_rpcs: [],
                        risk_level: 'low'
                    },
                    database_requirements: {
                        needs_supabase_migration: false,
                        needs_dexie_version_bump: false,
                        new_rpc_functions: []
                    },
                    security_audit: {
                        rls_affected: false,
                        exposes_financial_data: false,
                        requires_auth_change: false,
                        forbidden_patterns_check: {
                            uses_raw_sql: false,
                            uses_service_role_key: false,
                            bypasses_rls: false,
                            modifies_auth_tables: false
                        }
                    },
                    files: { modified: [], created: [] },
                    ui_changes: {
                        modifies_layout: false,
                        modifies_styles: true,
                        user_approval_required: true
                    }
                };

                toggleInspector(); // Turn off inspector
                wearHat(manifesto); // Enter sandbox
            } else {
                alert('Only Hello World spell is currently supported in Inspector Demo.');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setSelectedElement(null);
            setRequestInput('');
        }
    };

    if (!inspectorActive) return null;

    return (
        <div id="abra-inspector-ui" className="fixed inset-0 z-[9999] pointer-events-none">
            {/* Overlay Border */}
            <div className="absolute inset-0 border-[6px] border-purple-500 box-border pointer-events-none animate-pulse opacity-50"></div>

            {/* Hover Highlight */}
            {hoveredElement && !selectedElement && (
                <div
                    className="absolute border-2 border-indigo-400 bg-indigo-500/10 transition-all duration-75 ease-out pointer-events-none"
                    style={{
                        top: hoveredElement.rect.top + window.scrollY,
                        left: hoveredElement.rect.left + window.scrollX,
                        width: hoveredElement.rect.width,
                        height: hoveredElement.rect.height,
                    }}
                >
                    <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[10px] px-1 rounded font-mono">
                        {hoveredElement.tagName.toLowerCase()}
                        <span className="opacity-50 mx-1">|</span>
                        {Math.round(hoveredElement.rect.width)}x{Math.round(hoveredElement.rect.height)}
                    </div>
                </div>
            )}

            {/* Selected Element Dialog */}
            <AnimatePresence>
                {selectedElement && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute pointer-events-auto bg-white rounded-2xl shadow-2xl w-96 overflow-hidden border border-purple-100"
                        style={{
                            top: Math.min(window.innerHeight - 300, Math.max(20, selectedElement.rect.bottom + 20)),
                            left: Math.min(window.innerWidth - 400, Math.max(20, selectedElement.rect.left)),
                        }}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-300" />
                                <span className="font-bold text-sm">Magic Request</span>
                            </div>
                            <button onClick={() => setSelectedElement(null)} className="hover:bg-white/20 p-1 rounded-full">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                            <div className="bg-slate-50 p-2 rounded text-xs text-slate-500 font-mono break-all">
                                {selectedElement.path}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">What changes do you desire?</label>
                                <textarea
                                    value={requestInput}
                                    onChange={e => setRequestInput(e.target.value)}
                                    className="w-full text-right p-3 border border-slate-200 rounded-xl text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none h-24"
                                    placeholder="דוגמה: תעשה את הכפתור הזה ירוק..."
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setSelectedElement(null)}
                                    className="px-3 py-2 text-slate-500 text-sm hover:bg-slate-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCastSpell}
                                    disabled={loading || !requestInput.trim()}
                                    className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                                >
                                    {loading ? 'Casting...' : (
                                        <>
                                            <Sparkles className="w-3 h-3" />
                                            Cast Spell
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Exit Inspector Button */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
                <button
                    onClick={toggleInspector}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full shadow-xl font-bold flex items-center gap-2 transition-transform hover:scale-105"
                >
                    <X className="w-5 h-5" />
                    Exit Edit Mode
                </button>
            </div>
        </div>
    );
};

export default AbraInspector;
