import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const title = 'Momo 絵日記';
  return { title, description: '今日の小さな一枚' };
}

export default async function DiaryPage({ params }: { params: { slug: string } }) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: rows } = await supabase
    .from('media_entries')
    .select('image_url, caption, extra_note, created_at, guess')
    .eq('page_slug', params.slug)
    .limit(1);

  const e = rows?.[0];
  if (!e) return <main style={{padding:'32px',fontFamily:'system-ui'}}>このページは見つかりませんでした。</main>;

  // スタイル（落ち着き＋印刷もOK）
  return (
    <main style={{
      fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,system-ui',
      background:'#f7f7f5', minHeight:'100vh', padding:'32px 16px'
    }}>
      <div style={{
        maxWidth:860, margin:'0 auto', background:'#fff',
        borderRadius:16, boxShadow:'0 8px 24px rgba(0,0,0,.06)', overflow:'hidden'
      }}>
        <div style={{padding:'24px 28px', borderBottom:'1px solid #eee'}}>
          <h1 style={{fontSize:24, margin:0, letterSpacing:'.02em'}}>今日の小さな絵日記</h1>
          <p style={{color:'#6b7280', margin:'6px 0 0'}}>{new Date(e.created_at).toLocaleString('ja-JP')}</p>
        </div>

        <div style={{padding: '0 28px 24px'}}>
          {/* 画像 */}
          <div style={{borderRadius:12, overflow:'hidden', margin:'22px 0'}}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.image_url} alt={e.caption || 'photo'} style={{width:'100%', display:'block'}}/>
          </div>

          {/* キャプション */}
          {e.caption && (
            <p style={{fontSize:20, lineHeight:1.6, margin:'6px 0 0', color:'#111'}}>{e.caption}</p>
          )}
          {/* サブテキスト */}
          <p style={{color:'#4b5563', margin:'6px 0 18px'}}>
            {e.extra_note || e.guess}
          </p>

          <hr style={{border:'none', borderTop:'1px solid #eee', margin:'20px 0'}}/>

          <div style={{display:'flex', gap:24, flexWrap:'wrap'}}>
            <div style={{flex:'1 1 240px'}}>
              <h3 style={{fontSize:14, color:'#6b7280', letterSpacing:'.08em'}}>気づき</h3>
              <p style={{marginTop:8, color:'#374151'}}>
                {e.extra_note ? 'この一言が、今日の心のスナップ。' : '小さなひとことを書き足すと、もっと自分のページになるよ。'}
              </p>
            </div>
            <div style={{flex:'1 1 240px'}}>
              <h3 style={{fontSize:14, color:'#6b7280', letterSpacing:'.08em'}}>ヒント</h3>
              <ul style={{margin:'8px 0', paddingLeft:18, color:'#374151'}}>
                <li>ページ右上の共有で家族にも。</li>
                <li>1日1枚続けると、週の振り返りがラクに。</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
