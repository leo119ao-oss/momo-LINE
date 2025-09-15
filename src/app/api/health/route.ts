export const runtime = "edge";

export async function GET() {
  const nowJst = new Date().toLocaleString("ja-JP", { timeZone: process.env.NEXT_PUBLIC_JST_TZ ?? "Asia/Tokyo" });
  const rev = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) ?? "dev";
  return new Response(JSON.stringify({ ok:true, rev, nowJst }), {
    headers: { "content-type":"application/json", "access-control-allow-origin":"*" }
  });
}
