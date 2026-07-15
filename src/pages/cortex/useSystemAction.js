/**
 * useSystemAction.js
 *
 * Parses [SYSTEM_ACTION]{...} blocks from Gemini's response stream and
 * manages execution state (idle → running → success | failed) per action.
 *
 * Parsing strategy:
 *   Split content on [SYSTEM_ACTION] tag, then greedily extract the first
 *   balanced JSON object from the head of each trailing segment.
 */

import { useCallback, useRef, useState } from "react";

// ── Parser ─────────────────────────────────────────────────────────────────

/**
 * Extract the first balanced JSON object starting at position 0 of `str`.
 * Returns { json: Object, rest: string } or null if no valid JSON found.
 */
function extractLeadingJson(str) {
  const start = str.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const json = JSON.parse(str.slice(start, i + 1));
          return { json, rest: str.slice(i + 1) };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * parseSystemActions(content: string) → Array<Segment>
 *
 * Segment = { type: "text", content: string }
 *         | { type: "action", id: string, payload: ActionPayload }
 *
 * ActionPayload = { command: string, description: string, risk_level: "low"|"medium"|"high" }
 */
export function parseSystemActions(content) {
  const TAG = "[SYSTEM_ACTION]";
  const parts = content.split(TAG);
  const segments = [];

  // First segment is always plain text (possibly empty)
  if (parts[0]) segments.push({ type: "text", content: parts[0] });

  for (let i = 1; i < parts.length; i++) {
    const raw = parts[i].trimStart();
    const extracted = extractLeadingJson(raw);

    if (extracted) {
      segments.push({
        type: "action",
        id: crypto.randomUUID(),
        payload: {
          command: extracted.json.command ?? "",
          description: extracted.json.description ?? "System Action",
          risk_level: extracted.json.risk_level ?? "medium",
        },
      });
      if (extracted.rest.trim()) {
        segments.push({ type: "text", content: extracted.rest });
      }
    } else {
      // Couldn't parse — fall back to showing the raw tag + text
      segments.push({ type: "text", content: TAG + parts[i] });
    }
  }

  return segments;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * useSystemAction()
 *
 * Returns:
 *   executionMap: Record<actionId, ExecutionState>
 *   execute(actionId, command): void  — fires the SSE stream
 *   cancel(actionId): void            — kills ongoing stream + clears logs
 *
 * ExecutionState = {
 *   status: "idle" | "running" | "success" | "failed",
 *   logs: string[],
 *   exitCode: number | null,
 * }
 */
export function useSystemAction() {
  const [executionMap, setExecutionMap] = useState({});
  const abortRefs = useRef({});

  const patch = useCallback((id, update) => {
    setExecutionMap((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { status: "idle", logs: [], exitCode: null }), ...update },
    }));
  }, []);

  const execute = useCallback(async (actionId, command) => {
    // Abort any previous stream for this action
    abortRefs.current[actionId]?.abort();
    const ctrl = new AbortController();
    abortRefs.current[actionId] = ctrl;

    patch(actionId, { status: "running", logs: [], exitCode: null });

    try {
      const res = await fetch("/api/lab/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          jwt: import.meta.env.VITE_LAB_JWT ?? "superadmin-edgehub",
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        patch(actionId, { status: "failed", logs: [`❌ HTTP ${res.status}: ${text}`] });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const appendLog = (line) =>
        setExecutionMap((prev) => ({
          ...prev,
          [actionId]: {
            ...prev[actionId],
            logs: [...(prev[actionId]?.logs ?? []), line],
          },
        }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";

        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            let evt;
            try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }

            switch (evt.type) {
              case "stdout":
              case "stderr":
                appendLog(evt.line);
                break;
              case "done":
                patch(actionId, {
                  status: evt.exitCode === 0 ? "success" : "failed",
                  exitCode: evt.exitCode,
                });
                break;
              case "error":
                patch(actionId, { status: "failed", logs: [evt.message] });
                break;
            }
          }
        }
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        patch(actionId, { status: "failed", logs: [`Connection error: ${err.message}`] });
      }
    }
  }, [patch]);

  const cancel = useCallback((actionId) => {
    abortRefs.current[actionId]?.abort();
    patch(actionId, { status: "idle", logs: [], exitCode: null });
  }, [patch]);

  return { executionMap, execute, cancel };
}
