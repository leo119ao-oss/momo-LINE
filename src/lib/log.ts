// src/lib/log.ts

export function appRev() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? "devlocal";
}

export function logRagMeta(url: string, haveTitle: boolean, haveAuthor: boolean) {
  console.log(`[RAG_META] url=${url} title=${haveTitle} author=${haveAuthor}`);
}
