"use strict";exports.id=722,exports.ids=[722],exports.modules={4722:(e,t,n)=>{n.d(t,{U0:()=>y,zb:()=>P});var a=n(8316),r=n(4214);function i(e,t=6){let n=(e||"").toLowerCase().replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\uF900-\uFAFF\u2F800-\u2FA1Fa-zA-Z0-9\s]/g," ").replace(/\s+/g," "),a=new Set(["の","が","に","を","と","は","へ","で","も","から","まで","より","や","な","だ","です","ます"]),r=n.split(" ").filter(e=>e&&!a.has(e)),i=new Map;for(let e of r)i.set(e,(i.get(e)??0)+1);return Array.from(i.entries()).sort((e,t)=>t[1]-e[1]).slice(0,t).map(([e])=>e)}async function o(e){try{let t=await fetch(e,{cache:"no-store"}),n=await t.text(),a=/<meta property="og:title" content="([^"]+)"/i.exec(n)?.[1]||/<title>([^<]+)<\/title>/i.exec(n)?.[1],r=/<meta name="author" content="([^"]+)"/i.exec(n)?.[1]??null;return{title:a??null,author:r}}catch{return{}}}function s(e,t,n){console.log(`[RAG_META] url=${e} title=${t} author=${n}`)}let l=new r.default({apiKey:process.env.OPENAI_API_KEY});async function c(e,t){let n=(await l.embeddings.create({model:"text-embedding-3-small",input:e})).data[0].embedding,{data:r,error:o}=await a.supabaseAdmin.rpc("match_documents_arr",{query_embedding:n,match_count:t.topK});if(o)throw Error(`Supabase search error: ${o.message}`);return(r??[]).map(e=>({id:e.id||"",url:e.source_url||"",title:e.title||null,author:e.author_name||null,chunk:e.content||"",score:e.similarity||0,keywords:i(e.content||"")}))}async function u(e){return await Promise.all(e.map(async e=>{if(e.title&&e.author)return e;try{let t=await o(e.url);return s(e.url,!!t.title,!!t.author),{...e,title:e.title||t.title,author:e.author||t.author}}catch(t){return s(e.url,!1,!1),e}}))}async function m(e){let t=i(e),n=(function(e,t){let n=new Set(t);return e.filter(e=>(e.keywords??i(e.chunk)).some(e=>n.has(e)))})((await c(e,{topK:12})).filter(e=>e.score>=.45),t).slice(0,3);return await u(n)}let p=e=>(e||"").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"-").slice(0,80)+"-"+Date.now().toString(36),d=`
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる(〜だね/〜かもね).
- 断定や評価は避け、「〜かも」「〜してみる？」の提案.
- 長文にしすぎない。段落を分けて読みやすく.
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
`.trim();function g(e){return e?e.replace(/<[^>]*>/g,"").replace(/\s*\|\s*.*$/,"").trim():""}async function h(e){let t=`https://www.okaasan.net/wp-json/oembed/1.0/embed?url=${encodeURIComponent(e)}`,n=await fetch(t,{cache:"no-store"});if(!n.ok)return null;let a=await n.json(),r=g(a?.title),i=a?.author_name||"お母さん大学";return r?{title:r,author_name:i}:null}async function f(e){let t="https://www.okaasan.net/wp-json/wp/v2/posts",n=function(e){try{let t=new URL(e).pathname.split("/").filter(Boolean);return t.length?decodeURIComponent(t.at(-1)):null}catch{return null}}(e);if(n){let e=await fetch(`${t}?slug=${encodeURIComponent(n)}&_embed=author&per_page=1`);if(e.ok){let t=await e.json(),n=t?.[0];if(n)return{title:g(n?.title?.rendered),author_name:n?._embedded?.author?.[0]?.name||"お母さん大学"}}}let a=await fetch(`${t}?search=${encodeURIComponent(e)}&_embed=author&per_page=1`);if(a.ok){let e=await a.json(),t=e?.[0];if(t)return{title:g(t?.title?.rendered),author_name:t?._embedded?.author?.[0]?.name||"お母さん大学"}}return null}async function _(e){try{let t=(await (await fetch(e,{cache:"no-store"})).text()).match(/<title>(.*?)<\/title>/i);if(t?.[1])return{title:g(t[1]),author_name:"お母さん大学"}}catch{}return null}let w=new Map;async function $(e){if(e.title&&e.author_name)return e;let t=w.get(e.source_url);if(t)return e.title=e.title??t.title,e.author_name=e.author_name??t.author_name,e;let a=await h(e.source_url);if(a||(a=await f(e.source_url)),a||(a=await _(e.source_url)),a){w.set(e.source_url,a),e.title=e.title??a.title,e.author_name=e.author_name??a.author_name,console.log("RAG_META_HIT",{url:e.source_url,title:e.title,author:e.author_name});try{let{supabaseAdmin:t}=await Promise.resolve().then(n.bind(n,8316));await t.from("documents").update({title:a.title,author_name:a.author_name}).eq("source_url",e.source_url)}catch{}}else console.warn("RAG_META_MISS",e.source_url);return e}async function y(e,t){for(let e=0;e<t.length;e++)t[e]=await $(t[e]);return console.log("RAG_META_AFTER",t.map(e=>({url:e.source_url,t:!!e.title,a:!!e.author_name}))),""}let A=new r.default({apiKey:process.env.OPENAI_API_KEY});async function b(e){let{data:t}=await a.supabaseAdmin.from("participants").select("*").eq("line_user_id",e).single();if(!t){let{data:n,error:r}=await a.supabaseAdmin.from("participants").insert({line_user_id:e,archetype:"B"}).select().single();if(r)throw r;t=n}return t}let I=null;async function k(e){let t;let{data:n}=await a.supabaseAdmin.from("chat_logs").select("role, content, created_at").eq("participant_id",e).order("created_at",{ascending:!1}).limit(20),r=(n??[]).reverse(),i=[...r].reverse().find(e=>"user"===e.role)?.content??"",o=function(e){let t=e.filter(e=>"user"===e.role).slice(-3),n=e.filter(e=>"assistant"===e.role).slice(-3),a=t.map(e=>(function(e){for(let t of["子育て","育児","子ども","赤ちゃん","幼児","食事","睡眠","遊び","勉強","習い事","疲れ","イライラ","不安","心配","楽しい","友達","家族","夫","妻","親","病気","怪我","安全","健康"])if(e.includes(t))return t;return null})(e.content)).filter(Boolean),r=a[a.length-1],i=t.length>=2&&t.some(e=>e.content.length>20),o={hasUnclearResponses:t.some(e=>/^(はそう|そう|うん|はい|いいえ|わからない|知らない|何|なに|どう|なぜ|どうして|あの|えー|うーん|んー|そうですね|それ|これ|あれ|どれ)$/i.test(e.content.trim())),averageMessageLength:t.reduce((e,t)=>e+t.content.length,0)/t.length,lastMessageLength:t[t.length-1]?.content.length||0,conversationDepth:t.length,hasQuestions:t.some(e=>/[？\?]/.test(e.content)),hasEmotionalWords:t.some(e=>/(疲れ|イライラ|不安|心配|楽しい|嬉しい|悲しい|困る|悩み)/.test(e.content))};return{themes:a,lastTheme:r,isDeepConversation:i,messageCount:t.length,lastUserMessage:t[t.length-1]?.content||"",lastAiMessage:n[n.length-1]?.content||"",conversationContext:o}}(r);if(r.length>10){let e=r.slice(-5),n=r.slice(0,-5);t=(n.length>0?`[過去の会話要約: ${n.length}件のやり取りがありました]`:"")+"\n"+e.map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n")}else t=r.map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n");return{lastUser:i,thread:t,conversationFlow:o}}async function v(e,t){if(![/^(はそう|そう|うん|はい|いいえ|わからない|知らない)$/i,/^(何|なに|どう|なぜ|どうして)$/i,/^(あの|えー|うーん|んー|そうですね)$/i,/^.{1,3}$/,/^(それ|これ|あれ|どれ)$/i].some(t=>t.test(e.trim())))return null;let a=t.isDeepConversation?`前回のテーマ: ${t.lastTheme||"新しい話題"}
前回のAI応答: ${t.lastAiMessage}`:"新しい会話の開始",r=`
以下の状況で、ユーザーが不明確な返答をした場合の適切な聞き返しを考えてください。

【会話の文脈】
${a}

【ユーザーの返答】
"${e}"

【聞き返しのルール】
1) 推察を交えつつ、具体的に何について聞きたいかを明確にする
2) 選択肢を提示するか、具体的な質問をする
3) 優しく、プレッシャーを感じさせない
4) 会話の流れを自然に保つ
5) 1-2文で簡潔に

【例】
- 「はそう」→「そうなんだね。具体的には、どんなことが気になってる？」
- 「わからない」→「大丈夫だよ。何について話したいか、少し教えてもらえる？」
- 「それ」→「○○のことかな？もう少し詳しく教えてもらえる？」

適切な聞き返しの文を1つだけ返してください。聞き返しが不要な場合は「null」と返してください。
  `.trim();try{let e=new(await Promise.resolve().then(n.bind(n,4214))).default({apiKey:process.env.OPENAI_API_KEY}),t=await e.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:r}],temperature:.3}),a=t.choices?.[0]?.message?.content,i="string"==typeof a?a.trim():null;if(!i||"null"===i.toLowerCase())return null;return i}catch(e){return console.error("Clarification check failed:",e),null}}async function E(e){return["今まで","何の話","話してた","会話","前回","さっき","先ほど","話した","言った"].some(t=>e.includes(t))?"personal_reflection":RegExp(`[？?]|(教えて|方法|やり方|知りたい|おすすめ|コツ|解決|対処法|選び方|どうすれば|どうしたら|何を|どこで|いつ|なぜ|どうして|調べて|検索して)`).test(e)?await C(e):"personal_reflection"}async function C(e){let t=`
    以下のユーザーメッセージが、「明示的な情報・解決策を求めている」か「感情や状況の共有」かを判定してください。
    
    【情報探索の例】
    - 「雨の日の室内遊びを教えて」
    - 「子どもが言うことを聞かない時の対処法は？」
    - 「離乳食を食べない場合の解決方法を知りたい」
    - 「寝かしつけのコツを教えて」
    - 「イライラの解消方法は？」
    - 「幼稚園の選び方について知りたい」
    - 「習い事で何がおすすめ？」
    - 「友達の作り方を教えて」
    - 「夜泣きの対処法は？」
    
    【感情・状況共有の例】
    - 「雨の日は子どもと家にいるのが大変」
    - 「子どもが言うことを聞かなくて困ってる」
    - 「離乳食を食べてくれない」
    - 「寝かしつけに時間がかかる」
    - 「イライラしてしまう」
    - 「幼稚園選びで迷ってる」
    - 「習い事を考えてる」
    - 「友達ができなくて心配」
    - 「夜泣きがひどい」
    
    判断基準：
    - 明示的に「教えて」「方法」「対処法」「コツ」などを求めている → "information_seeking"
    - 感情や状況を共有している（解決策は求めていない） → "personal_reflection"
    
    メッセージ: "${e}"
    
    "information_seeking" または "personal_reflection" のどちらかで回答してください。
  `;try{let e=await A.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:t}],temperature:0}),n=e.choices?.[0]?.message?.content,a="string"==typeof n?n.trim():null;if(console.log("Context-aware intent detection result:",a),"information_seeking"===a)return"information_seeking"}catch(e){console.error("Context-aware intent detection failed:",e)}return"personal_reflection"}async function F(e,t){console.log("Handling information seeking intent...");try{let n=await m(t);if(0===n.length)return function(e,t){let n=t.map((e,t)=>`${e}`).join(" / ");return`関連度の高い情報が十分に見つかりませんでした。次のどれに近いですか？ ${n}
自由入力もOKです。`}(0,["A) もう少しレシピの基本が知りたい","B) 今日作れる代替案を提案してほしい"]);let{lastUser:a,thread:r,conversationFlow:i}=await k(e.id),o=await v(t,i);if(o)return o;i.isDeepConversation&&(i.lastTheme,i.messageCount);let s=n.map(e=>e.chunk).join("\n---\n"),l=function(e,t){let n=t.map(e=>`- ${e.title??"関連記事"}：${e.url}`).join("\n");return`あなたは簡潔な情報ナビ。以下の形式で回答。
# 結論
一行で要点。

# 箇条書き
- 3〜5項目で具体策や注意点。

# 参考
${n}

回答は短く、断定せず推定表現を用いる。`}(0,n.map(e=>({title:e.title,url:e.url}))),c=(await A.chat.completions.create({model:"gpt-4o-mini",temperature:.5,messages:[{role:"system",content:l},{role:"user",content:`コンテキスト:
${s}

質問: ${t}

直前ユーザー発話: ${a}`}]})).choices[0].message.content||"すみません、うまくお答えできませんでした。",u=n.map((e,n)=>`[${n+1}] ${function(e,t){let n=t.title||new URL(t.url).pathname.split("/").pop()||"関連記事";return`「${n}」はあなたの関心「${e}」に直接関連する要点を含みます。`}(t,e)}
${e.url}`).join("\n");return`${c}

— 参考記事 —
${u}`}catch(e){return console.error("RAG process failed:",e),"申し訳ありません、情報の検索中にエラーが発生しました。もう一度お試しください。"}}async function P(e,t){let r;console.log("[APP]","rev=",process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)??"devlocal");let i=await b(e);await a.supabaseAdmin.from("chat_logs").insert({participant_id:i.id,role:"user",content:t});let{data:o}=await a.supabaseAdmin.from("media_entries").select("*").eq("participant_id",i.id).eq("status","awaiting").order("created_at",{ascending:!1}).limit(1);if(o&&o.length){let e=o[0];if(1===e.ask_stage){let r=(()=>{try{return JSON.parse(e.suggested_caption||"[]")}catch{return[]}})(),i=t.trim(),o=t.trim().match(/^[１２３1-3]$/);if(o){let e=Number(o[0].replace("１","1").replace("２","2").replace("３","3"))-1;r[e]&&(i=r[e])}else{let e=new(await Promise.resolve().then(n.bind(n,4214))).default({apiKey:process.env.OPENAI_API_KEY}),a=await e.chat.completions.create({model:"gpt-4o-mini",temperature:.4,messages:[{role:"system",content:"入力文を日記のキャプションらしく20\xb16字で自然に整える。絵文字・記号・引用符なし。"},{role:"user",content:t}]});i=a.choices[0].message.content?.trim()||t}return await a.supabaseAdmin.from("media_entries").update({caption:i,ask_stage:2}).eq("id",e.id),`いいね。「${i}」でどうかな？
もう少しだけ教えて：その瞬間、どんな気持ちだった？一言メモにするよ。`}if(2===e.ask_stage){let n=e.page_slug||p(e.caption||"diary");await a.supabaseAdmin.from("media_entries").update({extra_note:t.trim(),page_slug:n,status:"done",ask_stage:3}).eq("id",e.id);let r=`${"http://localhost:3000".replace(/\/$/,"")||0}/diary/${n}`;return`できたよ。
「${e.caption||""}${e.caption?"／":""}${t.trim()}」
絵日記ページ：
${r}
（必要ならあとで文言を送ってくれれば更新もできるよ）`}}let{data:s}=await a.supabaseAdmin.from("pending_intents").select("*").eq("participant_id",i.id).eq("kind","web_search").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:!1}).limit(1),l=/^(はい|うん|ok|お願いします|お願い|調べて|いいよ)/i.test(t.trim()),c=/^(いいえ|いらない|大丈夫|結構)/i.test(t.trim());if(s&&s.length){if(l){await a.supabaseAdmin.from("pending_intents").delete().eq("id",s[0].id);let e=new URL("http://localhost:3000");e.pathname="/api/search/google",e.searchParams.set("q",s[0].payload?.query||t);let r=await fetch(e.toString()),{items:i}=await r.json();if(!i?.length)return"検索してみたけれど、めぼしい情報は見つからなかったよ。";let o=i.slice(0,3).map((e,t)=>`[${t+1}] ${e.title}
${e.snippet}
${e.link}`).join("\n\n"),l=new(await Promise.resolve().then(n.bind(n,4214))).default({apiKey:process.env.OPENAI_API_KEY});return(await l.chat.completions.create({model:"gpt-4o-mini",temperature:.2,messages:[{role:"system",content:"あなたはリサーチアシスタント。上の候補を3行で要約し、最後に「次の一歩」を1文添える。装飾不可。"},{role:"user",content:o}]})).choices[0].message.content||o}if(c)return await a.supabaseAdmin.from("pending_intents").delete().eq("id",s[0].id),"了解。また必要になったら声かけてね。"}let u=await E(t),m=/[？\?]/.test(t)?"information_seeking":"personal_reflection"===I&&t.length<25?"personal_reflection":u;if(I=m,console.log(`[Intent] User message: "${t}" -> Raw: ${u} -> Final: ${m}`),console.log(`[Debug] Intent detection - Text: "${t}", Raw: ${u}, Final: ${m}`),"information_seeking"===m)r=await F(i,t);else{console.log("Handling personal reflection intent...");let{data:e}=await a.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",i.id).order("created_at",{ascending:!1}).limit(12),n=(e||[]).reverse().map(e=>({role:"ai"===e.role?"assistant":"user",content:e.content}));n.push({role:"user",content:t});let{conversationFlow:o}=await k(i.id),s=await v(t,o);if(s)return s;let l=i.profile_summary?`
[ユーザープロフィール要約]
${i.profile_summary}
`:"",c=o.isDeepConversation?`
[会話の流れ]
前回のテーマ: ${o.lastTheme||"新しい話題"}
会話の深さ: ${o.messageCount}回のやり取り
前回のAI応答: ${o.lastAiMessage}`:"",u=`
${d}${l}${c}

[ルール]
- 会話の流れを意識し、前回の内容に自然に繋げる。
- 過去の会話について聞かれた場合は、具体的に振り返って答える。
- 相づち→ねぎらい→一息つける提案を1つだけ。
- 連続質問はしない。問いは最大1つ。
- ユーザーの表現を少し言い換えて返す（ミラーリング）。
- 会話が続いている場合は、前回の話題に関連した自然なフォローアップを心がける。
- ユーザーが具体的な解決策や情報を求めている場合は、「詳しい情報が必要だったら教えてね」と提案する。
- 内容が不明確な場合は、推察を交えつつ具体的に聞き返す。
- 出力はプレーンテキスト。Markdown装飾は使わない。
- 箇条書きは日本語の点を使う。
`.trim();r=(await A.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:u},...n]})).choices[0].message.content||"うんうん、そうなんだね。"}return await a.supabaseAdmin.from("chat_logs").insert({participant_id:i.id,role:"assistant",content:r}),S(i.id).catch(console.error),R(i.id,t,r).catch(console.error),r=(r??"").replace(/```[\s\S]*?```/g,"").replace(/\*\*(.+?)\*\*/g,"$1").replace(/__(.+?)__/g,"$1").replace(/_([^_]+)_/g,"$1").replace(/^\s*[-*]\s+/gm,"・").replace(/\(β [0-9a-f]{7}\)/ig,"").replace(/[ \t]+\n/g,"\n").trim()}async function S(e){let{data:t}=await a.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!0}).limit(50),n=(t??[]).map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n"),r=`
以下の会話ログから、ユーザーに関する「継続的に役立つ情報」（子どもの年齢感/好み/配慮点/口調の好み/通知の希望など）を
事実ベースで200字以内に日本語で箇条書き要約してください。推測や機微な情報は書かないでください。
---
${n}
  `.trim();try{let t=await A.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:r}],temperature:0}),n=t.choices?.[0]?.message?.content,i="string"==typeof n?n.trim():null;i&&(await a.supabaseAdmin.from("participants").update({profile_summary:i}).eq("id",e),console.log(`[Profile] Updated summary for participant ${e}`))}catch(e){console.error("updateProfileSummary failed",e)}}async function R(e,t,n){if(t.length>30||/(子どもの年齢|名前|好き|嫌い|困って|悩み|心配|不安|楽しい|嬉しい)/.test(t))try{let r=`
以下の会話から、ユーザーに関する「重要な情報」（子どもの年齢、名前、好み、困りごと、家族構成など）を
簡潔に抽出してください。JSON形式で返してください。
例: {"child_age": "3歳", "concerns": ["食事", "睡眠"], "family": "夫婦と子ども1人"}

ユーザー: ${t}
AI: ${n}
    `.trim(),i=await A.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:r}],temperature:0}),o=i.choices?.[0]?.message?.content,s="string"==typeof o?o.trim():null;s&&(await a.supabaseAdmin.from("conversation_memories").insert({participant_id:e,user_message:t,ai_message:n,extracted_info:s,created_at:new Date().toISOString()}),console.log(`[Memory] Saved important conversation info for participant ${e}`))}catch(e){console.error("saveImportantConversationInfo failed",e)}}},8316:(e,t,n)=>{n.d(t,{supabaseAdmin:()=>a});let a=(0,n(9498).eI)("https://mkikyycrgfudodhkukng.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:!1}})}};