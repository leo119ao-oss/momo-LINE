import LiffLayout from "@/components/LiffLayout";
import LiffCard from "@/components/LiffCard";

export default function Page(){
  return (
    <LiffLayout title="ヘルプ / よくある質問">
      <LiffCard>
        <details style={styles.details}>
          <summary style={styles.summary}>これは医療ですか？</summary>
          <p style={styles.answer}>
            いいえ。これは生活を軽くするための研究・サービスです。つらい時は各地域の相談窓口をご利用ください。
          </p>
        </details>
      </LiffCard>

      <LiffCard>
        <details style={styles.details}>
          <summary style={styles.summary}>毎日できない日があっても大丈夫？</summary>
          <p style={styles.answer}>
            大丈夫です。できる日に60秒だけでOKです。
          </p>
        </details>
      </LiffCard>

      <LiffCard>
        <details style={styles.details}>
          <summary style={styles.summary}>データの扱いは？</summary>
          <p style={styles.answer}>
            研究と改善のために活用します。いつでも中止・削除のご希望を承ります。
          </p>
        </details>
      </LiffCard>
    </LiffLayout>
  );
}

const styles = {
  details: {
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '16px',
    margin: '0 0 12px 0',
    backgroundColor: '#FFFFFF',
  },
  summary: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#374151',
    cursor: 'pointer',
    marginBottom: '8px',
    listStyle: 'none',
  },
  answer: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: '1.5',
    margin: '8px 0 0 0',
  },
};
