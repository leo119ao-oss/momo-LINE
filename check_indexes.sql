-- IVFFLATインデックスの確認SQL
-- SupabaseコンソールのSQL Editorで実行してください

-- 1. documentsテーブルのインデックス一覧
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'documents'
ORDER BY indexname;

-- 2. embeddingカラムのベクトルインデックス確認
SELECT 
    i.relname as index_name,
    i.relkind as index_type,
    pg_get_indexdef(i.oid) as index_definition
FROM pg_class i
JOIN pg_index ix ON i.oid = ix.indexrelid
JOIN pg_class t ON ix.indrelid = t.oid
WHERE t.relname = 'documents'
AND i.relname LIKE '%embedding%';

-- 3. ベクトル拡張機能の確認
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 4. インデックス作成（もし存在しない場合）
-- CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
