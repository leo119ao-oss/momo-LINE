import { NextRequest } from "next/server";
import { z } from "zod";

const Body = z.object({ contact:z.string(), q:z.string().min(2) });

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    console.log('[ASK] Request received');
    
    const json = await req.json();
    const { success, data } = Body.safeParse(json);
    
    if (!success) {
      console.error('[ASK] Invalid request body:', json);
      return new Response("Invalid request body", {status:400});
    }

    console.log('[ASK] Processing query:', data.q);

    const rev = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? "dev";

    // 低確度っぽいワードが無ければ推薦、あれば確認質問
    const low = /どれ|どう|わから|おすすめ|何/.test(data.q);
    
    if (low) {
      console.log('[ASK] Low confidence query, returning confirmation');
      return Response.json({
        type:"confirm",
        message:"どちらが近いですか？",
        options:["レシピを知りたい","作り方のコツを知りたい"],
        freeTextHint:"自由に書いてもOKです",
        rev
      });
    }
    
    console.log('[ASK] High confidence query, returning recommendations');
    return Response.json({
      type:"recommendations",
      items:[
        { url:"https://okaasan.net/", title:"例：記事A", why:"質問の主要語に一致" },
        { url:"https://okaasan.net/", title:"例：記事B", why:"具体キーワードが一致" },
        { url:"https://okaasan.net/", title:"例：記事C", why:"過去の似た質問に近い" }
      ],
      rev
    });
    
  } catch (error) {
    console.error('[ASK] Error processing request:', error);
    return new Response("Internal server error", {status:500});
  }
}
