export function logRagEvent(ev: {
  rev: string;
  intent: "info" | "empathy" | "other";
  q: string;
  topK: number;
  minSim: number;
  rawCount: number;
  keptCount: number;
  lowConfFallback: boolean;
}) {
  try { 
    console.log("[RAG_EVT]", JSON.stringify({ ...ev, ts: new Date().toISOString() })); 
  } catch {}
}
