// src/lib/log.ts

export function appRev() {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? "devlocal";
}

export function logRagMeta(url: string, haveTitle: boolean, haveAuthor: boolean) {
  console.log(`[RAG_META] url=${url} title=${haveTitle} author=${haveAuthor}`);
}

export function logEmpathyMeta(input: string, output: string) {
  const praise = (output.match(/すごい|素晴らしい|偉い|完璧|神|尊い/g) || []).length;
  const hasLabel = /見方|傾向/.test(output);
  const sentences = output.split(/[。！？]/).filter(s => s.trim().length > 0);
  const isWithin3Sentences = sentences.length <= 3;
  const hasQuestion = /[？?]/.test(output);
  
  console.log("[EMP_META]", JSON.stringify({
    praise_count: praise,
    has_label: hasLabel,
    sentence_count: sentences.length,
    is_within_3_sentences: isWithin3Sentences,
    has_question: hasQuestion,
    length: output.length,
    input_length: input.length
  }));
}