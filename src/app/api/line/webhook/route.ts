export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  console.log('[WEBHOOK] hit');
  return new Response('ok', { status: 200 });
}