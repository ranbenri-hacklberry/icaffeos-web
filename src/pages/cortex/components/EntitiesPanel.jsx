/**
 * EntitiesPanel.jsx — CRM Entity & Broadcast Hub for Cortex Sidebar
 *
 * Displays crm_entities + crm_contacts from Supabase.
 * Allows multi-contact selection per entity and broadcasts a WhatsApp
 * message via fn_create_broadcast_job (communication_jobs pattern).
 *
 * After job creation, polls Supabase every 2s to reflect real-time
 * dispatcher progress (running → completed / failed) and shows the
 * actual delivery channel badge (WhatsApp / LocalSMS / GlobalSMS).
 *
 * Design: dark/cyber glass — matches existing Cortex component aesthetic.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../../../lib/supabase";
import { useCortexStore } from "../cortexStore";

// ── Icons ───────────────────────────────────────────────────────────────

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
      <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
  );
}
function RetryIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current shrink-0">
      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current shrink-0 text-amber-400">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
  );
}

function Spinner({ size = "4", color = "indigo" }) {
  return (
    <motion.span
      className={`inline-block w-${size} h-${size} rounded-full border-2 border-white/20 border-t-${color}-400`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}

function HealthDot({ label, online }) {
  return (
    <div className="flex items-center gap-1">
      <div className={`w-1 h-1 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
      <span className="text-[9px] font-black text-slate-600 uppercase">{label}</span>
    </div>
  );
}

// ── Channel config ───────────────────────────────────────────────────────

const CHANNEL_CONFIG = {
  whatsapp: {
    icon: "📱",
    label: "WhatsApp",
    cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
    pulse: "bg-emerald-400",
  },
  local_sms: {
    icon: "📡",
    label: "SMS Modem",
    cls: "text-amber-300   bg-amber-500/15   border-amber-500/30",
    pulse: "bg-amber-400",
  },
  globalsms: {
    icon: "☁️",
    label: "GlobalSMS",
    cls: "text-cyan-300    bg-cyan-500/15    border-cyan-500/30",
    pulse: "bg-cyan-400",
  },
};

// ── Entity type badge colours ─────────────────────────────────────────────

const ENTITY_TYPE_STYLE = {
  client: "text-indigo-300  bg-indigo-500/20  border-indigo-500/30",
  supplier: "text-amber-300   bg-amber-500/20   border-amber-500/30",
  partner: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
};

// ── ChannelBadge ─────────────────────────────────────────────────────────

function ChannelBadge({ channel }) {
  const cfg = CHANNEL_CONFIG[channel];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── JobTracker ─────────────────────────────────────────────────────────
// Replaces the old JobStatusBadge. Shows full lifecycle:
//   sending → queued (pulsing) → running (with progress) → completed/failed

function JobTracker({ job, onRetry, onDismiss }) {
  if (!job) return null;

  const { localStatus, jobId, dbStatus, sentVia, sentCount, failedCount, totalContacts, errorLog, retrying } = job;

  // Determine display state
  const isTerminal = dbStatus === "completed" || dbStatus === "failed";
  const isFailed = dbStatus === "failed" || localStatus === "error";
  const isSuccess = dbStatus === "completed";
  const isRunning = dbStatus === "running" || localStatus === "queued";
  const isSending = localStatus === "sending";

  if (isSending) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-[11px] text-indigo-300"
      >
        <Spinner size="3" color="indigo" />
        <span>Creating job…</span>
      </motion.div>
    );
  }

  if (isRunning && !isTerminal) {
    const pct = totalContacts > 0
      ? Math.round(((sentCount ?? 0) + (failedCount ?? 0)) / totalContacts * 100)
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10"
      >
        <div className="flex items-center gap-2">
          <Spinner size="3" color="indigo" />
          <span className="text-[11px] text-indigo-300 flex-1">Dispatcher running…</span>
          {pct !== null && (
            <span className="text-[10px] text-indigo-400 font-mono">{pct}%</span>
          )}
        </div>
        {pct !== null && (
          <div className="h-0.5 rounded-full bg-white/[0.08] overflow-hidden">
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        )}
        {jobId && (
          <p className="text-[9px] font-mono text-indigo-500/60 truncate">job/{jobId}</p>
        )}
      </motion.div>
    );
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {sentVia && (
              <>
                <motion.span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${CHANNEL_CONFIG[sentVia]?.pulse ?? "bg-emerald-400"}`}
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <ChannelBadge channel={sentVia} />
              </>
            )}
            <span className="text-[11px] text-emerald-300 font-medium">
              ✓ {sentCount ?? 0}/{totalContacts} sent
            </span>
          </div>
          {failedCount > 0 && (
            <span className="text-[10px] text-amber-400">✗{failedCount} failed</span>
          )}
          <button onClick={onDismiss} className="text-emerald-600 hover:text-emerald-300 transition text-[11px]">✕</button>
        </div>
        {jobId && (
          <p className="text-[9px] font-mono text-emerald-600 truncate">job/{jobId}</p>
        )}
      </motion.div>
    );
  }

  if (isFailed) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10"
      >
        <div className="flex items-start gap-2">
          <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-red-300 font-medium">All channels failed</p>
            {errorLog && (
              <p className="text-[9px] text-red-500 mt-0.5 break-words leading-relaxed">
                {errorLog.slice(0, 120)}{errorLog.length > 120 ? "…" : ""}
              </p>
            )}
          </div>
          <button onClick={onDismiss} className="shrink-0 text-red-600 hover:text-red-300 transition text-[11px]">✕</button>
        </div>

        {/* Retry button */}
        <motion.button
          onClick={onRetry}
          disabled={retrying}
          whileTap={{ scale: 0.93 }}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 disabled:pointer-events-none border border-red-500/30 text-red-300 text-[11px] font-medium transition"
        >
          {retrying ? <Spinner size="3" color="red" /> : <RetryIcon />}
          {retrying ? "Re-queuing…" : "Retry All Channels"}
        </motion.button>

        {jobId && (
          <p className="text-[9px] font-mono text-red-600 truncate">job/{jobId}</p>
        )}
      </motion.div>
    );
  }

  // Fallback: job queued, waiting for dispatcher
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-500/20 bg-white/[0.04] text-[11px] text-slate-400"
    >
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <span>Queued — waiting for dispatcher</span>
      <button onClick={onDismiss} className="ml-auto text-slate-600 hover:text-slate-300 transition">✕</button>
    </motion.div>
  );
}

