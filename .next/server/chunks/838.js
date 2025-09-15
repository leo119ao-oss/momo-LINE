"use strict";exports.id=838,exports.ids=[838],exports.modules={838:(e,t,n)=>{n.d(t,{U0:()=>p,zb:()=>A});var a=n(8316),r=n(4214);let o=`
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる（〜だね/〜かもね）。
- 断定や評価は避け、「〜かも」「〜してみる？」の提案。
- 長文にしすぎない。段落を分けて読みやすく。
`.trim();function i(e){return e?e.replace(/<[^>]*>/g,"").replace(/\s*\|\s*.*$/,"").trim():""}async function s(e){let t=`https://www.okaasan.net/wp-json/oembed/1.0/embed?url=${encodeURIComponent(e)}`,n=await fetch(t,{cache:"no-store"});if(!n.ok)return null;let a=await n.json(),r=i(a?.title),o=a?.author_name||"お母さん大学";return r?{title:r,author_name:o}:null}async function l(e){let t="https://www.okaasan.net/wp-json/wp/v2/posts",n=function(e){try{let t=new URL(e).pathname.split("/").filter(Boolean);return t.length?decodeURIComponent(t.at(-1)):null}catch{return null}}(e);if(n){let e=await fetch(`${t}?slug=${encodeURIComponent(n)}&_embed=author&per_page=1`);if(e.ok){let t=await e.json(),n=t?.[0];if(n)return{title:i(n?.title?.rendered),author_name:n?._embedded?.author?.[0]?.name||"お母さん大学"}}}let a=await fetch(`${t}?search=${encodeURIComponent(e)}&_embed=author&per_page=1`);if(a.ok){let e=await a.json(),t=e?.[0];if(t)return{title:i(t?.title?.rendered),author_name:t?._embedded?.author?.[0]?.name||"お母さん大学"}}return null}async function c(e){try{let t=(await (await fetch(e,{cache:"no-store"})).text()).match(/<title>(.*?)<\/title>/i);if(t?.[1])return{title:i(t[1]),author_name:"お母さん大学"}}catch{}return null}let u=new Map;async function m(e){if(e.title&&e.author_name)return e;let t=u.get(e.source_url);if(t)return e.title=e.title??t.title,e.author_name=e.author_name??t.author_name,e;let a=await s(e.source_url);if(a||(a=await l(e.source_url)),a||(a=await c(e.source_url)),a){u.set(e.source_url,a),e.title=e.title??a.title,e.author_name=e.author_name??a.author_name,console.log("RAG_META_HIT",{url:e.source_url,title:e.title,author:e.author_name});try{let{supabaseAdmin:t}=await Promise.resolve().then(n.bind(n,8316));await t.from("documents").update({title:a.title,author_name:a.author_name}).eq("source_url",e.source_url)}catch{}}else console.warn("RAG_META_MISS",e.source_url);return e}async function p(e,t){for(let e=0;e<t.length;e++)t[e]=await m(t[e]);console.log("RAG_META_AFTER",t.map(e=>({url:e.source_url,t:!!e.title,a:!!e.author_name})));let n=t.map(e=>({url:e.source_url,snippet:(e.content??"").slice(0,500)})),a=await d(e,n),r=process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)??"local";console.log("RAG_FMT",{topk:t.length,hasReasons:!!a?.length,build:r});let o=t.slice(0,3).map((e,t)=>`[${t+1}] ${a[t]||"このテーマの理解に役立ちそうです。"}
${e.source_url}`).join("\n");return`${o}

(β ${r})`}async function d(e,t){let n=`
あなたは記事レコメンドの編集者です。各候補が「ユーザーの質問に対してなぜ有用か」を日本語で１文ずつ書きます。
- 断定調は避け、「〜に役立ちそう」「〜のヒントがある」とやわらかく。
- 具体語を1つ入れる（例: 年齢帯/具体アクティビティ/場面など）。
- 出力は JSON 配列（文字列3要素のみ）。`.trim(),a=t.map((e,t)=>`[${t+1}] URL: ${e.url}
抜粋: """${e.snippet.substring(0,400)}"""`).join("\n"),r=`質問: ${e}
候補:
${a}

上記に対応する３つの理由を JSON 配列で返してください。`;try{let e=(await _.chat.completions.create({model:"gpt-4o-mini",temperature:.2,messages:[{role:"system",content:n},{role:"user",content:r}]})).choices[0].message.content??"[]";try{let n=JSON.parse(e);if(Array.isArray(n)&&n.length)return n.map(String).slice(0,t.length)}catch{return e.split("\n").map(e=>e.replace(/^\s*[\[\(]?\d+[\]\).]\s*/,"").trim()).filter(Boolean).slice(0,t.length)}}catch(e){console.warn("REASON_GEN_FAIL",e)}return t.map(()=>"このテーマに関する実践的なヒントがまとまっています。")}async function g(e,t=3){try{let n=new URL("https://www.okaasan.net/wp-json/wp/v2/posts");n.searchParams.set("search",e),n.searchParams.set("per_page",String(t)),n.searchParams.set("_embed","author");let a=await fetch(n.toString());if(!a.ok)return[];let r=await a.json(),o=e=>(e||"").replace(/<[^>]*>/g,"").trim();return r.map(e=>({url:e.link,snippet:o(e?.excerpt?.rendered||e?.title?.rendered||"")}))}catch{return[]}}let _=new r.ZP({apiKey:process.env.OPENAI_API_KEY});async function h(e){let{data:t}=await a.supabaseAdmin.from("participants").select("*").eq("line_user_id",e).single();if(!t){let{data:n,error:r}=await a.supabaseAdmin.from("participants").insert({line_user_id:e,archetype:"B"}).select().single();if(r)throw r;t=n}return t}let f=null;async function w(e){let{data:t}=await a.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!1}).limit(8),n=(t??[]).reverse();return{lastUser:[...n].reverse().find(e=>"user"===e.role)?.content??"",thread:n.map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n")}}async function $(e){if(RegExp(`[？?]|(どう|教えて|方法|何|どこ|いつ|おすすめ|使い方|遊び|コツ|困る|悩み|解決|したい|やり方|知りたい|について|なぜ|どうして|できる|できない|ある|ない|あるの|ないの|する|しない|やる|やらない|いい|悪い|良い|悪い|おすすめ|避ける|注意|気をつける|心配|不安|楽しい|面白い|つまらない|大変|簡単|難しい|便利|不便|効果的|無駄|時間|お金|場所|人|物|こと|もの|とき|場合|状況|問題|課題|子育て|育児|子ども|赤ちゃん|幼児|小学生|中学生|高校生|学校|幼稚園|食事|睡眠|遊び|勉強|習い事|運動|健康|病気|怪我|安全|危険|友達|家族|夫|妻|親|祖父母|兄弟|姉妹|ママ|パパ|お母さん|お父さん)`).test(e))return"information_seeking";let t=`
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
  `;try{let e=await _.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:t}],temperature:0}),n=e.choices[0].message.content?.trim();if(console.log("Intent detection result:",n),"information_seeking"===n)return"information_seeking"}catch(e){console.error("Intent detection failed:",e)}return"personal_reflection"}async function y(e,t){console.log("Handling information seeking intent...");try{let n=(await _.embeddings.create({model:"text-embedding-3-small",input:t})).data[0].embedding,{data:r,error:i}=await a.supabaseAdmin.rpc("match_documents_arr",{query_embedding:n,match_count:8});if(i)throw Error(`Supabase search error: ${i.message}`);let s=r??[];if(console.log(`[RAG] raw_hits: ${s.length}, topSim: ${s[0]?.similarity||0}`),!s.length){let e=function(e){let t=e;for(let[n,a]of[[/雨の日/g,"雨の日 室内 家の中 おうち遊び 外出できない日 天気悪い"],[/晴れ/g,"晴れ 外遊び 公園 散歩 外出"],[/暑い|寒い/g,"暑い 寒い 温度 気候 季節"],[/イライラ/g,"イライラ ストレス 気持ちの波 モヤモヤ 怒り 不満"],[/疲れ/g,"疲れ 疲労 だるい しんどい 元気ない"],[/不安|心配/g,"不安 心配 悩み 困る どうしよう"],[/楽しい|嬉しい/g,"楽しい 嬉しい うれしい 喜び 幸せ"],[/寝かしつけ|ねかしつけ/g,"寝かしつけ 入眠 寝つき 夜泣き 睡眠 眠り"],[/夜泣き/g,"夜泣き 夜中 泣く 睡眠 不眠"],[/離乳食/g,"離乳食 食べない 食事 偏食 取り分け 食育"],[/食べない/g,"食べない 偏食 食事 食育 栄養"],[/食事/g,"食事 食べ物 料理 栄養 食育"],[/遊び/g,"遊び おもちゃ ゲーム 活動 楽しみ"],[/勉強/g,"勉強 学習 宿題 教育 習い事"],[/習い事/g,"習い事 教室 レッスン スキル"],[/子育て/g,"子育て 育児 親 ママ パパ 教育"],[/子ども|子供/g,"子ども 子供 幼児 赤ちゃん 小学生"],[/幼稚園/g,"幼稚園 保育園 園 入園 園生活"],[/学校/g,"学校 小学校 中学校 高校 教育"],[/病気/g,"病気 体調 健康 医療 病院"],[/怪我/g,"怪我 けが 事故 安全 危険"],[/安全/g,"安全 危険 注意 気をつける 予防"],[/友達/g,"友達 友だち 人間関係 仲良し コミュニケーション"],[/家族/g,"家族 夫 妻 親 祖父母 兄弟"]])n.test(e)&&(t+=" "+a);return t}(t);if(e!==t){let t=await _.embeddings.create({model:"text-embedding-3-small",input:e}),{data:n}=await a.supabaseAdmin.rpc("match_documents_arr",{query_embedding:t.data[0].embedding,match_count:8});s=n??[]}}let l=s.filter(e=>(e.similarity??0)>=.15),c=(l.length?l:s).slice(0,3);if(console.log(`[RAG] after_filter: ${l.length}, picked: ${c.length}`),console.log("RAG_META_BEFORE",c.map(e=>({url:e.source_url,t:!!e.title,a:!!e.author_name}))),0===c.length){let e=await g(t,3);if(e.length){let n=e.map(e=>({source_url:e.url,content:e.snippet||""})),a=await p(t,n);return`手元のベクトル検索では直接ヒットがなかったけど、近いテーマの記事を見つけたよ。

— 参考記事 —
${a}`}return"ごめん、いま手元のデータからは関連が拾えなかった… もう少し違う聞き方も試してみて？"}let u=c.map(e=>e.content).join("\n---\n");Array.from(new Set(c.map(e=>e.source_url)));let{lastUser:m,thread:d}=await w(e.id),h=`
${o}

[最近の会話ログ]
${d}

[ルール]
1) 冒頭に1〜2文だけ共感を添える（過度な深掘りはしない）。
2) 次に、提供されたコンテキストの範囲で質問に答える。
3) 断定は避け、「〜かも」「〜という考え方も」で柔らかく。
4) 箇条書きOK。最後に一言だけ励ます。
5) コンテキスト外は無理に答えない。
`.trim(),f=(await _.chat.completions.create({model:"gpt-4o-mini",temperature:.5,messages:[{role:"system",content:h},{role:"user",content:`コンテキスト:
${u}

