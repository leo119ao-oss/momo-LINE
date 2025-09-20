import { NextRequest } from "next/server";
import { z } from "zod";

// ここでは既存のrag.tsを想定。なければダミーでOK（後日差し替え）。
// import { runRag } from "@/lib/rag";

const Body = z.object({ contact:z.string(), q:z.string().min(2) });

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const json = await req.json();
  const { success, data } = Body.safeParse(json);
  if (!success) return new Response("bad request", {status:400});

  const rev = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? "dev";

  // --- ダミー実装（まず体験を回す） ---
  // 低確度っぽいワードが無ければ推薦、あれば確認質問
  const low = /どれ|どう|わから|おすすめ|何/.test(data.q);
  if (low) {
    return Response.json({
      type:"confirm",
      message:"どちらが近いですか？",
      options:["レシピを知りたい","作り方のコツを知りたい"],
      freeTextHint:"自由に書いてもOKです",
      rev
    });
  }
  return Response.json({
    type:"recommendations",
    items:[
      { url:"https://okaasan.net/", title:"例：記事A", why:"質問の主要語に一致" },
      { url:"https://okaasan.net/", title:"例：記事B", why:"具体キーワードが一致" },
      { url:"https://okaasan.net/", title:"例：記事C", why:"過去の似た質問に近い" }
    ],
    rev
  });
}
