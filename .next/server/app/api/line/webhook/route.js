"use strict";(()=>{var e={};e.id=457,e.ids=[457],e.modules={399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},7790:e=>{e.exports=require("assert")},4770:e=>{e.exports=require("crypto")},7702:e=>{e.exports=require("events")},2048:e=>{e.exports=require("fs")},2615:e=>{e.exports=require("http")},8791:e=>{e.exports=require("https")},9801:e=>{e.exports=require("os")},5315:e=>{e.exports=require("path")},8621:e=>{e.exports=require("punycode")},6162:e=>{e.exports=require("stream")},4175:e=>{e.exports=require("tty")},7360:e=>{e.exports=require("url")},1764:e=>{e.exports=require("util")},2623:e=>{e.exports=require("worker_threads")},1568:e=>{e.exports=require("zlib")},2254:e=>{e.exports=require("node:buffer")},7561:e=>{e.exports=require("node:fs")},4492:e=>{e.exports=require("node:stream")},2477:e=>{e.exports=require("node:stream/web")},2185:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>R,patchFetch:()=>I,requestAsyncStorage:()=>S,routeModule:()=>E,serverHooks:()=>N,staticGenerationAsyncStorage:()=>P});var a={};r.r(a),r.d(a,{POST:()=>v,dynamic:()=>A,runtime:()=>q});var n=r(9303),o=r(8716),s=r(670),i=r(7070),l=r(2254);let c=require("node:crypto");var u=r(2099),p=r(8316),m=r(4214);let d=`
あなたはMomo。母親の内省を支える温かい相手。
- 口調: やさしく、ねぎらい/共感を一言そえる（〜だね/〜かもね）。
- 断定や評価は避け、「〜かも」「〜してみる？」の提案。
- 長文にしすぎない。段落を分けて読みやすく。
`.trim();async function g(e){if(e.title&&e.author_name)return e;try{let t;let a=new URL("https://www.okaasan.net/wp-json/wp/v2/posts");a.searchParams.set("search",e.source_url),a.searchParams.set("per_page","1"),a.searchParams.set("_embed","author");let n=await fetch(a.toString());if(!n.ok)return e;let[o]=await n.json(),s=(t=o?.title?.rendered,(t?.replace?.(/<[^>]*>/g,"")?.trim?.()??"")||e.title),i=o?._embedded?.author?.[0]?.name||e.author_name||"お母さん大学";e.title=s,e.author_name=i;try{let{supabaseAdmin:t}=await Promise.resolve().then(r.bind(r,8316));await t.from("documents").update({title:s,author_name:i}).eq("source_url",e.source_url)}catch{}}catch{}return e}async function h(e,t=5){try{let r=new URL("https://www.okaasan.net/wp-json/wp/v2/posts");r.searchParams.set("search",e),r.searchParams.set("per_page",String(t)),r.searchParams.set("_embed","author");let a=await fetch(r.toString(),{method:"GET"});if(!a.ok)return[];let n=await a.json(),o=e=>e.replace(/<[^>]*>/g,"").trim();return n.map(e=>({url:e.link,title:o(e.title?.rendered??""),author:String(e?._embedded?.author?.[0]?.name??"お母さん大学")}))}catch{return[]}}let f=new m.ZP({apiKey:process.env.OPENAI_API_KEY});async function _(e){let{data:t}=await p.supabaseAdmin.from("participants").select("*").eq("line_user_id",e).single();if(!t){let{data:r,error:a}=await p.supabaseAdmin.from("participants").insert({line_user_id:e,archetype:"B"}).select().single();if(a)throw a;t=r}return t}let w=null;async function y(e){let{data:t}=await p.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!1}).limit(8),r=(t??[]).reverse();return{lastUser:[...r].reverse().find(e=>"user"===e.role)?.content??"",thread:r.map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n")}}async function x(e){if(RegExp(`[？?]|(どう|教えて|方法|何|どこ|いつ|おすすめ|使い方|遊び|コツ|困る|悩み|解決|したい|やり方|知りたい|について|なぜ|どうして|できる|できない|ある|ない|あるの|ないの|する|しない|やる|やらない|いい|悪い|良い|悪い|おすすめ|避ける|注意|気をつける|心配|不安|楽しい|面白い|つまらない|大変|簡単|難しい|便利|不便|効果的|無駄|時間|お金|場所|人|物|こと|もの|とき|場合|状況|問題|課題|子育て|育児|子ども|赤ちゃん|幼児|小学生|中学生|高校生|学校|幼稚園|食事|睡眠|遊び|勉強|習い事|運動|健康|病気|怪我|安全|危険|友達|家族|夫|妻|親|祖父母|兄弟|姉妹|ママ|パパ|お母さん|お父さん)`).test(e))return"information_seeking";let t=`
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
  `;try{let e=await f.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:t}],temperature:0}),r=e.choices[0].message.content?.trim();if(console.log("Intent detection result:",r),"information_seeking"===r)return"information_seeking"}catch(e){console.error("Intent detection failed:",e)}return"personal_reflection"}async function b(e,t){console.log("Handling information seeking intent...");try{let r=(await f.embeddings.create({model:"text-embedding-3-small",input:e})).data[0].embedding,{data:a,error:n}=await p.supabaseAdmin.rpc("match_documents_arr",{query_embedding:r,match_count:8});if(n)throw Error(`Supabase search error: ${n.message}`);let o=a??[];if(console.log(`[RAG] raw_hits: ${o.length}, topSim: ${o[0]?.similarity||0}`),!o.length){let t=function(e){let t=e;for(let[r,a]of[[/雨の日/g,"雨の日 室内 家の中 おうち遊び 外出できない日 天気悪い"],[/晴れ/g,"晴れ 外遊び 公園 散歩 外出"],[/暑い|寒い/g,"暑い 寒い 温度 気候 季節"],[/イライラ/g,"イライラ ストレス 気持ちの波 モヤモヤ 怒り 不満"],[/疲れ/g,"疲れ 疲労 だるい しんどい 元気ない"],[/不安|心配/g,"不安 心配 悩み 困る どうしよう"],[/楽しい|嬉しい/g,"楽しい 嬉しい うれしい 喜び 幸せ"],[/寝かしつけ|ねかしつけ/g,"寝かしつけ 入眠 寝つき 夜泣き 睡眠 眠り"],[/夜泣き/g,"夜泣き 夜中 泣く 睡眠 不眠"],[/離乳食/g,"離乳食 食べない 食事 偏食 取り分け 食育"],[/食べない/g,"食べない 偏食 食事 食育 栄養"],[/食事/g,"食事 食べ物 料理 栄養 食育"],[/遊び/g,"遊び おもちゃ ゲーム 活動 楽しみ"],[/勉強/g,"勉強 学習 宿題 教育 習い事"],[/習い事/g,"習い事 教室 レッスン スキル"],[/子育て/g,"子育て 育児 親 ママ パパ 教育"],[/子ども|子供/g,"子ども 子供 幼児 赤ちゃん 小学生"],[/幼稚園/g,"幼稚園 保育園 園 入園 園生活"],[/学校/g,"学校 小学校 中学校 高校 教育"],[/病気/g,"病気 体調 健康 医療 病院"],[/怪我/g,"怪我 けが 事故 安全 危険"],[/安全/g,"安全 危険 注意 気をつける 予防"],[/友達/g,"友達 友だち 人間関係 仲良し コミュニケーション"],[/家族/g,"家族 夫 妻 親 祖父母 兄弟"]])r.test(e)&&(t+=" "+a);return t}(e);if(t!==e){let e=await f.embeddings.create({model:"text-embedding-3-small",input:t}),{data:r}=await p.supabaseAdmin.rpc("match_documents_arr",{query_embedding:e.data[0].embedding,match_count:8});o=r??[]}}let s=o.filter(e=>(e.similarity??0)>=.15),i=(s.length?s:o).slice(0,5);console.log(`[RAG] after_filter: ${s.length}, picked: ${i.length}`);for(let e=0;e<i.length;e++)i[e]=await g(i[e]);if(0===i.length){let t=await h(e,5);if(t.length){let e=t.map((e,t)=>`[${t+1}] ${e.title} — ${e.author}
${e.url}`).join("\n");return`手元のベクトル検索では直接ヒットがなかったけど、近いテーマっぽい記事を見つけたよ。

— 参考候補 —
${e}`}return"ごめん、いま手元のデータからは関連が拾えなかった… もう少し違う聞き方も試してみて？"}let l=i.map(e=>e.content).join("\n---\n");Array.from(new Set(i.map(e=>e.source_url)));let{lastUser:c,thread:u}=await y(t.id),m=`
${d}

[最近の会話ログ]
${u}

[ルール]
1) 冒頭に1〜2文だけ共感を添える（過度な深掘りはしない）。
2) 次に、提供されたコンテキストの範囲で質問に答える。
3) 断定は避け、「〜かも」「〜という考え方も」で柔らかく。
4) 箇条書きOK。最後に一言だけ励ます。
5) コンテキスト外は無理に答えない。
`.trim(),_=(await f.chat.completions.create({model:"gpt-4o-mini",temperature:.5,messages:[{role:"system",content:m},{role:"user",content:`コンテキスト:
${l}

