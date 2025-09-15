"use strict";exports.id=838,exports.ids=[838],exports.modules={838:(e,t,a)=>{a.d(t,{U0:()=>g,zb:()=>k});var n=a(8316),r=a(4214);let i=`
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる(〜だね/〜かもね).
- 断定や評価は避け、「〜かも」「〜してみる？」の提案.
- 長文にしすぎない。段落を分けて読みやすく.
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
`.trim();function o(e){return String(e??"").replace(/^\s*["'\u3000]+|["'\u3000]+\s*$/g,"").replace(/\s+/g," ").slice(0,140)}async function s(e,t){let a=`あなたは記事レコメンドの編集者。以下の候補が質問に「なぜ役立つか」を日本語で１文だけ返す。
- 断定せず「〜に役立ちそう」「〜のヒントがある」等のやわらかい表現
- 具体語を１つ入れる（年齢帯/場面/活動など）
- 出力は１文のみ（飾りや箇条書き禁止）`,n=`質問: ${e}
候補URL: ${t.url}
抜粋: """${t.snippet.slice(0,400)}"""
=> １文だけ出力`;try{let e=await f.chat.completions.create({model:"gpt-4o-mini",temperature:.2,messages:[{role:"system",content:a},{role:"user",content:n}]});return o(e.choices[0].message.content??"")}catch{return"このテーマに関する実践的なヒントがまとまっています。"}}function l(e){return e?e.replace(/<[^>]*>/g,"").replace(/\s*\|\s*.*$/,"").trim():""}async function c(e){let t=`https://www.okaasan.net/wp-json/oembed/1.0/embed?url=${encodeURIComponent(e)}`,a=await fetch(t,{cache:"no-store"});if(!a.ok)return null;let n=await a.json(),r=l(n?.title),i=n?.author_name||"お母さん大学";return r?{title:r,author_name:i}:null}async function m(e){let t="https://www.okaasan.net/wp-json/wp/v2/posts",a=function(e){try{let t=new URL(e).pathname.split("/").filter(Boolean);return t.length?decodeURIComponent(t.at(-1)):null}catch{return null}}(e);if(a){let e=await fetch(`${t}?slug=${encodeURIComponent(a)}&_embed=author&per_page=1`);if(e.ok){let t=await e.json(),a=t?.[0];if(a)return{title:l(a?.title?.rendered),author_name:a?._embedded?.author?.[0]?.name||"お母さん大学"}}}let n=await fetch(`${t}?search=${encodeURIComponent(e)}&_embed=author&per_page=1`);if(n.ok){let e=await n.json(),t=e?.[0];if(t)return{title:l(t?.title?.rendered),author_name:t?._embedded?.author?.[0]?.name||"お母さん大学"}}return null}async function u(e){try{let t=(await (await fetch(e,{cache:"no-store"})).text()).match(/<title>(.*?)<\/title>/i);if(t?.[1])return{title:l(t[1]),author_name:"お母さん大学"}}catch{}return null}let p=new Map;async function d(e){if(e.title&&e.author_name)return e;let t=p.get(e.source_url);if(t)return e.title=e.title??t.title,e.author_name=e.author_name??t.author_name,e;let n=await c(e.source_url);if(n||(n=await m(e.source_url)),n||(n=await u(e.source_url)),n){p.set(e.source_url,n),e.title=e.title??n.title,e.author_name=e.author_name??n.author_name,console.log("RAG_META_HIT",{url:e.source_url,title:e.title,author:e.author_name});try{let{supabaseAdmin:t}=await Promise.resolve().then(a.bind(a,8316));await t.from("documents").update({title:n.title,author_name:n.author_name}).eq("source_url",e.source_url)}catch{}}else console.warn("RAG_META_MISS",e.source_url);return e}async function g(e,t){for(let e=0;e<t.length;e++)t[e]=await d(t[e]);console.log("RAG_META_AFTER",t.map(e=>({url:e.source_url,t:!!e.title,a:!!e.author_name})));let a=t.map(e=>({url:e.source_url,snippet:(e.content??"").slice(0,500)})),n=await _(e,a);console.log("RAG_REASONS",{want:a.length,got:n.length,bad:n.filter(e=>!e||"json"===e).length});let r=process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)??"local";return console.log("RAG_FMT",{topk:t.length,hasReasons:!!n?.length,build:r}),t.slice(0,3).map((e,t)=>`[${t+1}] ${n[t]||"このテーマの理解に役立ちそうです。"}
${e.source_url}`).join("\n")}async function _(e,t){let a=t.length,n=`あなたは記事レコメンドの編集者。各候補が質問に「なぜ役立つか」を日本語で１文ずつ作成し、
配列だけをJSONで返す（前後の文章・コードフェンス禁止）。`,r=t.map((e,t)=>`[${t+1}] URL: ${e.url}
抜粋: """${e.snippet.slice(0,400)}"""`).join("\n"),i=`質問: ${e}
候補:
${r}
=> １文\xd7${a}個。JSON配列のみで返す`;try{let r=(await f.chat.completions.create({model:"gpt-4o-mini",temperature:.1,response_format:{type:"json_object"},messages:[{role:"system",content:n},{role:"user",content:i}]})).choices[0].message.content??"[]",l=function(e,t){let a=(e||"").trim();a=(a=a.replace(/```[\s\S]*?```/g,e=>e.replace(/```json|```/g,"")).trim()).replace(/^```json|^```|```$/gm,"").trim();try{let e=JSON.parse(a);if(Array.isArray(e))return e.map(o).slice(0,t);if(Array.isArray(e.reasons))return e.reasons.map(o).slice(0,t)}catch{}let n=a.match(/\[[\s\S]*\]/);if(n)try{let e=JSON.parse(n[0]);if(Array.isArray(e))return e.map(o).slice(0,t)}catch{}return a.split("\n").map(e=>e.replace(/^\s*[-*]\s*/,"").replace(/^\s*\d+[\.\)]\s*/,"").trim()).filter(Boolean).map(o).slice(0,t)}(r,a);if(l.length<a||l.some(e=>!e||"json"===e.toLowerCase())){let a=[];for(let n of t)a.push(await s(e,n));l=a}for(;l.length<a;)l.push("このテーマの理解に役立ちそうです。");return l.slice(0,a)}catch(n){let a=[];for(let n of t)a.push(await s(e,n));return a}}async function h(e,t=3){try{let a=new URL("https://www.okaasan.net/wp-json/wp/v2/posts");a.searchParams.set("search",e),a.searchParams.set("per_page",String(t)),a.searchParams.set("_embed","author");let n=await fetch(a.toString());if(!n.ok)return[];let r=await n.json(),i=e=>(e||"").replace(/<[^>]*>/g,"").trim();return r.map(e=>({url:e.link,snippet:i(e?.excerpt?.rendered||e?.title?.rendered||"")}))}catch{return[]}}let f=new r.default({apiKey:process.env.OPENAI_API_KEY});async function w(e){let{data:t}=await n.supabaseAdmin.from("participants").select("*").eq("line_user_id",e).single();if(!t){let{data:a,error:r}=await n.supabaseAdmin.from("participants").insert({line_user_id:e,archetype:"B"}).select().single();if(r)throw r;t=a}return t}let y=null;async function $(e){let{data:t}=await n.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!1}).limit(8),a=(t??[]).reverse();return{lastUser:[...a].reverse().find(e=>"user"===e.role)?.content??"",thread:a.map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n")}}async function A(e){if(RegExp(`[？?]|(どう|教えて|方法|何|どこ|いつ|おすすめ|使い方|遊び|コツ|困る|悩み|解決|したい|やり方|知りたい|について|なぜ|どうして|できる|できない|ある|ない|あるの|ないの|する|しない|やる|やらない|いい|悪い|良い|悪い|おすすめ|避ける|注意|気をつける|心配|不安|楽しい|面白い|つまらない|大変|簡単|難しい|便利|不便|効果的|無駄|時間|お金|場所|人|物|こと|もの|とき|場合|状況|問題|課題|子育て|育児|子ども|赤ちゃん|幼児|小学生|中学生|高校生|学校|幼稚園|食事|睡眠|遊び|勉強|習い事|運動|健康|病気|怪我|安全|危険|友達|家族|夫|妻|親|祖父母|兄弟|姉妹|ママ|パパ|お母さん|お父さん)`).test(e))return"information_seeking";let t=`
    以下のユーザーメッセージが、「具体的な情報を求める質問」か「自身の感情や出来事についての内省的なつぶやき」かを分類してください。
    
    質問の例（NotebookLMレベルの自由度）：
    - 「雨の日 室内 おうち遊び」（情報探索）
    - 「子どもが言うことを聞かない」（問題解決の質問）
    - 「離乳食 食べない」（具体的な悩み）
    - 「寝かしつけ 時間がかかる」（困りごと）
    - 「イライラ 解消方法」（解決策を求める）
    - 「幼稚園 選び方」（選択肢を求める）
    - 「習い事 何がいい？」（推奨を求める）
    - 「友達 作り方」（方法を求める）
    - 「夜泣き 対処法」（対策を求める）
    - 「子育て 大変」（共感とアドバイスを求める）
    
    つぶやきの例：
    - 「疲れた〜」（感情の吐露）
    - 「今日は大変だった」（出来事の報告）
    - 「なんだか悲しい」（感情の表現）
    - 「うれしい」（感情の表現）
    - 「子どもが可愛い」（感情の表現）
    
    判断基準：
    - 何らかの情報、方法、解決策、アドバイスを求めている → "information_seeking"
    - 単純に感情や出来事を共有している → "personal_reflection"
    
    - 質問の場合は "information_seeking"
    - つぶやきの場合は "personal_reflection"
    とだけ回答してください。

    メッセージ: "${e}"
  `;try{let e=await f.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:t}],temperature:0}),a=e.choices[0].message.content?.trim();if(console.log("Intent detection result:",a),"information_seeking"===a)return"information_seeking"}catch(e){console.error("Intent detection failed:",e)}return"personal_reflection"}async function b(e,t){console.log("Handling information seeking intent...");try{let a=(await f.embeddings.create({model:"text-embedding-3-small",input:t})).data[0].embedding,{data:r,error:o}=await n.supabaseAdmin.rpc("match_documents_arr",{query_embedding:a,match_count:8});if(o)throw Error(`Supabase search error: ${o.message}`);let s=r??[];if(console.log(`[RAG] raw_hits: ${s.length}, topSim: ${s[0]?.similarity||0}`),!s.length){let e=function(e){let t=e;for(let[a,n]of[[/雨の日/g,"雨の日 室内 家の中 おうち遊び 外出できない日 天気悪い"],[/晴れ/g,"晴れ 外遊び 公園 散歩 外出"],[/暑い|寒い/g,"暑い 寒い 温度 気候 季節"],[/イライラ/g,"イライラ ストレス 気持ちの波 モヤモヤ 怒り 不満"],[/疲れ/g,"疲れ 疲労 だるい しんどい 元気ない"],[/不安|心配/g,"不安 心配 悩み 困る どうしよう"],[/楽しい|嬉しい/g,"楽しい 嬉しい うれしい 喜び 幸せ"],[/寝かしつけ|ねかしつけ/g,"寝かしつけ 入眠 寝つき 夜泣き 睡眠 眠り"],[/夜泣き/g,"夜泣き 夜中 泣く 睡眠 不眠"],[/離乳食/g,"離乳食 食べない 食事 偏食 取り分け 食育"],[/食べない/g,"食べない 偏食 食事 食育 栄養"],[/食事/g,"食事 食べ物 料理 栄養 食育"],[/遊び/g,"遊び おもちゃ ゲーム 活動 楽しみ"],[/勉強/g,"勉強 学習 宿題 教育 習い事"],[/習い事/g,"習い事 教室 レッスン スキル"],[/子育て/g,"子育て 育児 親 ママ パパ 教育"],[/子ども|子供/g,"子ども 子供 幼児 赤ちゃん 小学生"],[/幼稚園/g,"幼稚園 保育園 園 入園 園生活"],[/学校/g,"学校 小学校 中学校 高校 教育"],[/病気/g,"病気 体調 健康 医療 病院"],[/怪我/g,"怪我 けが 事故 安全 危険"],[/安全/g,"安全 危険 注意 気をつける 予防"],[/友達/g,"友達 友だち 人間関係 仲良し コミュニケーション"],[/家族/g,"家族 夫 妻 親 祖父母 兄弟"]])a.test(e)&&(t+=" "+n);return t}(t);if(e!==t){let t=await f.embeddings.create({model:"text-embedding-3-small",input:e}),{data:a}=await n.supabaseAdmin.rpc("match_documents_arr",{query_embedding:t.data[0].embedding,match_count:8});s=a??[]}}let l=s.filter(e=>(e.similarity??0)>=.15),c=(l.length?l:s).slice(0,3);if(console.log(`[RAG] after_filter: ${l.length}, picked: ${c.length}`),console.log("RAG_META_BEFORE",c.map(e=>({url:e.source_url,t:!!e.title,a:!!e.author_name}))),0===c.length){let a=await h(t,3);if(a.length){let e=a.map(e=>({source_url:e.url,content:e.snippet||""})),n=await g(t,e);return`手元のベクトル検索では直接ヒットがなかったけど、近いテーマの記事を見つけたよ。

— 参考記事 —
${n}`}let r=new Date(Date.now()+6e5).toISOString();return await n.supabaseAdmin.from("pending_intents").insert({participant_id:e.id,kind:"web_search",payload:{query:t},expires_at:r}),"手元の知識では見つからなかったよ。\nよかったらネットでも調べようか？（はい / いいえ）"}let m=c.map(e=>e.content).join("\n---\n");Array.from(new Set(c.map(e=>e.source_url)));let{lastUser:u,thread:p}=await $(e.id),d=`
${i}

[最近の会話ログ]
${p}

[ルール]
1) 冒頭に1〜2文だけ共感を添える（過度な深掘りはしない）。
2) 次に、提供されたコンテキストの範囲で質問に答える。
3) 断定は避け、「〜かも」「〜という考え方も」で柔らかく。
4) 箇条書きOK。最後に一言だけ励ます。
5) コンテキスト外は無理に答えない。
6) 出力はプレーンテキスト。Markdown装飾は使わない。
7) 箇条書きは日本語の点を使う。
`.trim(),_=(await f.chat.completions.create({model:"gpt-4o-mini",temperature:.5,messages:[{role:"system",content:d},{role:"user",content:`コンテキスト:
${m}

