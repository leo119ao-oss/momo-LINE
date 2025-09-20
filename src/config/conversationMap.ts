export const EMOTION_CHOICES = [
  { label: "😊", key: "smile" },
  { label: "😐", key: "neutral" },
  { label: "😩", key: "tired" },
  { label: "😡", key: "anger"  },
  { label: "😢", key: "sad"    },
  { label: "🤔", key: "think"  }
];

// 感情ごとの簡易深掘り2択
export const DEEPENING_BY_EMOTION: Record<string, {a:string, b:string}> = {
  smile:  { a: "子どもとの時間", b: "自分の時間" },
  neutral:{ a: "家事のペース",   b: "気分の様子" },
  tired:  { a: "体の疲れ",       b: "気持ちの疲れ" },
  anger:  { a: "家事の詰まり",   b: "人とのやり取り" },
  sad:    { a: "子の出来事",     b: "予定が崩れた" },
  think:  { a: "やる/やらない",  b: "優先の入れ替え" }
};