質問: ${e}

直前ユーザー発話: ${c}`}]})).choices[0].message.content||"すみません、うまくお答えできませんでした。",w=i.map((e,t)=>`[${t+1}] ${e.title??"(タイトル未取得)"} — ${e.author_name??"お母さん大学"}
${e.source_url}`).join("\n");return`${_}

— 参考記事 —
${w}`}catch(e){return console.error("RAG process failed:",e),"申し訳ありません、情報の検索中にエラーが発生しました。もう一度お試しください。"}}async function $(e,t){let r;let a=await _(e);await p.supabaseAdmin.from("chat_logs").insert({participant_id:a.id,role:"user",content:t});let n=await x(t),o=/[？\?]/.test(t)?"information_seeking":"personal_reflection"===w&&t.length<25?"personal_reflection":n;if(w=o,console.log(`[Intent] User message: "${t}" -> Raw: ${n} -> Final: ${o}`),"information_seeking"===o)r=await b(t,a);else{console.log("Handling personal reflection intent...");let{data:e}=await p.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",a.id).order("created_at",{ascending:!1}).limit(9),n=(e||[]).reverse().map(e=>({role:"ai"===e.role?"assistant":"user",content:e.content}));n.push({role:"user",content:t});let o=a.profile_summary?`
[ユーザープロフィール要約]
${a.profile_summary}
`:"",s=`
${d}${o}

