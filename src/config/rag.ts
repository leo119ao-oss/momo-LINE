export const RAG_TOP_K   = Number(process.env.RAG_TOP_K ?? 3);
export const RAG_MIN_SIM = Number(process.env.RAG_MIN_SIM ?? 0.45);
export const RAG_2ND_KEY_TERMS = Number(process.env.RAG_2ND_KEY_TERMS ?? 6);
export const RAG_JA_SYNONYM = (process.env.RAG_JA_SYNONYM ?? "off") === "on";
