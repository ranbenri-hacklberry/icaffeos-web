/**
 * SystemActionCard.jsx
 *
 * Renders a single [SYSTEM_ACTION] block emitted by Gemini.
 * States: idle → running → success | failed
 * Live logs stream via SSE from /api/lab/execute.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ── Icons ──────────────────────────────────────────────────────────────────

function TerminalIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" aria-hidden>
      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
    </svg>
  );
}

function DockerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden>
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.186.186 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg viewBox="0 0 20 20" className={`w-3.5 h-3.5 fill-current transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden>
      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

// ── Risk config ────────────────────────────────────────────────────────────

const RISK = {
  low: { label: "Low Risk", bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-500/30" },
  medium: { label: "Medium Risk", bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30" },
  high: { label: "High Risk", bg: "bg-red-500/15", text: "text-red-300", border: "border-red-500/30" },
};

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  idle: { dot: "bg-slate-500", label: "Pending", labelColor: "text-slate-400" },
  running: { dot: "bg-amber-400 animate-pulse", label: "Running…", labelColor: "text-amber-300" },
  success: { dot: "bg-emerald-400", label: "Success", labelColor: "text-emerald-300" },
  failed: { dot: "bg-red-400", label: "Failed", labelColor: "text-red-300" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function isDockerCommand(cmd) {
  return /^docker\b/.test(cmd.trim());
}

// ── Component ──────────────────────────────────────────────────────────────

export default function SystemActionCard({ payload, actionId, execution, onExecute, onCancel }) {
  const [logsOpen, setLogsOpen] = useState(false);

  const { command, description, risk_level } = payload;
  const risk = RISK[risk_level] ?? RISK.medium;
  const status = execution?.status ?? "idle";
  const logs = execution?.logs ?? [];
  const exitCode = execution?.exitCode ?? null;
  const sc = STATUS_CONFIG[status];
  const isRunning = status === "running";
  const isDone = status === "success" || status === "failed";

  const CommandIcon = isDockerCommand(command) ? DockerIcon : TerminalIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="my-3 rounded-2xl border border-white/[0.10] bg-[#0d1117] overflow-hidden shadow-xl shadow-black/40"
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-white/[0.03]">
        <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 grid place-items-center text-indigo-300 shrink-0">
          <CommandIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Status dot */}
            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            <span className={`text-[11px] font-medium ${sc.labelColor}`}>{sc.label}</span>
            {exitCode !== null && (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded border ${exitCode === 0 ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}`}>
                exit {exitCode}
              </span>
            )}
          </div>
        </div>
        {/* Risk badge */}
        <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${risk.bg} ${risk.text} ${risk.border}`}>
          {risk.label}
        </span>
      </div>

      {/* ── Command preview ────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">Command</span>
        </div>
        <pre className="text-sm font-mono text-cyan-300 bg-black/40 rounded-xl px-4 py-3 border border-white/[0.06] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
          <span className="text-slate-600 select-none">$ </span>{command}
        </pre>
      </div>

      {/* ── Action buttons ─────────────────────────────────── */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {!isDone && (
          <>
            <motion.button
              whileTap={{ scale: 0.93 }}
              disabled={isRunning}
              onClick={() => {
                onExecute(actionId, command);
                setLogsOpen(true);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${isRunning
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20"
                }`}
            >
              {isRunning ? (
                <>
                  <motion.span
                    className="w-3.5 h-3.5 rounded-full border-2 border-amber-300 border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  Running on Edge Hub…
                </>
              ) : (
                <>
                  <TerminalIcon />
                  Execute on Edge Hub
                </>
              )}
            </motion.button>

            <button
              onClick={() => onCancel(actionId)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.07] transition border border-white/[0.08]"
            >
              Cancel
            </button>
          </>
        )}

        {isDone && (
          <button
            onClick={() => onExecute(actionId, command)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.07] transition border border-white/[0.08]"
          >
            <TerminalIcon />
            Re-run
          </button>
        )}

        {/* Logs toggle (only when there are logs) */}
        {logs.length > 0 && (
          <button
            onClick={() => setLogsOpen((o) => !o)}
            className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
          >
            Live Logs ({logs.length})
            <ChevronIcon open={logsOpen} />
          </button>
        )}
      </div>

      {/* ── Live Logs ──────────────────────────────────────── */}
      <AnimatePresence>
        {logsOpen && logs.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            <div className="bg-black/60 px-4 py-3 max-h-64 overflow-y-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">Live Output</span>
                {isRunning && (
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </div>
              <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed space-y-0.5">
                {logs.map((line, i) => {
                  const isErr = /^(error|err|fatal|warn)/i.test(line.trim());
                  return (
                    <span
                      key={i}
                      className={`block ${isErr ? "text-red-400" : "text-slate-300"}`}
                    >
                      {line}
                    </span>
                  );
                })}
                {isRunning && (
                  <motion.span
                    className="inline-block w-[6px] h-[13px] rounded-sm bg-cyan-400 ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.55, repeat: Infinity }}
                  />
                )}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