[ルール]
- 相づち→ねぎらい→一息つける提案を1つだけ。
- 連続質問はしない。問いは最大1つ。
- ユーザーの表現を少し言い換えて返す（ミラーリング）。
`.trim();r=(await f.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:s},...n]})).choices[0].message.content||"うんうん、そうなんだね。"}return await p.supabaseAdmin.from("chat_logs").insert({participant_id:a.id,role:"assistant",content:r}),k(a.id).catch(console.error),r}async function k(e){let{data:t}=await p.supabaseAdmin.from("chat_logs").select("role, content").eq("participant_id",e).order("created_at",{ascending:!0}).limit(50),r=(t??[]).map(e=>`${"user"===e.role?"U":"AI"}: ${e.content}`).join("\n"),a=`
以下の会話ログから、ユーザーに関する「継続的に役立つ情報」（子どもの年齢感/好み/配慮点/口調の好み/通知の希望など）を
事実ベースで200字以内に日本語で箇条書き要約してください。推測や機微な情報は書かないでください。
---
${r}
  `.trim();try{let t=await f.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"user",content:a}],temperature:0}),r=t.choices[0].message.content?.trim()??null;r&&(await p.supabaseAdmin.from("participants").update({profile_summary:r}).eq("id",e),console.log(`[Profile] Updated summary for participant ${e}`))}catch(e){console.error("updateProfileSummary failed",e)}}let q="nodejs",A="force-dynamic";async function v(e){var t,r,a,n;let o=await e.text(),s=e.headers.get("x-line-signature")||"";if(t=process.env.LINE_CHANNEL_SECRET,a=(0,c.createHmac)("SHA256",t).update(o).digest(),r="base64",n=l.Buffer.from(s,r),!(a.length===n.length&&(0,c.timingSafeEqual)(a,n)))return console.error("Signature validation failed"),i.NextResponse.json({error:"Unauthorized"},{status:401});let p=JSON.parse(o).events;console.log(`Received ${p.length} webhook events`);try{for(let e of p)if("message"===e.type&&"text"===e.message.type){let t=e.source.userId,r=e.message.text;console.log(`Processing message from user ${t}: ${r.substring(0,50)}...`);try{let a=await $(t,r);await u.d.replyMessage(e.replyToken,{type:"text",text:a}),console.log(`Successfully replied to user ${t}`)}catch(r){console.error(`Error handling message from user ${t}:`,r);try{await u.d.replyMessage(e.replyToken,{type:"text",text:"すみません、一時的にエラーが発生しました。しばらく時間をおいてから、もう一度お試しください。"})}catch(e){console.error("Failed to send error message:",e)}}}else if("follow"===e.type){let t=e.source.userId;console.log(`New user followed: ${t}`);try{await u.d.replyMessage(e.replyToken,{type:"text",text:"Momo AIパートナーへようこそ！\n\nあなたの内省を支援する、温かいパートナーとして、いつでもお話をお聞かせください。\n\n毎朝9時に小さな問いをお送りし、週末には一週間の振り返りをお届けします。"})}catch(e){console.error("Error sending welcome message:",e)}}}catch(e){return console.error("Error processing webhook event:",e),i.NextResponse.json({error:"Internal Server Error"},{status:500})}return i.NextResponse.json({status:"ok"})}let E=new n.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/line/webhook/route",pathname:"/api/line/webhook",filename:"route",bundlePath:"app/api/line/webhook/route"},resolvedPagePath:"C:\\Users\\Owner\\Desktop\\momo-LINE\\src\\app\\api\\line\\webhook\\route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:S,staticGenerationAsyncStorage:P,serverHooks:N}=E,R="/api/line/webhook/route";function I(){return(0,s.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:P})}},2099:(e,t,r)=>{r.d(t,{d:()=>o});var a=r(8077);let n={channelAccessToken:process.env.LINE_CHANNEL_ACCESS_TOKEN||"",channelSecret:process.env.LINE_CHANNEL_SECRET||""},o=new a.Z(n)},8316:(e,t,r)=>{r.d(t,{supabaseAdmin:()=>o});var a=r(9498);let n=process.env.SUPABASE_SERVICE_ROLE_KEY,o=(0,a.eI)("https://mkikyycrgfudodhkukng.supabase.co",n,{auth:{persistSession:!1}})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[276,62,77,214],()=>r(2185));module.exports=a})();