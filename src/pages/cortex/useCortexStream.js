/**
 * useCortexStream.js — Production SSE hook (Phase 3).
 *
 * Uses fetch + ReadableStream (not EventSource) to support custom headers.
 * rAF chunk buffer prevents UI flicker from rapid Gemini chunks (~15-25/sec).
 */

import { useCallback, useRef, useState } from "react";
import { CORTEX_API } from "./cortexApi";
import { useCortexStore } from "./cortexStore";

// ── Security-specific HTTP error messages ─────────────────────────────

function httpErrorMessage(status) {
  switch (status) {
    case 401: return "🔐 Security Alert: Session invalid or expired. Please reload.";
    case 403: return "🚫 Access denied — you don't have permission for this resource.";
    case 404: return "🔍 Record not found — it may belong to a different workspace.";
    case 429: return "⏱ Rate limit reached. Please wait a moment.";
    case 500: return "🔧 Server error — the AI service encountered an internal problem.";
    default: return `Connection error: HTTP ${status}`;
  }
}

function mapStatusMsg(msg) {
  const l = msg.toLowerCase();
  if (l.includes("context") || l.includes("fetch") || l.includes("load")) return "fetching";
  if (l.includes("think")) return "thinking";
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useCortexStream({ tenant, selectedRecordId }) {
  const [messages, setMessages] = useState([]);
  const [streamStatus, setStreamStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState(null);
  const [maskedEntities, setMaskedEntities] = useState([]);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const chunkBufRef = useRef("");
  const rafHandleRef = useRef(null);
  const activeAssistIdRef = useRef(null);

  const isStreaming = streamStatus !== "idle" && streamStatus !== "error";

  const patchMsg = useCallback((id, patch) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m))),
    []);

  const toError = useCallback((msg) => {
    setStreamStatus("error");
    setError(msg);
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
      chunkBufRef.current = "";
    }
    setTimeout(() => { setStreamStatus("idle"); setError(null); }, 3000);
  }, []);

  // ── rAF flush: batch chunk updates to ~60fps ──────────────────────

  const scheduleFlush = useCallback((assistantId) => {
    if (rafHandleRef.current !== null) return;
    rafHandleRef.current = requestAnimationFrame(() => {
      rafHandleRef.current = null;
      const flushed = chunkBufRef.current;
      chunkBufRef.current = "";
      if (!flushed) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + flushed } : m,
        ),
      );
    });
  }, []);

  // ── sendMessage ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (query) => {
      if (!query.trim() || isStreaming) return;

      setError(null);
      setStatusMessage(null);
      setMaskedEntities([]);

      const sessionId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();

      activeAssistIdRef.current = assistantId;
      chunkBufRef.current = "";

      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: query, timestamp: new Date() },
        { id: assistantId, role: "assistant", content: "", timestamp: new Date(), streamStatus: "streaming" },
      ]);
      setStreamStatus("masking");

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Always read tenant ID from store (never trust stale prop)
      const tenantId = useCortexStore.getState().tenant?.id ?? tenant.id;

      try {
        const res = await fetch(`${CORTEX_API}/api/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Cortex-Tenant-ID": tenantId,
          },
          body: JSON.stringify({
            query,
            tenant_id: tenantId,
            business_type: tenant.businessType,
            record_id: selectedRecordId ?? null,
            tone: tenant.tone,
            session_id: sessionId,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const secMsg = httpErrorMessage(res.status);
          patchMsg(assistantId, { content: `⚠️ ${secMsg}`, streamStatus: "error" });
          toError(secMsg);
          return;
        }

        if (!res.body) throw new Error("Server returned an empty response body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let lineBuf = "";
        let firstContent = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            const tail = decoder.decode(undefined, { stream: false });
            if (tail) lineBuf += tail;
            break;
          }
          lineBuf += decoder.decode(value, { stream: true });

          const frames = lineBuf.split("\n\n");
          lineBuf = frames.pop() ?? "";

          for (const frame of frames) {
            for (const line of frame.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;

              let evt;
              try { evt = JSON.parse(trimmed.slice(5).trim()); }
              catch { continue; }

              switch (evt.type) {
                case "shield_active":
                  patchMsg(userId, {
                    privacy: {
                      isActive: evt.has_pii,
                      maskedEntities: evt.masked_entities,
                      sanitizedPrompt: evt.sanitized_prompt,
                    },
                  });
                  setMaskedEntities(evt.masked_entities);
                  setStreamStatus("fetching");
                  break;

                case "status": {
                  setStatusMessage(evt.message);
                  const next = mapStatusMsg(evt.message);
                  if (next) setStreamStatus(next);
                  break;
                }

                case "chunk":
                  if (!evt.content) break;
                  if (firstContent) { setStreamStatus("writing"); firstContent = false; }
                  chunkBufRef.current += evt.content;
                  scheduleFlush(assistantId);
                  break;

                case "done":
                  if (rafHandleRef.current !== null) {
                    cancelAnimationFrame(rafHandleRef.current);
                    rafHandleRef.current = null;
                  }
                  if (chunkBufRef.current) {
                    const finalText = chunkBufRef.current;
                    chunkBufRef.current = "";
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: m.content + finalText }
                          : m,
                      ),
                    );
                  }
                  patchMsg(assistantId, {
                    streamStatus: "complete",
                    usage: evt.usage // <-- Add this
                  });
                  setStreamStatus("idle");
                  setStatusMessage(null);
                  activeAssistIdRef.current = null;
                  break;

                case "error":
                  patchMsg(assistantId, { content: `⚠️ ${evt.message}`, streamStatus: "error" });
                  toError(evt.message ?? "Unknown error");
                  break;
              }
            }
          }
        }

      } catch (err) {
        if (err?.name === "AbortError") {
          if (rafHandleRef.current !== null) {
            cancelAnimationFrame(rafHandleRef.current);
            rafHandleRef.current = null;
          }
          if (chunkBufRef.current) {
            const partial = chunkBufRef.current;
            chunkBufRef.current = "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + partial }
                  : m,
              ),
            );
          }
          patchMsg(assistantId, { streamStatus: "complete" });
          setStreamStatus("idle");
          setStatusMessage(null);
          activeAssistIdRef.current = null;
          return;
        }
        const msg = err?.message ?? "Connection failed";
        patchMsg(assistantId, { content: `⚠️ ${msg}`, streamStatus: "error" });
        toError(msg);
      }
    },
    [tenant, selectedRecordId, isStreaming, patchMsg, toError, scheduleFlush],
  );

  const stopStream = useCallback(() => { abortRef.current?.abort(); }, []);

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    chunkBufRef.current = "";
    activeAssistIdRef.current = null;
    setMessages([]);
    setStreamStatus("idle");
    setStatusMessage(null);
    setMaskedEntities([]);
    setError(null);
  }, []);

  return {
    messages, streamStatus, statusMessage,
    maskedEntities, isStreaming, error,
    sendMessage, stopStream, clearMessages,
  };
}
