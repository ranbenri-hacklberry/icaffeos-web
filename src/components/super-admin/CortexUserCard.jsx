import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Brain,
    Lock,
    Eye,
    EyeOff,
    Activity,
    User,
    Terminal
} from 'lucide-react';

/**
 * 🤖 CortexUserCard
 * Adapted from BusinessNodeCard for individual Cortex AI users.
 * Features AI metrics: LLM Connection, Persona Sync, and Context Size.
 */
const CortexUserCard = ({ user, businessDna, onClick }) => {
    const [showApiKey, setShowApiKey] = useState(false);

    // AI Metrics (Simulated or fetched from user metadata/settings)
    const metrics = {
        llmConnected: user.llm_status === 'online',
        personaSynced: user.persona_sync === 'synced',
        contextSize: user.context_size || '128k',
        dnaType: businessDna || 'General'
    };

    // Masking logic for API keys
    const maskedKey = "sk-••••••••••••••••" + (user.api_key_tail || "abcd");

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-slate-900/40 hover:bg-slate-900/60 border border-white/5 hover:border-indigo-500/30 rounded-2xl overflow-hidden transition-all flex h-52 cursor-pointer shadow-lg"
            onClick={() => onClick(user)}
        >
            {/* LEFT: AI Persona Avatar (1/3) */}
            <div className="w-1/3 relative bg-indigo-950/20 border-r border-white/5 flex items-center justify-center overflow-hidden">
                <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                    <User size={40} className="text-white" />
                </div>

                {/* Decorative Elements */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500 to-transparent blur-2xl"></div>
                </div>

                <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-[9px] font-black text-white/40 uppercase tracking-widest border border-white/5 z-20">
                    <div className={`w-1.5 h-1.5 rounded-full ${metrics.llmConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                    {metrics.llmConnected ? 'Active' : 'Offline'}
                </div>
            </div>

            {/* RIGHT: User Info & AI Metrics (2/3) */}
            <div className="w-2/3 p-5 flex flex-col justify-between" dir="rtl">
                <div>
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="text-lg font-black text-slate-100 group-hover:text-indigo-400 transition-colors">
                                {user.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black py-0.5 px-2 bg-slate-800 text-slate-400 rounded-full border border-slate-700">
                                    {metrics.dnaType}
                                </span>
                                <span className="text-[10px] font-black text-slate-500 italic">
                                    {user.email}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5 text-[10px] bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20 text-indigo-400 font-bold">
                                <Brain size={10} />
                                <span>{metrics.contextSize} Context</span>
                            </div>
                            <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border font-bold transition-all ${metrics.personaSynced ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                <Activity size={10} className={metrics.personaSynced ? '' : 'animate-spin'} />
                                <span>{metrics.personaSynced ? 'Persona Synced' : 'Syncing...'}</span>
                            </div>
                        </div>
                    </div>

                    {/* API Key Status / Masking */}
                    <div className="mt-4 p-2 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between group/key">
                        <div className="flex items-center gap-2">
                            <Lock size={12} className="text-slate-500" />
                            <span className="text-[10px] font-mono text-slate-400 tracking-wider">
                                {showApiKey ? (user.decrypted_api_key || maskedKey) : maskedKey}
                            </span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowApiKey(!showApiKey); }}
                            className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-500 hover:text-white"
                        >
                            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                </div>

                {/* Footer: Tech Stack Indicators */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
                    <div className="flex items-center gap-3">
                        <TechIndicator label="LLM" status={metrics.llmConnected} />
                        <TechIndicator label="Sync" status={metrics.personaSynced} />
                        <TechIndicator label="Auth" status={true} />
                    </div>

                    <div className="flex items-center gap-1.5 text-indigo-400 text-[11px] font-black">
                        <span>Config</span>
                        <Terminal size={12} />
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const TechIndicator = ({ label, status }) => (
    <div className="flex items-center gap-1">
        <div className={`w-1 h-1 rounded-full ${status ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-[9px] font-black text-slate-500 uppercase">{label}</span>
    </div>
);

export default CortexUserCard;
