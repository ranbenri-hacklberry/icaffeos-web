import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Map, Search, Copy, Check, ExternalLink, Database, Code, FileText, Layout } from 'lucide-react';

const SYSTEM_PAGES = [
    {
        title: 'Kiosk Interface',
        importance: 3,
        route: '/',
        file: 'src/pages/menu-ordering-interface/index.jsx',
        description: 'Customer ordering, modifiers logic, loyalty auth (SMS OTP).',
        specs: ['Native-like animations', 'Dynamic Modifiers', 'Loyalty sync'],
        tables: ['menu_items', 'optiongroups', 'loyalty_cards', 'orders'],
        rpcs: ['submit_order_v3', 'handle_loyalty_purchase']
    },
    {
        title: 'Kanban KDS',
        importance: 3,
        route: '/kanban',
        file: 'src/pages/kanban/index.jsx',
        description: 'Kitchen management. Offline-first, Event Mode, Status-based animations.',
        specs: ['Dexie.js Offline-first', 'Two-way sync', 'Audio Ducking', 'SMS Gateway notify'],
        tables: ['orders', 'order_items'],
        rpcs: ['update_order_status_v3']
    },
    {
        title: 'Manager Dashboard',
        importance: 2,
        route: '/data-manager-interface',
        file: 'src/pages/data-manager-interface/index.jsx',
        description: 'Central management. Sales, Menu metadata, Employee permissions.',
        specs: ['Real-time charts', 'Metadata editor', 'Permissions'],
        tables: ['orders', 'menu_items', 'ingredients', 'employees'],
        rpcs: ['get_sales_data', 'get_active_sales_dates']
    },
    {
        title: 'Inventory Manager',
        importance: 2,
        route: '/inventory',
        file: 'src/pages/inventory/index.jsx',
        description: 'Raw materials, stock count, Supplier WhatsApp orders.',
        specs: ['Gemini OCR Invoice', 'Weight-to-unit logic', 'WhatsApp Gateway'],
        tables: ['inventory_items', 'suppliers', 'catalog_items'],
        rpcs: ['create_supplier_order', 'update_inventory_stock']
    },
    {
        title: 'Dexie Admin',
        importance: 2,
        route: '/dexie-admin',
        file: 'src/pages/dexie-admin/index.jsx',
        description: 'Sync diagnostics, local DB (Dexie) vs Cloud (Supabase).',
        specs: ['Conflict resolution', 'Manual sync triggers'],
        tables: ['dexie', 'sync_meta'],
        rpcs: ['get_orders_history', 'get_loyalty_transactions_for_sync']
    },
    {
        title: 'Music Control',
        importance: 1,
        route: '/music',
        file: 'src/pages/music/index.jsx',
        description: 'Atmosphere management via RanTunes – local file library and playlists.',
        specs: ['BPM-synced VU', 'Playlist queuing', 'Device selection'],
        tables: ['music_settings']
    },
    {
        title: 'Maya AI',
        importance: 1,
        route: '/maya',
        file: 'src/pages/maya/index.jsx',
        description: 'LLM-based assistant for sales analysis and forecasting.',
        specs: ['Natural language NLP', 'Sales forecasting', 'Inventory alerts'],
        tables: ['orders', 'inventory_items']
    },
    {
        title: 'Global Assets',
        importance: 2,
        route: 'N/A',
        file: 'src/assets/',
        description: 'Global visuals and UX animations (Dogs).',
        specs: ['Lottie JSON (Pending, Cooking, Ready)', 'Training videos (MP4)']
    },
    {
        title: 'Database Explorer',
        importance: 1,
        route: '/super-admin/db',
        file: 'src/pages/super-admin/DatabaseExplorer.jsx',
        description: 'Direct SQL execution and RLS policy inspection.',
        specs: ['SQL Query engine', 'RLS viewer', 'Schema inspection'],
        tables: ['All'],
        rpcs: ['All']
    }
];

