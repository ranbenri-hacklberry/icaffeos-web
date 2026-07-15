import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCortexStream } from "../useCortexStream";
import { useCortexStore } from "../cortexStore";
import MessageBubble from "./MessageBubble";
import SystemPulse from "./SystemPulse";
import { supabase } from "../../../lib/supabase";

const SCROLL_THRESHOLD = 120;

function SendIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
      <rect x="4" y="4" width="12" height="12" rx="2" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}
function ShieldIcon({ active }) {
  return (
    <svg viewBox="0 0 20 20" className={`w-3 h-3 fill-current transition-colors ${active ? "text-emerald-400" : "text-slate-600"}`}>
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd" />
    </svg>
  );
}

export default function ChatPanel({ tenant, selectedRecordId, showContextToggle = false, onContextToggle }) {
  const {
    messages, streamStatus, statusMessage, maskedEntities,
    isStreaming, error, sendMessage, stopStream, clearMessages,
  } = useCortexStream({ tenant, selectedRecordId });

  const [input, setInput] = useState("");

  // ── Golden Answer: save a corrected AI response as training data ──────
  const handleSaveGolden = useCallback(async (messageId, goldenAnswer) => {
    // Find the preceding user message to use as the "query"
    const msgIndex  = messages.findIndex((m) => m.id === messageId);
    const userMsg   = messages.slice(0, msgIndex).reverse().find((m) => m.role === "user");
    const query     = userMsg?.content ?? "Unknown query";
    const bizId     = tenant?.id ?? useCortexStore.getState().tenant?.id;

    if (!bizId) throw new Error("No business ID available");

    const { error: rpcErr } = await supabase.rpc("fn_save_training_data", {
      p_business_id:   bizId,
      p_query:         query,
      p_golden_answer: goldenAnswer,
      p_skill_slug:    null,    // TODO: pass active skill slug from tenant config
      p_source_msg_id: messageId,
      p_quality_score: 5,
    });

    if (rpcErr) throw rpcErr;
  }, [messages, tenant]);

  const threadRef = useRef(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const isNearBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
  }, []);

  useLayoutEffect(() => {
    if (isNearBottom()) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isNearBottom]);

  const resizeTextarea = (el) => {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handleSend = useCallback(() => {
    const q = input.trim();
    if (!q || isStreaming) return;
    sendMessage(q);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const hasContext = !!selectedRecordId;
  const hasMasking = maskedEntities.length > 0;
  const isSecurityError = !!error && (
    error.includes("Security Alert") ||
    error.includes("Access denied") ||
    error.includes("workspace")
  );

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.08]">
        {showContextToggle && (
          <button onClick={onContextToggle} aria-label="Open context panel"
            className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.07] transition"
          >
            <MenuIcon />
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="text-sm font-medium text-white truncate">Cortex AI</span>
        </div>
        <AnimatePresence>
          {hasMasking && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30"
            >
              <ShieldIcon active />
              <span className="text-[10px] text-emerald-400 font-medium">{maskedEntities.length} masked</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ml-auto shrink-0">
          {hasContext
            ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Context active</span>
            : <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">No context</span>
          }
        </div>
        {messages.length > 0 && (
          <button onClick={clearMessages}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition px-2 py-1 rounded-lg hover:bg-white/5 ml-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center gap-3 select-none pointer-events-none"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/20 grid place-items-center text-xl">🧠</div>
              <p className="text-slate-500 text-sm text-center max-w-[200px]">
                {hasContext ? "Ask anything about the selected record." : "Select a record first to enable context-aware answers."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onSaveGolden={msg.role === "assistant" ? handleSaveGolden : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* System pulse */}
      <div className="shrink-0 px-4 py-2 min-h-[48px] flex flex-col items-center justify-center gap-1">
        <SystemPulse status={streamStatus} />
        <AnimatePresence>
          {statusMessage && isStreaming && (
            <motion.p key={statusMessage}
              initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-[10px] text-slate-600 text-center"
            >
              {statusMessage}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} className="shrink-0 overflow-hidden"
          >
            <div className={`mx-4 mb-2 px-3 py-2 rounded-xl border text-xs ${isSecurityError
              ? "bg-red-600/15 border-red-500/40 text-red-300"
              : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}>{error}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4 pt-1 border-t border-white/[0.08]">
        {!hasContext && (
          <p className="text-[11px] text-amber-400/70 mb-2 flex items-center gap-1.5">
            <span>⚠</span>
            {showContextToggle ? "Tap ≡ to select a record." : "Select a record on the left."}
          </p>
        )}
        <div className={`flex items-end gap-2 rounded-2xl p-2 bg-white/[0.05] border transition-colors duration-200 focus-within:border-indigo-500/50 focus-within:bg-white/[0.07] ${hasContext ? "border-white/[0.10]" : "border-white/[0.06]"}`}>
          <textarea ref={textareaRef} rows={1} value={input}
            onChange={(e) => { setInput(e.target.value); resizeTextarea(e.target); }}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={isStreaming ? "Generating response…" : hasContext ? "Ask about the record… (Enter to send)" : "Select a record first…"}
            className={`flex-1 bg-transparent resize-none outline-none text-sm text-white placeholder-slate-600 leading-relaxed py-1.5 px-2 max-h-[140px] overflow-y-auto ${isStreaming ? "opacity-40 cursor-not-allowed" : ""}`}
          />
          {isStreaming ? (
            <button onClick={stopStream} aria-label="Stop generation"
              className="shrink-0 p-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
            >
              <StopIcon />
            </button>
          ) : (
            <motion.button onClick={handleSend} disabled={!input.trim()}
              aria-label="Send message" whileTap={{ scale: 0.92 }}
              className={`shrink-0 p-2.5 rounded-xl transition ${input.trim() ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-white/[0.05] text-slate-600 cursor-not-allowed"}`}
            >
              <SendIcon />
            </motion.button>
          )}
        </div>
        <p className="text-center text-[10px] text-slate-700 mt-2">
          PII is masked before leaving this device · Powered by Gemini 1.5 Pro (3.1)
        </p>
      </div>
    </div>
  );
}
