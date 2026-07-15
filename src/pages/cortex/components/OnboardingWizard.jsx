/**
 * OnboardingWizard — ported from knowledge-hub-pwa (TypeScript → JSX).
 *
 * Shown when no tenant config exists in localStorage.
 * On completion → POST /api/onboarding → writes tenant to Zustand + localStorage.
 *
 * Step 0 — Business Type   (IT Lab / Law Firm / Cafe)
 * Step 1 — Core Entities   (tag input + quick-add chips)
 * Step 2 — Business Name + Tone of Voice
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cortexFetchPublic } from "../cortexApi";
import { useCortexStore } from "../cortexStore";

// ── Config ─────────────────────────────────────────────────────────────

const BUSINESS_OPTIONS = [
  { type: "IT_LAB",   label: "IT Lab",   icon: "🖥️", desc: "Devices, diagnostics, networks"  },
  { type: "LAW_FIRM", label: "Law Firm", icon: "⚖️", desc: "Cases, clients, legal research"  },
  { type: "CAFE",     label: "Cafe",     icon: "☕", desc: "Menu, orders, inventory"          },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional", desc: "Formal and structured"    },
  { value: "friendly",     label: "Friendly",     desc: "Warm and conversational"  },
  { value: "technical",    label: "Technical",    desc: "Precise and detail-heavy" },
  { value: "casual",       label: "Casual",       desc: "Relaxed, no jargon"       },
];

const ENTITY_SUGGESTIONS = {
  IT_LAB:   ["Devices", "Tickets", "Users", "Networks"],
  LAW_FIRM: ["Cases", "Clients", "Hearings", "Documents"],
  CAFE:     ["Products", "Orders", "Suppliers", "Recipes"],
};

// ── Step dots ──────────────────────────────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          layout
          transition={{ duration: 0.25 }}
          className={[
            "rounded-full",
            i === current ? "w-6 h-2 bg-indigo-500" :
            i <  current  ? "w-2 h-2 bg-indigo-700" :
                            "w-2 h-2 bg-white/10",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────

export default function OnboardingWizard() {
  const { setTenant } = useCortexStore();

  const [step,         setStep]         = useState(0);
  const [businessType, setBusinessType] = useState(null);
  const [businessName, setBusinessName] = useState("");
  const [entities,     setEntities]     = useState([]);
  const [entityInput,  setEntityInput]  = useState("");
  const [tone,         setTone]         = useState("professional");

  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState(null);

  // ── Entity helpers ──────────────────────────────────────────────────
  const addEntity = (val) => {
    const t = val.trim();
    if (t && !entities.includes(t)) setEntities((p) => [...p, t]);
    setEntityInput("");
  };

  const canAdvance = [
    !!businessType,
    entities.length > 0,
    businessName.trim().length > 0,
  ][step];

  // ── Submit ──────────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!businessType || !businessName.trim() || submitting) return;

    setSubmitting(true);
    setApiError(null);

    try {
      const res = await cortexFetchPublic("/api/onboarding", {
        method: "POST",
        body: JSON.stringify({
          business_name:       businessName.trim(),
          business_type:       businessType,
          core_entities:       entities,
          tone_of_voice:       tone,
          custom_instructions: "",
        }),
      });

      if (!res.success || !res.tenant_id) {
        throw new Error(res.message ?? "Onboarding failed");
      }

      setTenant({
        id:           res.tenant_id,
        businessName: businessName.trim(),
        businessType,
        tone,
      });

      // On success, setTenant triggers CortexPage re-render → wizard unmounts.
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to save configuration");
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 grid place-items-center text-white font-bold text-sm mx-auto mb-4 shadow-lg shadow-indigo-900/50">
            C
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set up Cortex</h1>
          <p className="text-slate-500 text-sm mt-1">30 seconds to personalise your AI workspace.</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.10] rounded-2xl p-6 shadow-2xl">
          <StepDots current={step} total={3} />

          {/* Step panels with slide transition */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24  }}
              animate={{ opacity: 1, x: 0   }}
              exit={{    opacity: 0, x: -24 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >

              {/* Step 0 — Business type */}
              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-white font-semibold">What kind of business is this?</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {BUSINESS_OPTIONS.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => setBusinessType(opt.type)}
                        className={[
                          "flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition",
                          businessType === opt.type
                            ? "border-indigo-500 bg-indigo-500/20 ring-1 ring-indigo-500"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]",
                        ].join(" ")}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <span className="text-white text-xs font-medium">{opt.label}</span>
                        <span className="text-slate-500 text-[10px] leading-tight">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 1 — Core entities */}
              {step === 1 && businessType && (
                <div className="space-y-4">
                  <h2 className="text-white font-semibold">What does your team manage?</h2>
                  <div
                    className="min-h-[68px] flex flex-wrap gap-2 p-3 rounded-xl border border-white/[0.10] bg-white/[0.04] cursor-text"
                    onClick={() => document.getElementById("entity-input")?.focus()}
                  >
                    {entities.map((e) => (
                      <span
                        key={e}
                        className="inline-flex items-center gap-1 bg-indigo-500/25 text-indigo-200 border border-indigo-500/30 rounded-full px-2.5 py-0.5 text-xs"
                      >
                        {e}
                        <button
                          onClick={() => setEntities((p) => p.filter((x) => x !== e))}
                          className="text-indigo-300 hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      id="entity-input"
                      value={entityInput}
                      onChange={(e) => setEntityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === ",") && entityInput.trim()) {
                          e.preventDefault();
                          addEntity(entityInput);
                        }
                      }}
                      placeholder={entities.length === 0 ? "Type and press Enter…" : ""}
                      className="flex-1 min-w-[100px] bg-transparent text-white text-xs outline-none placeholder-slate-600"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(ENTITY_SUGGESTIONS[businessType] ?? [])
                      .filter((s) => !entities.includes(s))
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => setEntities((p) => [...p, s])}
                          className="px-2.5 py-1 rounded-full border border-white/10 text-slate-400 text-xs hover:border-indigo-400/50 hover:text-indigo-300 transition"
                        >
                          + {s}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Step 2 — Name + Tone */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-white font-semibold mb-3">Final details</h2>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && canAdvance) handleComplete(); }}
                      placeholder="Business name (e.g. TechPoint Lab)"
                      autoFocus
                      className="w-full bg-white/[0.06] border border-white/[0.10] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/60 transition"
                    />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium mb-3">Tone of voice</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TONE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setTone(opt.value)}
                          className={[
                            "p-3 rounded-xl border text-left transition",
                            tone === opt.value
                              ? "border-indigo-500 bg-indigo-500/20"
                              : "border-white/[0.08] bg-white/[0.03] hover:border-white/20",
                          ].join(" ")}
                        >
                          <p className="text-white text-xs font-medium">{opt.label}</p>
                          <p className="text-slate-500 text-[10px] mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* API error banner */}
          <AnimatePresence>
            {apiError && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{    height: 0,      opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                  ⚠️ {apiError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-white/[0.07]">
            <button
              onClick={() => { setApiError(null); setStep((s) => s - 1); }}
              className={`text-sm text-slate-500 hover:text-slate-300 transition ${step === 0 ? "invisible" : ""}`}
            >
              ← Back
            </button>

            {step < 2 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-30 disabled:pointer-events-none"
              >
                Continue →
              </button>
            ) : (
              <motion.button
                onClick={handleComplete}
                disabled={!canAdvance || submitting}
                whileTap={{ scale: 0.94 }}
                className="relative px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-40 disabled:pointer-events-none min-w-[140px]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                    Saving…
                  </span>
                ) : (
                  "Launch Cortex 🚀"
                )}
              </motion.button>
            )}
          </div>

        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-slate-700 mt-4">
          Configuration is saved once — edit anytime from the settings panel.
        </p>

      </div>
    </div>
  );
}
