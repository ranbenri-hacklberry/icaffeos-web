/**
 * CortexPage — self-contained Cortex AI entry point.
 *
 * Replaces the old iframe approach. All UI is now embedded directly
 * in the main app; no separate PWA server is required.
 *
 * Onboarding gate (same logic as knowledge-hub-pwa/App.tsx):
 *   tenant === null  →  <OnboardingWizard>  (writes to store on complete)
 *   tenant !== null  →  GlassLayout         (TopBar + ContextPanel + ChatPanel)
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │  Back button │ TopBar                  │
 *   ├────────────────┬───────────────────────┤
 *   │  ContextPanel  │  ChatPanel            │  ← desktop (md+): 2-column
 *   │  360px fixed   │  flex-1               │
 *   └────────────────┴───────────────────────┘
 *   Mobile (<md): ChatPanel full-screen + ContextDrawer slides in from left.
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useCortexStore } from "./cortexStore";
import OnboardingWizard from "./components/OnboardingWizard";
import ContextPanel     from "./components/ContextPanel";
import ChatPanel        from "./components/ChatPanel";

// ── Vertical-badge config ──────────────────────────────────────────────

const VERTICAL_BADGE = {
  IT_LAB:   { label: "IT Lab",   cls: "text-cyan-300    bg-cyan-500/15    border-cyan-500/30"    },
  LAW_FIRM: { label: "Law Firm", cls: "text-amber-300   bg-amber-500/15   border-amber-500/30"   },
  CAFE:     { label: "Cafe",     cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" },
};

// ── GlassCard ─────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={[
        "bg-white/[0.06] backdrop-blur-xl",
        "border border-white/[0.12]",
        "rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
        "overflow-hidden",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────

function TopBar({ businessName, businessType, onBack, onReset }) {
  const badge = VERTICAL_BADGE[businessType] ?? {
    label: businessType,
    cls: "text-slate-300 bg-white/10 border-white/20",
  };

  return (
    <header className="shrink-0 flex items-center gap-3 px-4 md:px-6 h-14 border-b border-white/[0.08] bg-black/20 backdrop-blur-sm">
      {/* Back to main app */}
      <button
        onClick={onBack}
        aria-label="Back"
        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.07] transition"
      >
        <ArrowLeft size={18} />
      </button>

      {/* Wordmark */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 grid place-items-center text-white font-bold text-xs select-none shadow-lg shadow-indigo-900/50">
          C
        </div>
        <span className="font-semibold text-white text-sm tracking-tight hidden sm:block">
          {businessName}
        </span>
      </div>

      {/* Vertical badge */}
      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${badge.cls}`}>
        {badge.label}
      </span>

      <div className="flex-1" />

      {/* Settings — re-run onboarding */}
      <button
        onClick={onReset}
        title="Re-configure Cortex"
        aria-label="Settings"
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/[0.07] transition"
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
          <path
            fillRule="evenodd"
            d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </header>
  );
}

// ── ContextDrawer (mobile-only) ───────────────────────────────────────

function ContextDrawer({ isOpen, onClose, children }) {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={[
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm",
          "transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      {/* Sliding panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Context panel"
        className={[
          "fixed top-0 left-0 z-50 h-full w-[85vw] max-w-sm",
          "bg-slate-900/95 backdrop-blur-2xl",
          "border-r border-white/10 shadow-2xl",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "flex flex-col",
        ].join(" ")}
      >
        {/* Drag handle (decorative) */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-white/10" />

        {/* Header with close button */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 border-b border-white/10">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Context
          </span>
          <button
            onClick={onClose}
            aria-label="Close context panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}

// ── GlassLayout ───────────────────────────────────────────────────────

function GlassLayout({ onBack }) {
  const {
    tenant,
    selectedRecordId,
    setSelectedRecordId,
    isContextDrawerOpen,
    closeContextDrawer,
    toggleContextDrawer,
    resetTenant,
  } = useCortexStore();

  if (!tenant) return null;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col overflow-hidden">

      <TopBar
        businessName={tenant.businessName}
        businessType={tenant.businessType}
        onBack={onBack}
        onReset={resetTenant}
      />

      <div className="flex-1 min-h-0 relative">

        {/* ── Desktop (md+): 2-column grid ─────────────────────────── */}
        <div className="hidden md:grid md:grid-cols-[360px_1fr] md:gap-4 md:p-4 h-full">
          <GlassCard>
            <ContextPanel
              businessType={tenant.businessType}
              selectedRecordId={selectedRecordId}
              onSelectRecord={setSelectedRecordId}
            />
          </GlassCard>

          <GlassCard>
            <ChatPanel
              tenant={tenant}
              selectedRecordId={selectedRecordId}
              showContextToggle={false}
            />
          </GlassCard>
        </div>

        {/* ── Mobile (<md): full-screen chat ────────────────────────── */}
        <div className="md:hidden h-full">
          <ChatPanel
            tenant={tenant}
            selectedRecordId={selectedRecordId}
            showContextToggle
            onContextToggle={toggleContextDrawer}
          />
        </div>

        {/* ── Mobile context drawer ─────────────────────────────────── */}
        <div className="md:hidden">
          <ContextDrawer isOpen={isContextDrawerOpen} onClose={closeContextDrawer}>
            <div className="p-5">
              <ContextPanel
                businessType={tenant.businessType}
                selectedRecordId={selectedRecordId}
                onSelectRecord={(id) => {
                  setSelectedRecordId(id);
                  closeContextDrawer();
                }}
              />
            </div>
          </ContextDrawer>
        </div>

      </div>
    </div>
  );
}

// ── CortexPage (entry point) ──────────────────────────────────────────

export default function CortexPage() {
  const navigate = useNavigate();
  const tenant   = useCortexStore((s) => s.tenant);

  // No tenant → onboarding fills the full viewport; back button is inside
  if (!tenant) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50"
      >
        {/* Slim back strip so user can always escape the wizard */}
        <div className="absolute top-0 left-0 z-10 p-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.07] transition"
          >
            <ArrowLeft size={16} />
          </button>
        </div>
        <OnboardingWizard />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50"
    >
      <GlassLayout onBack={() => navigate(-1)} />
    </motion.div>
  );
}