質問: ${t}

直前ユーザー発話: ${u}`}]})).choices[0].message.content||"すみません、うまくお答えできませんでした。",w=await g(t,c);return`${_}

— 参考記事 —
${w}`}catch(e){return console.error("RAG process failed:",e),"申し訳ありません、情報の検索中にエラーが発生しました。もう一度お試しください。"}}async function k(e,t){let r;let o=await w(e);await n.supabaseAdmin.from("chat_logs").insert({participant_id:o.id,role:"user",content:t});let{data:s}=await n.supabaseAdmin.from("pending_intents").select("*").eq("participant_id",o.id).eq("kind","web_search").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:!1}).limit(1),l=/^(はい|うん|ok|お願いします|お願い|調べて|いいよ)/i.test(t.trim()),c=/^(いいえ|いらない|大丈夫|結構)/i.test(t.trim());if(s&&s.length){if(l){await n.supabaseAdmin.from("pending_intents").delete().eq("id",s[0].id);let e=new URL("http://localhost:3000");e.pathname="/api/search/google",e.searchParams.set("q",s[0].payload?.query||t);let r=await fetch(e.toString()),{items:i}=await r.json();if(!i?.length)return"検索してみたけれど、めぼしい情報は見つからなかったよ。";let o=i.slice(0,3).map((e,t)=>`[${t+1}] ${e.title}
${e.snippet}
${e.link}`).join("\n\n"),l=new(await Promise.resolve().then(a.bind(a,4214))).default({apiKey:process.env.OPENAI_API_KEY});return(await l.chat.completions.create({model:"gpt-4o-mini",temperature:.2,messages:[{role:"system",content:"あなたはリサーチアシスタント。上の候補を3行で要約し、最後に「次の一歩」を1文添える。装飾不可。"},{role:"user",content:o}]})).choices[0].message.content||o}if(c)return await n.supabaseAdmin.from("pending_intents").delete().eq("id",s[0].id),"了解。また必要になったら声かけてね。"}let m=await A(t),u=/[？\?]/.test(t)?"information_seeking":"personal_reflection"===y&&t.length<25?"personal_reflection":m;if(y=u,console.log(`[Intent] User message: "${t}" -> Raw: ${m} -> Final: ${u}`),"information_seeking"===u)r=await b(o,t);else{console.log("Handling personal reflection intent...");let{data:e}=await n.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",o.id).order("created_at",{ascending:!1}).limit(9),a=(e||[]).reverse().map(e=>({role:"ai"===e.role?"assistant":"user",content:e.content}));a.push({role:"user",content:t});let s=o.profile_summary?`
[ユーザープロフィール要約]
${o.profile_summary}
`:"",l=`
${i}${s}

