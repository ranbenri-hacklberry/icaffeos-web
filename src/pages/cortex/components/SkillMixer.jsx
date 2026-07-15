/**
 * SkillMixer.jsx — Cortex "Brain Assembly" UI
 *
 * Drag / click skills from the library (left) into the holographic
 * AI brain (right) to compose a custom agent.
 *
 * Data contract:
 *   READ  → supabase.from('ai_skills_library').select('*')
 *   WRITE → supabase.from('business_ai_settings')
 *               .upsert({ business_id, configuration: { global_skills: [...] } })
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { supabase } from "../../../lib/supabase";

// ── Lucide-style inline icons (no extra dep) ──────────────────────────────

const ICONS = {
  Terminal:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  Database:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
  Utensils:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
  Layout:      (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  TrendingUp:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  Shield:      (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Activity:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Plus:        (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Minus:       (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Check:       (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="20 6 9 17 4 12"/></svg>,
  Zap:         (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Lock:        (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Unlock:      (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>,
  Brain:       (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96-.46 2.5 2.5 0 01-1.07-4.58A3 3 0 014.5 9.5 3 3 0 018 6.5a3 3 0 011.5-4.5zM14.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 004.96-.46 2.5 2.5 0 001.07-4.58A3 3 0 0019.5 9.5 3 3 0 0016 6.5a3 3 0 00-1.5-4.5z"/></svg>,
};

function Icon({ name, ...props }) {
  const Comp = ICONS[name] ?? ICONS.Activity;
  return <Comp {...props} />;
}

// ── Category colours ──────────────────────────────────────────────────────

const CAT_STYLE = {
  technical:   { bg: "bg-indigo-500/15",  border: "border-indigo-500/30",  text: "text-indigo-300",  dot: "bg-indigo-400"  },
  operational: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-300", dot: "bg-emerald-400" },
  general:     { bg: "bg-slate-500/15",   border: "border-slate-500/30",   text: "text-slate-300",   dot: "bg-slate-400"   },
};

function catStyle(cat) {
  return CAT_STYLE[cat] ?? CAT_STYLE.general;
}

// ── Orbital positions for up to 6 skills ─────────────────────────────────

const ORBIT_POSITIONS = [
  { angle:   0, radius: 80 },
  { angle:  60, radius: 80 },
  { angle: 120, radius: 80 },
  { angle: 180, radius: 80 },
  { angle: 240, radius: 80 },
  { angle: 300, radius: 80 },
];

function polarToXY(angle, radius) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius,
  };
}

// ── Holographic Brain Orb ─────────────────────────────────────────────────

function BrainOrb({ activeSkills, onRemove }) {
  return (
    <div className="relative w-[220px] h-[220px] mx-auto select-none">
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full border border-indigo-500/20"
        animate={{ scale: [1, 1.03, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Mid glow ring */}
      <motion.div
        className="absolute inset-4 rounded-full border border-indigo-400/15"
        animate={{ scale: [1, 1.05, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {/* Core orb */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-[90px] h-[90px] rounded-full bg-gradient-to-br from-indigo-600/40 via-purple-700/30 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center shadow-2xl shadow-indigo-900/50"
          animate={{ boxShadow: activeSkills.length > 0
            ? ["0 0 20px rgba(99,102,241,0.3)", "0 0 40px rgba(99,102,241,0.6)", "0 0 20px rgba(99,102,241,0.3)"]
            : "0 0 10px rgba(99,102,241,0.1)"
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {activeSkills.length === 0 ? (
            <motion.span className="text-slate-600 text-2xl"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🧠
            </motion.span>
          ) : (
            <motion.span
              key={activeSkills.length}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-indigo-300 text-lg font-bold font-mono"
            >
              {activeSkills.length}✦
            </motion.span>
          )}
        </motion.div>
      </div>

      {/* Orbiting skill icons */}
      <AnimatePresence>
        {activeSkills.map((skill, i) => {
          const pos = ORBIT_POSITIONS[i % ORBIT_POSITIONS.length];
          const { x, y } = polarToXY(pos.angle, pos.radius);
          const cs = catStyle(skill.category);
          return (
            <motion.button
              key={skill.slug}
              initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: 1, scale: 1,
                x: x - 18, y: y - 18,  // offset by half icon size
                rotate: [0, 3, -3, 0],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 0.35, ease: "backOut", rotate: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 } }}
              onClick={() => onRemove(skill.slug)}
              title={`Remove ${skill.title}`}
              style={{ position: "absolute", left: "50%", top: "50%", width: 36, height: 36 }}
              className={`rounded-full flex items-center justify-center border shadow-lg ${cs.bg} ${cs.border} hover:scale-110 group transition-transform`}
            >
              <Icon name={skill.icon_name} className={`w-4 h-4 ${cs.text}`} />
              {/* Remove indicator on hover */}
              <span className="absolute inset-0 rounded-full bg-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Icon name="Minus" className="w-3 h-3 text-red-300" />
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Rotation ring path indicator */}
      {activeSkills.length > 0 && (
        <motion.div
          className="absolute inset-[30px] rounded-full border border-dashed border-indigo-500/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}

// ── Tool Unlock Toast ─────────────────────────────────────────────────────

function UnlockToast({ tool, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-lg"
    >
      <Icon name="Unlock" className="w-3.5 h-3.5 shrink-0" />
      <span>
        <strong>{tool.name}</strong> unlocked — {tool.description}
      </span>
    </motion.div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────

function SummaryBar({ activeSkills }) {
  if (activeSkills.length === 0) return null;

  const cats = activeSkills.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1;
    return acc;
  }, {});

  const total = activeSkills.length;
  const parts = Object.entries(cats).map(([cat, count]) => ({
    cat,
    pct: Math.round((count / total) * 100),
    ...catStyle(cat),
  }));

  const label = parts.map((p) => `${p.pct}% ${p.cat}`).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3"
    >
      <p className="text-[10px] uppercase tracking-widest text-slate-600 mb-2 font-medium">Agent Composition</p>
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-2">
        {parts.map((p) => (
          <motion.div
            key={p.cat}
            initial={{ flex: 0 }}
            animate={{ flex: p.pct }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`${p.dot} rounded-full`}
          />
        ))}
      </div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className="text-[10px] text-slate-600 mt-0.5">
        {activeSkills.length} skill{activeSkills.length !== 1 ? "s" : ""} active · {activeSkills.reduce((a, s) => a + (s.required_tools?.length ?? 0), 0)} tools available
      </p>
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export default function SkillMixer({ businessId, onSaved }) {
  const [allSkills,    setAllSkills]    = useState([]);
  const [activeSlugs,  setActiveSlugs]  = useState(new Set());
  const [toasts,       setToasts]       = useState([]);   // { id, tool }
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [saveState,    setSaveState]    = useState("idle"); // idle | success | error
  const [filterCat,    setFilterCat]    = useState("all");

  const toastId = useRef(0);

  // ── Fetch skills library ──────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: skills, error: skillsErr } = await supabase
        .from("ai_skills_library")
        .select("*")
        .order("category")
        .order("title");

      if (!skillsErr && skills) setAllSkills(skills);

      // Also load currently saved global_skills for this business
      if (businessId) {
        const { data: settings } = await supabase
          .from("business_ai_settings")
          .select("configuration")
          .eq("business_id", businessId)
          .maybeSingle();

        if (settings?.configuration?.global_skills) {
          setActiveSlugs(new Set(settings.configuration.global_skills));
        }
      }

      setLoading(false);
    }
    load();
  }, [businessId]);

  // ── Toggle skill ──────────────────────────────────────────────────────

  const toggleSkill = useCallback((skill) => {
    setActiveSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(skill.slug)) {
        next.delete(skill.slug);
      } else {
        next.add(skill.slug);
        // Toast for each unlocked tool
        (skill.required_tools ?? []).forEach((tool) => {
          const id = ++toastId.current;
          setToasts((t) => [...t, { id, tool }]);
        });
      }
      return next;
    });
  }, []);

  const removeSkill = useCallback((slug) => {
    setActiveSlugs((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!businessId || saving) return;
    setSaving(true);
    setSaveState("idle");

    const global_skills = [...activeSlugs];

    const { error } = await supabase
      .from("business_ai_settings")
      .upsert(
        { business_id: businessId, configuration: { global_skills }, updated_at: new Date().toISOString() },
        { onConflict: "business_id" }
      );

    setSaving(false);
    if (error) {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    } else {
      setSaveState("success");
      setTimeout(() => setSaveState("idle"), 2500);
      onSaved?.(global_skills);
    }
  }, [businessId, activeSlugs, saving, onSaved]);

  // ── Derived data ──────────────────────────────────────────────────────

  const activeSkills = allSkills.filter((s) => activeSlugs.has(s.slug));
  const categories   = ["all", ...new Set(allSkills.map((s) => s.category))];
  const visibleSkills = filterCat === "all" ? allSkills : allSkills.filter((s) => s.category === filterCat);

  // ── Loading skeleton ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <motion.div
          className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-slate-600 text-sm">Loading skills library…</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-900 via-[#0e0c1e] to-slate-900 text-white">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/25 border border-indigo-500/30 grid place-items-center">
            <Icon name="Brain" className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Skill Mixer</h2>
            <p className="text-[11px] text-slate-500">Assemble your AI agent's capabilities</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

        {/* ── LEFT: Skill Library ──────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col border-r border-white/[0.07]">

          {/* Category filter pills */}
          <div className="shrink-0 flex items-center gap-1.5 px-4 py-3 overflow-x-auto border-b border-white/[0.05]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition capitalize
                  ${filterCat === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-white/[0.05] text-slate-500 hover:text-white hover:bg-white/[0.08]"
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Skills grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
            <AnimatePresence mode="popLayout">
              {visibleSkills.map((skill) => {
                const isActive = activeSlugs.has(skill.slug);
                const cs = catStyle(skill.category);
                return (
                  <motion.button
                    key={skill.slug}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => toggleSkill(skill)}
                    className={`relative text-left p-3.5 rounded-2xl border transition-all duration-200 group
                      ${isActive
                        ? `${cs.bg} ${cs.border} ring-1 ring-inset ring-current/20`
                        : "bg-white/[0.03] border-white/[0.08] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                  >
                    {/* Active badge */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${cs.bg} border ${cs.border}`}
                        >
                          <Icon name="Check" className={`w-3 h-3 ${cs.text}`} />
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${isActive ? `${cs.bg} ${cs.border}` : "bg-white/[0.07] border-white/[0.10]"}`}>
                        <Icon name={skill.icon_name} className={`w-4.5 h-4.5 ${isActive ? cs.text : "text-slate-400"}`} />
                      </div>
                      <div className="min-w-0 flex-1 pr-4">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-white" : "text-slate-200"}`}>{skill.title}</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{skill.description}</p>
                      </div>
                    </div>

                    {/* Tool count badge */}
                    {(skill.required_tools?.length ?? 0) > 0 && (
                      <div className="flex items-center gap-1 mt-2.5">
                        <Icon name="Zap" className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-amber-400 font-medium">
                          {skill.required_tools.length} tool{skill.required_tools.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}

                    {/* Category pill */}
                    <span className={`inline-block mt-2 text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-full ${cs.bg} ${cs.text} border ${cs.border}`}>
                      {skill.category}
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {visibleSkills.length === 0 && (
              <div className="col-span-2 py-12 text-center text-slate-600 text-sm">
                No skills in this category yet.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Brain ──────────────────────────────────── */}
        <div className="shrink-0 w-full lg:w-[280px] flex flex-col border-t lg:border-t-0 border-white/[0.07]">

          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
            <p className="text-[11px] uppercase tracking-widest text-slate-600 font-medium">Active Brain</p>

            <BrainOrb activeSkills={activeSkills} onRemove={removeSkill} />

            {activeSkills.length === 0 && (
              <p className="text-center text-slate-600 text-xs max-w-[140px] leading-relaxed">
                Click a skill to load it into the brain.
              </p>
            )}

            {/* Active skill labels */}
            <AnimatePresence>
              {activeSkills.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap gap-1.5 justify-center max-w-[220px]"
                >
                  {activeSkills.map((s) => {
                    const cs = catStyle(s.category);
                    return (
                      <motion.button
                        key={s.slug}
                        layout
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => removeSkill(s.slug)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cs.bg} ${cs.text} ${cs.border} hover:brightness-125 transition`}
                        title={`Remove ${s.title}`}
                      >
                        {s.title}
                        <Icon name="Minus" className="w-2.5 h-2.5" />
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tool unlock toasts */}
            <div className="w-full space-y-2 px-2">
              <AnimatePresence>
                {toasts.map(({ id, tool }) => (
                  <UnlockToast
                    key={id}
                    tool={tool}
                    onDone={() => setToasts((t) => t.filter((x) => x.id !== id))}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Summary + Save */}
          <div className="shrink-0 p-4 border-t border-white/[0.07] space-y-3">
            <SummaryBar activeSkills={activeSkills} />

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={save}
              disabled={saving || activeSkills.length === 0}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition relative overflow-hidden
                ${saveState === "success"
                  ? "bg-emerald-600 text-white"
                  : saveState === "error"
                    ? "bg-red-600/80 text-white"
                    : activeSkills.length === 0
                      ? "bg-white/[0.05] text-slate-600 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40"
                }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                  Saving to DB…
                </span>
              ) : saveState === "success" ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="Check" className="w-4 h-4" /> Saved ✦
                </span>
              ) : saveState === "error" ? (
                "⚠ Save failed — retry?"
              ) : (
                `Save Brain (${activeSkills.length} skill${activeSkills.length !== 1 ? "s" : ""})`
              )}
            </motion.button>

            {/* Hint */}
            <p className="text-center text-[10px] text-slate-700 leading-snug">
              Skills are injected into Gemini's system prompt at runtime via <code className="font-mono">fn_get_dynamic_system_prompt</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