// ── ContactRow ─────────────────────────────────────────────────────────

function ContactRow({ contact, checked, onToggle }) {
  return (
    <label
      className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer rounded-lg transition-colors group ${checked ? "bg-indigo-500/10" : "hover:bg-white/[0.04]"
        }`}
    >
      <div
        className={`shrink-0 w-4 h-4 rounded-[4px] border flex items-center justify-center transition ${checked
          ? "bg-indigo-500 border-indigo-400"
          : "border-white/20 bg-white/[0.04] group-hover:border-indigo-400/50"
          }`}
        onClick={onToggle}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-white">
            <path d="M1.5 6L4.5 9L10.5 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {contact.is_primary && <StarIcon />}
          <span className="text-[11px] text-slate-200 truncate font-medium">{contact.name}</span>
          {contact.role && (
            <span className="shrink-0 text-[9px] text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-full px-1.5 py-0">
              {contact.role}
            </span>
          )}
        </div>
        {contact.phone && (
          <div className="flex items-center gap-1 mt-0.5 text-slate-500">
            <PhoneIcon />
            <span className="text-[10px] font-mono">{contact.phone}</span>
          </div>
        )}
      </div>
    </label>
  );
}

// ── BroadcastPanel ─────────────────────────────────────────────────────

function BroadcastPanel({
  contacts, selected, onToggle, onToggleAll,
  message, onMessageChange,
  onSend, job, onRetryJob, onDismissJob,
}) {
  const selectedCount = contacts.filter((c) => selected[c.id]).length;
  const allSelected = contacts.length > 0 && selectedCount === contacts.length;
  const isBusy = job?.localStatus === "sending" || job?.dbStatus === "running";
  const isTerminal = job?.dbStatus === "completed" || job?.dbStatus === "failed" || job?.localStatus === "error";
  const canSend = selectedCount > 0 && message.trim().length > 0 && !isBusy && !isTerminal;

  return (
    <div className="space-y-2 pt-1 pb-2">

      {/* Select-all row */}
      {contacts.length > 1 && (
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onToggleAll}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 transition"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>
      )}

      {/* Contact rows */}
      {contacts.map((c) => (
        <ContactRow
          key={c.id}
          contact={c}
          checked={!!selected[c.id]}
          onToggle={() => onToggle(c.id)}
        />
      ))}

      {contacts.length === 0 && (
        <p className="text-[10px] text-slate-600 px-3 py-2">No contacts found for this entity.</p>
      )}

      {/* Message input */}
      {contacts.length > 0 && !isTerminal && (
        <div className="px-3 pt-2">
          <textarea
            rows={3}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            disabled={isBusy}
            placeholder="Type your broadcast message… Use {{name}} for personalisation."
            className="w-full text-xs bg-white/[0.05] border border-white/[0.09] rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-indigo-500/40 focus:bg-white/[0.07] disabled:opacity-40 transition leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-slate-600">
              {selectedCount > 0
                ? `${selectedCount} recipient${selectedCount !== 1 ? "s" : ""} selected`
                : "Select recipients above"}
            </span>
            <motion.button
              onClick={onSend}
              disabled={!canSend}
              whileTap={{ scale: 0.93 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${canSend
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
                : "bg-white/[0.05] text-slate-600 cursor-not-allowed"
                }`}
            >
              {isBusy ? <Spinner size="3" color="white" /> : <SendIcon />}
              {isBusy ? "Dispatching…" : "Broadcast"}
            </motion.button>
          </div>
        </div>
      )}

      {/* Job tracker */}
      <div className="px-3">
        <AnimatePresence>
          {job && (
            <JobTracker
              job={job}
              onRetry={onRetryJob}
              onDismiss={onDismissJob}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── EntityRow ──────────────────────────────────────────────────────────

function EntityRow({
  entity, isExpanded, contacts, contactsLoading, selected,
  onToggleExpand, onToggleContact, onToggleAll,
  message, onMessageChange,
  onSend, job, onRetryJob, onDismissJob,
}) {
  const typeCls = ENTITY_TYPE_STYLE[entity.entity_type] ?? ENTITY_TYPE_STYLE.client;
  const selectedCount = (contacts ?? []).filter((c) => selected[c.id]).length;
  const jobChannel = job?.sentVia;

  return (
    <div className={`rounded-xl border overflow-hidden transition-colors ${isExpanded ? "border-indigo-500/30 bg-indigo-500/[0.04]" : "border-white/[0.08] bg-white/[0.02]"
      }`}>

      {/* Entity header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left group"
      >
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.18 }}
          className="shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors"
        >
          <ChevronIcon />
        </motion.span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[12px] font-semibold text-slate-200 truncate">{entity.name}</span>
            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${typeCls}`}>
              {entity.entity_type}
            </span>
          </div>
          {entity.description && (
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{entity.description}</p>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {contactsLoading && <Spinner size="3" color="slate" />}
          {/* Show channel badge in collapsed state if job completed */}
          {jobChannel && !isExpanded && <ChannelBadge channel={jobChannel} />}
          {selectedCount > 0 && !jobChannel && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-medium">
              {selectedCount}✓
            </span>
          )}
          {(entity.tags ?? []).slice(0, 2).map((tag) => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-500 border border-white/[0.06]">
              {tag}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded contacts + broadcast */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            {contactsLoading ? (
              <div className="flex items-center gap-2 px-4 py-3">
                <Spinner size="4" color="indigo" />
                <span className="text-[11px] text-slate-500 italic">Loading contacts…</span>
              </div>
            ) : (
              <BroadcastPanel
                contacts={contacts ?? []}
                selected={selected}
                onToggle={onToggleContact}
                onToggleAll={onToggleAll}
                message={message}
                onMessageChange={onMessageChange}
                onSend={onSend}
                job={job}
                onRetryJob={onRetryJob}
                onDismissJob={onDismissJob}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── EntitiesPanel (main export) ─────────────────────────────────────────

const JOB_POLL_INTERVAL_MS = 2000;
const JOB_TERMINAL_STATES = new Set(["completed", "failed"]);

export default function EntitiesPanel() {
  const tenantId = useCortexStore((s) => s.tenant?.id);

  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [contacts, setContacts] = useState({});   // entityId → Contact[]
  const [contactsLoading, setContactsLoading] = useState({});   // entityId → bool

  const [selected, setSelected] = useState({});                 // contactId → bool
  const [messages, setMessages] = useState({});                 // entityId → string

  // ── System Health ──
  const [systemHealth, setSystemHealth] = useState({ status: 'checking', services: {} });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const baseUrl = window.location.port === '8081' ? '' : `http://${window.location.hostname}:8081`;
        const res = await fetch(`${baseUrl}/api/system/health`);
        if (res.ok) {
          const data = await res.json();
          setSystemHealth(data);
        } else {
          setSystemHealth({ status: 'degraded', services: {} });
        }
      } catch (err) {
        setSystemHealth({ status: 'offline', services: {} });
      }
    };
    checkHealth();
    const inv = setInterval(checkHealth, 10000); // 10s for snappier UI
    return () => clearInterval(inv);
  }, []);

  /**
   * jobs: entityId → {
   *   localStatus: 'sending' | 'queued' | 'error',
   *   jobId:       UUID | null,
   *   dbStatus:    string | null,       — 'pending'|'running'|'completed'|'failed'
   *   sentVia:     string | null,
   *   sentCount:   number,
   *   failedCount: number,
   *   totalContacts: number,
   *   errorLog:    string | null,
   *   retrying:    bool,
   * }
   */
  const [jobs, setJobs] = useState({});
  const pollTimers = useRef({});  // entityId → intervalId

  // ── Job polling ─────────────────────────────────────────────────────
  const startPolling = useCallback((entityId, jobId) => {
    // Clear any existing timer for this entity
    if (pollTimers.current[entityId]) clearInterval(pollTimers.current[entityId]);

    pollTimers.current[entityId] = setInterval(async () => {
      try {
        const { data, error: pollErr } = await supabase
          .from("communication_jobs")
          .select("status, sent_via, sent_count, failed_count, total_contacts, error_log")
          .eq("id", jobId)
          .single();

        if (pollErr || !data) return;

        setJobs((prev) => ({
          ...prev,
          [entityId]: {
            ...prev[entityId],
            dbStatus: data.status,
            sentVia: data.sent_via,
            sentCount: data.sent_count ?? 0,
            failedCount: data.failed_count ?? 0,
            totalContacts: data.total_contacts ?? 0,
            errorLog: data.error_log,
          },
        }));

        // Stop polling once terminal
        if (JOB_TERMINAL_STATES.has(data.status)) {
          clearInterval(pollTimers.current[entityId]);
          delete pollTimers.current[entityId];
        }
      } catch (_) { }
    }, JOB_POLL_INTERVAL_MS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearInterval);
    };
  }, []);

  // ── Fetch entities ───────────────────────────────────────────────────
  const fetchEntities = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    supabase
      .from("crm_entities")
      .select("id, name, entity_type, description, tags, is_active")
      .eq("business_id", tenantId)
      .eq("is_active", true)
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setEntities(data ?? []);
        setLoading(false);
      });
  }, [tenantId]);

  useEffect(() => { fetchEntities(); }, [fetchEntities]);

  // ── Fetch contacts for entity ────────────────────────────────────────
  const loadContacts = useCallback(async (entityId) => {
    if (contacts[entityId] !== undefined) return;
    setContactsLoading((prev) => ({ ...prev, [entityId]: true }));
    const { data } = await supabase
      .from("crm_contacts")
      .select("id, name, phone, email, role, is_primary")
      .eq("entity_id", entityId)
      .order("is_primary", { ascending: false });
    setContacts((prev) => ({ ...prev, [entityId]: data ?? [] }));
    setContactsLoading((prev) => ({ ...prev, [entityId]: false }));
  }, [contacts]);

  // ── Expand/collapse ──────────────────────────────────────────────────
  const handleToggleExpand = (entityId) => {
    setExpandedId((prev) => {
      if (prev === entityId) return null;
      loadContacts(entityId);
      return entityId;
    });
  };

  const handleToggleContact = (contactId) =>
    setSelected((prev) => ({ ...prev, [contactId]: !prev[contactId] }));

  const handleToggleAll = (entityId) => {
    const entityContacts = contacts[entityId] ?? [];
    const allChecked = entityContacts.every((c) => selected[c.id]);
    setSelected((prev) => {
      const next = { ...prev };
      entityContacts.forEach((c) => {
        if (allChecked) delete next[c.id];
        else next[c.id] = true;
      });
      return next;
    });
  };

  // ── Broadcast ────────────────────────────────────────────────────────
  const handleSend = async (entityId) => {
    if (!tenantId) return;
    const entityContacts = contacts[entityId] ?? [];
    const contactIds = entityContacts.filter((c) => selected[c.id]).map((c) => c.id);
    const msg = (messages[entityId] ?? "").trim();
    if (contactIds.length === 0 || !msg) return;

    setJobs((prev) => ({
      ...prev,
      [entityId]: {
        localStatus: "sending", jobId: null, dbStatus: null,
        sentVia: null, sentCount: 0, failedCount: 0,
        totalContacts: contactIds.length, errorLog: null, retrying: false,
      },
    }));

    try {
      const { data, error: rpcErr } = await supabase.rpc("fn_create_broadcast_job", {
        p_business_id: tenantId,
        p_entity_id: entityId,
        p_contact_ids: contactIds,
        p_message: msg,
        p_job_type: "whatsapp_text",
        p_document_url: null,
      });

      if (rpcErr) throw rpcErr;

      const jobId = data;

      setJobs((prev) => ({
        ...prev,
        [entityId]: {
          ...prev[entityId],
          localStatus: "queued",
          jobId,
          dbStatus: "pending",
        },
      }));

      // Clear selections + message
      setSelected((prev) => {
        const next = { ...prev };
        entityContacts.forEach((c) => { delete next[c.id]; });
        return next;
      });
      setMessages((prev) => ({ ...prev, [entityId]: "" }));

      // Start polling for dispatcher progress
      startPolling(entityId, jobId);

    } catch (err) {
      setJobs((prev) => ({
        ...prev,
        [entityId]: {
          ...prev[entityId],
          localStatus: "error",
          errorLog: err.message ?? "Failed to create broadcast job",
        },
      }));
    }
  };

  // ── Retry ────────────────────────────────────────────────────────────
  const handleRetryJob = async (entityId) => {
    const job = jobs[entityId];
    if (!job?.jobId) return;

    setJobs((prev) => ({
      ...prev,
      [entityId]: { ...prev[entityId], retrying: true },
    }));

    try {
      const { error: retryErr } = await supabase.rpc("fn_retry_job", {
        p_job_id: job.jobId,
      });
      if (retryErr) throw retryErr;

      setJobs((prev) => ({
        ...prev,
        [entityId]: {
          ...prev[entityId],
          dbStatus: "pending",
          localStatus: "queued",
          sentVia: null,
          errorLog: null,
          retrying: false,
        },
      }));

      startPolling(entityId, job.jobId);
    } catch (err) {
      setJobs((prev) => ({
        ...prev,
        [entityId]: { ...prev[entityId], retrying: false, errorLog: `Retry failed: ${err.message}` },
      }));
    }
  };

  const handleDismissJob = (entityId) => {
    if (pollTimers.current[entityId]) {
      clearInterval(pollTimers.current[entityId]);
      delete pollTimers.current[entityId];
    }
    setJobs((prev) => { const n = { ...prev }; delete n[entityId]; return n; });
  };

  // ── Render ───────────────────────────────────────────────────────────

  if (!tenantId) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-600 p-6">
        <UsersIcon />
        <p className="text-xs text-center">Configure Cortex first to enable entities.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3">

      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-slate-400"><UsersIcon /></span>
        <h2 className="text-sm font-semibold text-white">Entities</h2>
        <div className="ml-auto flex items-center gap-2">
          {loading
            ? <Spinner size="4" color="indigo" />
            : <span className="text-[10px] text-slate-600 font-mono">
              {entities.length} entity{entities.length !== 1 ? "s" : ""}
            </span>
          }
          {!loading && (
            <button
              onClick={fetchEntities}
              aria-label="Refresh entities"
              className="p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
      </div>

      {/* System Health Pulse */}
      <div className="flex items-center gap-4 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05]">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${systemHealth.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : systemHealth.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'}`} />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">System Pulse</span>
        </div>
        <div className="flex gap-3 ml-auto">
          <HealthDot label="GW" online={systemHealth.services?.cortex_gateway === 'online'} />
          <HealthDot label="GE" online={systemHealth.services?.gemini === 'online'} />
          <HealthDot label="AI" online={systemHealth.services?.ollama === 'online'} />
          <HealthDot label="DB" online={systemHealth.services?.database === 'online'} />
        </div>
      </div>

      {/* Channel legend */}
      <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
        {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${cfg.cls} opacity-60`}>
            {cfg.icon} {cfg.label}
          </span>
        ))}
        <span className="text-[9px] text-slate-700 ml-auto">dispatch order →</span>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="shrink-0 overflow-hidden"
          >
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              ⚠️ {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2 shrink-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-11 rounded-xl border border-white/[0.07] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entities.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.07] grid place-items-center text-xl">🏢</div>
          <div className="text-center">
            <p className="text-xs font-medium text-slate-500">No entities yet</p>
            <p className="text-[10px] mt-1 max-w-[180px]">Run the CRM migration and add clients to get started.</p>
          </div>
        </div>
      )}

      {/* Entity list */}
      {!loading && entities.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
          <AnimatePresence initial={false}>
            {entities.map((entity) => (
              <motion.div
                key={entity.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <EntityRow
                  entity={entity}
                  isExpanded={expandedId === entity.id}
                  contacts={contacts[entity.id]}
                  contactsLoading={!!contactsLoading[entity.id]}
                  selected={selected}
                  onToggleExpand={() => handleToggleExpand(entity.id)}
                  onToggleContact={handleToggleContact}
                  onToggleAll={() => handleToggleAll(entity.id)}
                  message={messages[entity.id] ?? ""}
                  onMessageChange={(val) => setMessages((prev) => ({ ...prev, [entity.id]: val }))}
                  onSend={() => handleSend(entity.id)}
                  job={jobs[entity.id] ?? null}
                  onRetryJob={() => handleRetryJob(entity.id)}
                  onDismissJob={() => handleDismissJob(entity.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer */}
      <p className="shrink-0 text-center text-[10px] text-slate-700">
        Dispatched via WAHA → SMS Modem → GlobalSMS
      </p>
    </div>
  );
}