質問: ${t}

直前ユーザー発話: ${m}`}]})).choices[0].message.content||"すみません、うまくお答えできませんでした。",$=await p(t,c);return`${f}

— 参考記事 —
${$}`}catch(e){return console.error("RAG process failed:",e),"申し訳ありません、情報の検索中にエラーが発生しました。もう一度お試しください。"}}async function A(e,t){let n;let r=await h(e);await a.supabaseAdmin.from("chat_logs").insert({participant_id:r.id,role:"user",content:t});let i=await $(t),s=/[？\?]/.test(t)?"information_seeking":"personal_reflection"===f&&t.length<25?"personal_reflection":i;if(f=s,console.log(`[Intent] User message: "${t}" -> Raw: ${i} -> Final: ${s}`),"information_seeking"===s)n=await y(r,t);else{console.log("Handling personal reflection intent...");let{data:e}=await a.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",r.id).order("created_at",{ascending:!1}).limit(9),i=(e||[]).reverse().map(e=>({role:"ai"===e.role?"assistant":"user",content:e.content}));i.push({role:"user",content:t});let s=r.profile_summary?`
[ユーザープロフィール要約]
${r.profile_summary}
`:"",l=`
${o}${s}

[ルール]
- 相づち→ねぎらい→一息つける提案を1つだけ。
- 連続質問はしない。問いは最大1つ。
- ユーザーの表現を少し言い換えて返す（ミラーリング）。
`.trim();n=(await _.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:l},...i]})).choices[0].message.content||"うんうん、そうなんだね。"}return await a.supabaseAdmin.from("chat_logs").insert({participant_id:r.id,role:"assistant",content:n}),b(r.id).catch(console.error),n}async function b(e){let{data:t}=await a.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!0}).limit(50),n=(t??[]).map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n"),r=`
以下の会話ログから、ユーザーに関する「継続的に役立つ情報」（子どもの年齢感/好み/配慮点/口調の好み/通知の希望など）を
事実ベースで200字以内に日本語で箇条書き要約してください。推測や機微な情報は書かないでください。
---
${n}
  `.trim();try{let t=await _.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:r}],temperature:0}),n=t.choices[0].message.content?.trim()??null;n&&(await a.supabaseAdmin.from("participants").update({profile_summary:n}).eq("id",e),console.log(`[Profile] Updated summary for participant ${e}`))}catch(e){console.error("updateProfileSummary failed",e)}}},8316:(e,t,n)=>{n.d(t,{supabaseAdmin:()=>o});var a=n(9498);let r=process.env.SUPABASE_SERVICE_ROLE_KEY,o=(0,a.eI)("https://mkikyycrgfudodhkukng.supabase.co",r,{auth:{persistSession:!1}})}};