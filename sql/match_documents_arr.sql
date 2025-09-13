CREATE OR REPLACE FUNCTION match_documents_arr (
  query_embedding float8[],
  match_count int DEFAULT 8
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  source_url VARCHAR(500),
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.content,
    d.source_url,
    1 - (d.embedding <=> (query_embedding::vector(1536))) AS similarity
  FROM documents d
  ORDER BY d.embedding <=> (query_embedding::vector(1536))
  LIMIT match_count;
$$;
