/**
 * MessageBubble.jsx
 *
 * Renders a single chat message.
 * Assistant messages support:
 *   1. [SYSTEM_ACTION]{...} blocks → rendered as SystemActionCard
 *   2. Inline "golden answer" editing → hover Edit3 icon → textarea → save RPC
 */

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PrivacyShield from "./PrivacyShield";
import SystemActionCard from "./SystemActionCard";
import { parseSystemActions } from "../useSystemAction";
import { useSystemAction } from "../useSystemAction";

// ── Lucide-style inline icons ──────────────────────────────────────────────

function Edit3Icon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function SaveIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function CheckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400"
          animate={{ opacity: [0.25, 0.9, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1, delay: i * 0.16, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

function StreamCursor() {
  return (
    <motion.span className="inline-block w-[2px] h-[14px] rounded-full bg-current ml-0.5 align-middle"
      animate={{ opacity: [1, 0] }}
      transition={{ duration: 0.55, repeat: Infinity, ease: "linear" }}
    />
  );
}

function renderText(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-[0.8em] font-mono">$1</code>')
    .replace(/^(⚠️.*)/gm, '<span class="text-amber-400">$1</span>')
    .replace(/^\d+\.\s+(.+)/gm, '<li class="ml-4 list-decimal text-sm">$1</li>')
    .replace(/^[-•]\s+(.+)/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>')
    .replace(/\n/g, "<br/>");
}

// ── Golden-Answer Editor ───────────────────────────────────────────────────

function GoldenEditor({ content, onSave, onCancel }) {
  const [draft,     setDraft]     = useState(content);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

  const handleSave = useCallback(async () => {
    if (!draft.trim() || draft.trim() === content.trim()) { onCancel(); return; }
    setSaveState("saving");
    try {
      await onSave(draft.trim());
      setSaveState("saved");
      setTimeout(onCancel, 1200);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 2500);
    }
  }, [draft, content, onSave, onCancel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2 w-full"
    >
      {/* Header badge */}
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Golden Answer Mode</span>
      </div>

      {/* Textarea */}
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.max(4, draft.split("\n").length + 1)}
        className="w-full bg-black/40 border border-amber-500/40 rounded-xl px-3 py-2.5 text-sm text-white leading-relaxed resize-none outline-none focus:border-amber-400/70 transition font-mono"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={handleSave}
          disabled={saveState === "saving" || saveState === "saved"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition
            ${saveState === "saved"
              ? "bg-emerald-600 text-white"
              : saveState === "error"
                ? "bg-red-600/80 text-white"
                : "bg-amber-500 hover:bg-amber-400 text-black"
            }`}
        >
          {saveState === "saving" ? (
            <>
              <motion.span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black"
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
              Saving…
            </>
          ) : saveState === "saved" ? (
            <><CheckIcon className="w-3 h-3" /> Saved ✦</>
          ) : saveState === "error" ? (
            "⚠ Failed — retry?"
          ) : (
            <><SaveIcon className="w-3 h-3" /> Save Golden Answer</>
          )}
        </motion.button>

        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.07] transition border border-white/[0.08]"
        >
          <XIcon className="w-3 h-3" /> Cancel
        </button>

        <span className="ml-auto text-[10px] text-slate-600 font-mono">
          fn_save_training_data
        </span>
      </div>
    </motion.div>
  );
}

// ── AssistantContent (with SystemAction support) ───────────────────────────

function AssistantContent({ content, isStreaming }) {
  const { executionMap, execute, cancel } = useSystemAction();

  const hasAction = content.includes("[SYSTEM_ACTION]");
  const segments  = (hasAction && !isStreaming)
    ? parseSystemActions(content)
    : [{ type: "text", content }];

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "action") {
          return (
            <SystemActionCard
              key={seg.id ?? i}
              payload={seg.payload}
              actionId={seg.id}
              execution={executionMap[seg.id]}
              onExecute={execute}
              onCancel={cancel}
            />
          );
        }
        const trimmed = seg.content.trim();
        if (!trimmed) return null;
        return (
          <span key={i} className="whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: renderText(trimmed) }}
          />
        );
      })}
      {isStreaming && <StreamCursor />}
    </>
  );
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * @param {object}   msg
 * @param {function} onSaveGolden(messageId, goldenAnswer) → Promise<void>
 *                   Provided by ChatPanel; handles RPC call + query lookup.
 */
export default function MessageBubble({ msg, onSaveGolden }) {
  const isUser     = msg.role === "user";
  const isStreaming = msg.streamStatus === "streaming";
  const isError    = msg.streamStatus === "error";
  const isComplete = msg.streamStatus === "complete";
  const showTyping = isStreaming && !msg.content;

  const [editing, setEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const hasAction  = !isUser && !isStreaming && msg.content?.includes("[SYSTEM_ACTION]");
  const canEdit    = !isUser && isComplete && !isStreaming && !!onSaveGolden;

  const handleSave = useCallback(async (goldenAnswer) => {
    await onSaveGolden(msg.id, goldenAnswer);
  }, [onSaveGolden, msg.id]);

  // ── Wrapper for messages with system actions (full-width) ────────────
  if (hasAction && !editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex items-end gap-1.5 justify-start"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="w-5 h-5 rounded-full bg-indigo-600/40 border border-indigo-500/30 grid place-items-center shrink-0 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <AssistantContent content={msg.content} isStreaming={isStreaming} />
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-600">
              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {msg.usage && (
              <span className="text-[10px] font-mono text-slate-700 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
                {msg.usage.prompt_tokens} in / {msg.usage.candidates_tokens} out
              </span>
            )}
            {/* Edit button for full-width messages */}
            <AnimatePresence>
              {canEdit && isHovered && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setEditing(true)}
                  className="ml-1 p-1 rounded-md text-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 transition"
                  title="Edit as Golden Answer"
                >
                  <Edit3Icon className="w-3 h-3" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Standard bubble ──────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`flex items-end gap-1.5 ${isUser ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isUser && msg.privacy && <PrivacyShield privacy={msg.privacy} />}

      {!isUser && (
        <div className="w-5 h-5 rounded-full bg-indigo-600/40 border border-indigo-500/30 grid place-items-center shrink-0 mb-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
        </div>
      )}

      <div className={`${editing ? "w-full max-w-[90%]" : "max-w-[80%]"} rounded-2xl px-4 py-2.5 text-sm leading-relaxed relative group
        ${isUser
          ? "bg-indigo-600 text-white rounded-br-sm"
          : isError
            ? "bg-red-500/10 text-red-300 border border-red-500/20 rounded-bl-sm"
            : editing
              ? "bg-[#0d1117] border border-amber-500/30 rounded-bl-sm w-full"
              : "bg-white/[0.07] text-slate-100 border border-white/[0.08] rounded-bl-sm"
        }`}
      >
        {/* ── Edit icon (hover, assistant-only) ── */}
        <AnimatePresence>
          {canEdit && isHovered && !editing && (
            <motion.button
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              onClick={() => setEditing(true)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center hover:bg-amber-500/30 transition shadow-lg"
              title="Edit as Golden Answer"
            >
              <Edit3Icon className="w-3 h-3" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Content ── */}
        {showTyping ? (
          <TypingDots />
        ) : editing ? (
          <GoldenEditor
            content={msg.content}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          isUser ? (
            <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          ) : (
            <AssistantContent content={msg.content} isStreaming={isStreaming} />
          )
        )}

        {/* ── Footer (timestamp + usage) ── */}
        {!editing && (
          <div className={`flex items-center justify-between text-[10px] mt-1.5
            ${isUser ? "text-indigo-200/60" : "text-slate-600"}`}
          >
            <span>{msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            {!isUser && msg.usage && (
              <span className="font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
                tokens: {msg.usage.prompt_tokens} in / {msg.usage.candidates_tokens} out
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