[ルール]
- 相づち→ねぎらい→一息つける提案を1つだけ。
- 連続質問はしない。問いは最大1つ。
- ユーザーの表現を少し言い換えて返す（ミラーリング）。
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
`.trim();r=(await f.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:l},...a]})).choices[0].message.content||"うんうん、そうなんだね。"}return await n.supabaseAdmin.from("chat_logs").insert({participant_id:o.id,role:"assistant",content:r}),S(o.id).catch(console.error),r=(r??"").replace(/```[\s\S]*?```/g,"").replace(/\*\*(.+?)\*\*/g,"$1").replace(/__(.+?)__/g,"$1").replace(/_([^_]+)_/g,"$1").replace(/^\s*[-*]\s+/gm,"・").replace(/\(β [0-9a-f]{7}\)/ig,"").replace(/[ \t]+\n/g,"\n").trim()}async function S(e){let{data:t}=await n.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!0}).limit(50),a=(t??[]).map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n"),r=`
以下の会話ログから、ユーザーに関する「継続的に役立つ情報」（子どもの年齢感/好み/配慮点/口調の好み/通知の希望など）を
事実ベースで200字以内に日本語で箇条書き要約してください。推測や機微な情報は書かないでください。
---
${a}
  `.trim();try{let t=await f.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:r}],temperature:0}),a=t.choices[0].message.content?.trim()??null;a&&(await n.supabaseAdmin.from("participants").update({profile_summary:a}).eq("id",e),console.log(`[Profile] Updated summary for participant ${e}`))}catch(e){console.error("updateProfileSummary failed",e)}}},8316:(e,t,a)=>{a.d(t,{supabaseAdmin:()=>n});let n=(0,a(9498).eI)("https://mkikyycrgfudodhkukng.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:!1}})}};