const SystemMap = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState(false);

    const filteredPages = SYSTEM_PAGES.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const generateContextMarkdown = () => {
        let md = "## icaffeOS Tech-Manifest (AI-Optimized)\n\n";
        md += "**Tech Stack**: React/Vite, Supabase (PgSQL), Dexie.js (Offline-First), Framer Motion, Gemini AI (OCR), RanTunes (Local Music), SMS/WA Gateways.\n\n";

        SYSTEM_PAGES.forEach(p => {
            const stars = '★'.repeat(p.importance).padEnd(3, '');
            md += `### ${stars} ${p.title}\n`;
            md += `- **File**: \`${p.file}\` | **Route**: \`${p.route}\`\n`;
            md += `- **Specs**: ${p.specs?.join(', ') || 'N/A'}\n`;
            if (p.tables) md += `- **Data**: ${p.tables.join(', ')}\n`;
            if (p.rpcs) md += `- **RPCs**: ${p.rpcs.join(', ')}\n`;
            md += "\n";
        });

        md += "## Pain Points & Milestones\n";
        md += "- **Pain**: Sync conflict resolution in multi-terminal high-load environments.\n";
        md += "- **Pain**: DB scaling for complex modifier-heavy orders.\n";
        md += "- **Milestone**: Triple-Check expansion with real-time stock reconciliation via Gemini.\n";
        md += "- **Milestone**: Predictive ordering based on Maya AI sales forecasting.\n";
        md += "- **Milestone**: Hands-free KDS voice commands for status updates.\n";

        return md;
    };

    const handleCopy = () => {
        const text = generateContextMarkdown();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="w-full bg-slate-900/50 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-r from-blue-600/10 to-transparent">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-2xl ring-1 ring-blue-500/40">
                        <Map size={24} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">מפת מערכת (System Directory)</h2>
                        <p className="text-slate-400 text-sm">קישוריות בין דפים, קבצים ומקורות מידע</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="חפש דף או רכיב..."
                            className="bg-slate-950/50 border border-white/10 rounded-xl py-3 pr-11 pl-4 text-sm font-bold w-64 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleCopy}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all active:scale-95 ${copied ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-lg' : 'bg-white text-slate-900 hover:bg-slate-100 shadow-xl'
                            }`}
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        <span>{copied ? 'הועתק!' : 'העתק הקשר ל-AI'}</span>
                    </button>
                </div>
            </div>

            {/* Content Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-slate-950/30 text-slate-500 text-xs font-black uppercase tracking-widest border-b border-white/5">
                            <th className="px-8 py-5">דף / מודול</th>
                            <th className="px-8 py-5">נתיב קובץ</th>
                            <th className="px-8 py-5">תיאור</th>
                            <th className="px-8 py-5">דאטה (Tables/RPC)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredPages.map((page, idx) => (
                            <motion.tr
                                key={idx}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="hover:bg-white/[0.02] transition-colors group"
                            >
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                                            <Layout size={20} />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-200">{page.title}</div>
                                            <div className="text-[10px] font-mono text-blue-500/80">{page.route}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-2 text-xs font-mono text-slate-500 group-hover:text-slate-300 transition-colors">
                                        <Code size={12} className="opacity-50" />
                                        {page.file}
                                    </div>
                                </td>
                                <td className="px-8 py-6">
                                    <div className="max-w-md">
                                        <p className="text-sm text-slate-400 leading-relaxed mb-2">
                                            {page.description}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {page.specs?.map((spec, sidx) => (
                                                <span key={sidx} className="text-[10px] text-blue-500/60 font-medium bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">
                                                    • {spec}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-left" dir="ltr">
                                    <div className="flex flex-wrap justify-end gap-2">
                                        {page.tables?.map(t => (
                                            <span key={t} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[10px] font-bold">
                                                {t}
                                            </span>
                                        ))}
                                        {page.rpcs?.map(r => (
                                            <span key={r} className="px-2 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded text-[10px] font-bold">
                                                {r}{r.includes('(') ? '' : '()'}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer / Tip */}
            <div className="p-6 bg-slate-950/50 border-t border-white/5 text-center">
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <FileText size={12} />
                    לחץ על "העתק הקשר" כדי לספק לסוכן ה-AI את כל המידע הטכני הנדרש לעבודה בתוך 5 שניות
                </p>
            </div>
        </div>
    );
};

export default SystemMap;
