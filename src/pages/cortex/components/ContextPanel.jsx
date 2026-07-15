import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cortexFetch, CORTEX_API } from "../cortexApi";
import { useCortexStore } from "../cortexStore";
import EntitiesPanel from "./EntitiesPanel";

const VERTICAL_META = {
  IT_LAB: { icon: "🖥️", label: "Devices" },
  LAW_FIRM: { icon: "⚖️", label: "Cases" },
  CAFE: { icon: "☕", label: "Menu Items" },
};

const ACCEPTED_MIME = [
  "application/pdf",
  "image/jpeg", "image/png", "image/tiff", "image/webp",
].join(",");

function Spinner() {
  return (
    <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-white/20 border-t-indigo-400"
      animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
    />
  );
}

function fieldLabel(key) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function fieldValue(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function DocIcon({ mime }) {
  if (mime === "application/pdf") return <span className="text-[11px]">📄</span>;
  if (mime?.startsWith("image/")) return <span className="text-[11px]">🖼️</span>;
  return <span className="text-[11px]">📎</span>;
}

// ── Document list sub-component ────────────────────────────────────────

function DocumentsSection({ recordId }) {
  const tenantId = useCortexStore((s) => s.tenant?.id);

  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const [uploadOk, setUploadOk] = useState(null); // filename of last success
  const [progress, setProgress] = useState(0);    // 0-100

  const fileInputRef = useRef(null);

  // ── Fetch doc list ──────────────────────────────────────────────────
  const fetchDocs = useCallback(() => {
    if (!recordId) return;
    setDocsLoading(true);
    cortexFetch(`/api/documents/list?record_id=${encodeURIComponent(recordId)}`)
      .then((res) => setDocs(res.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [recordId]);

  useEffect(() => {
    setDocs([]);
    fetchDocs();
  }, [fetchDocs]);

  // ── Upload ──────────────────────────────────────────────────────────
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !tenantId || !recordId) return;

    e.target.value = ""; // reset so same files can be re-selected

    setUploading(true);
    setUploadErr(null);
    setUploadOk(null);

    let successCount = 0;
    let fallbackErr = null;

    for (const file of files) {
      setProgress(10);
      const form = new FormData();
      form.append("file", file);
      form.append("record_id", recordId);

      try {
        setProgress(30);
        const res = await fetch(`${CORTEX_API}/api/documents/upload`, {
          method: "POST",
          headers: { "X-Cortex-Tenant-ID": tenantId },
          body: form,
        });
        setProgress(80);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.detail ?? `HTTP ${res.status}`);

        successCount++;
        setUploadOk(
          files.length > 1
            ? `${successCount} of ${files.length} uploaded...`
            : file.name
        );
      } catch (err) {
        console.error("Upload error for", file.name, err);
        fallbackErr = err.message;
        setUploadErr(`Failed: ${file.name} - ${err.message}`);
        // Let it continue uploading the rest if multiple, but show the last error
      }
    }

    setProgress(100);

    if (successCount === files.length) {
      setUploadOk(files.length > 1 ? `${files.length} files added` : files[0].name);
      setUploadErr(null);
    } else if (successCount > 0) {
      setUploadOk(`${successCount} files added (some failed)`);
    } else {
      setUploadOk(null);
      setUploadErr(fallbackErr || "Upload failed");
    }

    fetchDocs();
    setUploading(false);
    setTimeout(() => setProgress(0), 1500);
  };

  const handleDelete = async (docId) => {
    try {
      await cortexFetch(`/api/documents/${docId}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  if (!recordId) return null;

  return (
    <div className="shrink-0 space-y-2">

      {/* Section header + upload button */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          Documents
        </span>
        <div className="flex items-center gap-1.5">
          {docsLoading && <Spinner />}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload document (PDF / image)"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold transition shadow-lg shadow-indigo-900/20"
          >
            {uploading ? (
              <Spinner />
            ) : (
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-current">
                <path d="M8 1a.75.75 0 01.75.75v5.5h5.5a.75.75 0 010 1.5H8.75v5.5a.75.75 0 01-1.5 0V8.75H1.75a.75.75 0 010-1.5H7.25v-5.5A.75.75 0 018 1z" />
              </svg>
            )}
            {uploading ? "Uploading…" : "Add Files"}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />
      </div>

      {/* Upload progress bar */}
      {uploading && progress > 0 && (
        <div className="h-0.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full bg-indigo-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Feedback */}
      <AnimatePresence>
        {uploadOk && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="text-[10px] text-emerald-400 flex items-center gap-1"
          >
            ✓ {uploadOk} added
          </motion.div>
        )}
        {uploadErr && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="text-[10px] text-red-400"
          >
            ⚠️ {uploadErr}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document list */}
      {docs.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] divide-y divide-white/[0.05] overflow-hidden">
          {docs.map((doc) => (
            <div key={doc.id}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/[0.04] group transition"
            >
              <DocIcon mime={doc.mime_type} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-200 truncate">{doc.filename}</p>
                <p className="text-[9px] text-slate-600 font-mono">
                  {doc.page_count ? `${doc.page_count}p · ` : ""}
                  {doc.char_count ? `${doc.char_count.toLocaleString()} chars` : ""}
                  {doc.pii_detected ? " · 🔒 PII masked" : ""}
                </p>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                title="Remove document"
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 transition"
              >
                <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
                  <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {!docsLoading && docs.length === 0 && (
        <p className="text-[10px] text-slate-700 text-center py-1">
          No documents — upload PDF or image for AI context
        </p>
      )}
    </div>
  );
}

// ── Tab strip ──────────────────────────────────────────────────────────

const TABS = [
  { id: "records",   label: "Records"  },
  { id: "entities",  label: "Entities" },
];

function TabStrip({ active, onChange }) {
  return (
    <div className="shrink-0 flex gap-1 px-4 pt-3 pb-0">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            "relative px-3 py-1.5 rounded-lg text-xs font-medium transition",
            active === tab.id
              ? "text-white bg-white/[0.10]"
              : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]",
          ].join(" ")}
        >
          {tab.label}
          {active === tab.id && (
            <motion.span
              layoutId="ctx-tab-indicator"
              className="absolute inset-0 rounded-lg ring-1 ring-indigo-500/50 bg-indigo-500/10"
              transition={{ duration: 0.2 }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ── RecordsPanel (extracted from original ContextPanel body) ────────────

function RecordsPanel({ businessType, selectedRecordId, onSelectRecord }) {
  const meta = VERTICAL_META[businessType] ?? { icon: "📋", label: "Records" };

  const [records, setRecords] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const abortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true); setListError(null); setRecords([]); setDetail(null);

    cortexFetch(`/api/records/${businessType}`)
      .then((res) => {
        if (!cancelled) {
          const recs = res.records ?? [];
          setRecords(recs);
          // Auto-select if ONLY one record exists
          if (recs.length === 1 && !selectedRecordId) {
            onSelectRecord(recs[0].id);
          }
        }
      })
      .catch((err) => { if (!cancelled) setListError(err.message); })
      .finally(() => { if (!cancelled) setListLoading(false); });

    return () => { cancelled = true; };
  }, [businessType, onSelectRecord, selectedRecordId]);

  useEffect(() => {
    if (!selectedRecordId) { setDetail(null); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setDetailLoading(true); setDetailError(null);

    cortexFetch(`/api/context/${businessType}/${selectedRecordId}`, { signal: abortRef.current.signal })
      .then(setDetail)
      .catch((err) => { if (err.name !== "AbortError") setDetailError(err.message); })
      .finally(() => setDetailLoading(false));

    return () => abortRef.current?.abort();
  }, [businessType, selectedRecordId]);

  const filtered = records.filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRefresh = useCallback(() => {
    setSearch(""); setListLoading(true); setListError(null);
    cortexFetch(`/api/records/${businessType}`)
      .then((res) => setRecords(res.records ?? []))
      .catch((err) => setListError(err.message))
      .finally(() => setListLoading(false));
  }, [businessType]);

  return (
    <div className="flex flex-col h-full p-4 gap-4">

      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-lg">{meta.icon}</span>
        <h2 className="text-sm font-semibold text-white">{meta.label}</h2>
        <div className="ml-auto flex items-center gap-2">
          {listLoading
            ? <Spinner />
            : <span className="text-[10px] text-slate-600 font-mono">
              {records.length} item{records.length !== 1 ? 's' : ''}
            </span>
          }
          {!listLoading && (
            <button onClick={handleRefresh} aria-label="Refresh"
              className="p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition"
            >
              <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0 relative">
        <svg viewBox="0 0 20 20" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 fill-current text-slate-600 pointer-events-none">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter records…"
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/40 transition"
        />
      </div>

      {/* Record list */}
      <div className="shrink-0 rounded-xl overflow-hidden border border-white/[0.08] divide-y divide-white/[0.06] max-h-[220px] overflow-y-auto">
        {listError && <div className="px-3.5 py-3 text-xs text-red-400">⚠️ {listError}</div>}
        {listLoading && !listError && [1, 2, 3].map((i) => (
          <div key={i} className="px-3.5 py-2.5 flex items-center gap-2">
            <div className="h-3 rounded bg-white/[0.07] animate-pulse flex-1" />
          </div>
        ))}
        {!listLoading && !listError && filtered.length === 0 && (
          <div className="px-3.5 py-3 text-xs text-slate-600">
            {search ? "No matches" : "No records found"}
          </div>
        )}
        <AnimatePresence initial={false}>
          {!listLoading && filtered.map((rec) => (
            <motion.button key={rec.id} layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => onSelectRecord(rec.id)}
              className={`w-full text-left px-3.5 py-2.5 text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 ${selectedRecordId === rec.id
                ? "bg-indigo-500/20 text-indigo-200"
                : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
            >
              <span className="block truncate">{rec.name}</span>
              <span className="block text-[10px] text-slate-600 font-mono mt-0.5">#{rec.id}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>


      {/* Detail card */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        {!selectedRecordId && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-600 select-none">
            <span className="text-3xl opacity-20">👆</span>
            <p className="text-xs text-center">Select a record above to load context</p>
          </div>
        )}

        {selectedRecordId && (
          <div className="space-y-4">
            {/* Documents — show immediately when record selected */}
            <DocumentsSection recordId={selectedRecordId} />

            <div className="h-px bg-white/[0.06]" />

            {detailLoading && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Spinner />
                  <span className="text-[11px] text-slate-500 italic">Reading data...</span>
                </div>
              </div>
            )}

            {detailError && !detailLoading && (
              <div className="text-xs text-red-400 p-2 rounded bg-red-400/5 border border-red-400/10">
                <p>⚠️ {detailError}</p>
              </div>
            )}

            <AnimatePresence mode="wait">
              {detail && !detailLoading && (
                <motion.div key={selectedRecordId}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                      {detail.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(detail.data ?? {})
                      .filter(([, v]) => v !== null && v !== undefined && v !== "")
                      .map(([k, v]) => (
                        <div key={k} className="grid grid-cols-5 gap-2 text-[11px] items-start">
                          <span className="col-span-2 text-slate-500 font-medium truncate">{fieldLabel(k)}</span>
                          <span className="col-span-3 text-slate-300 break-words">{fieldValue(v)}</span>
                        </div>
                      ))}
                  </div>
                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-1.5">
                    <motion.span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"
                      animate={{ scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <span className="text-[10px] text-slate-500">Context injected into every AI reply</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ContextPanel (with tab navigation) ─────────────────────────────────

export default function ContextPanel({ businessType, selectedRecordId, onSelectRecord }) {
  const [activeTab, setActiveTab] = useState("records");

  return (
    <div className="flex flex-col h-full">
      <TabStrip active={activeTab} onChange={setActiveTab} />

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "records" ? (
            <motion.div
              key="records"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              <RecordsPanel
                businessType={businessType}
                selectedRecordId={selectedRecordId}
                onSelectRecord={onSelectRecord}
              />
            </motion.div>
          ) : (
            <motion.div
              key="entities"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              <EntitiesPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
