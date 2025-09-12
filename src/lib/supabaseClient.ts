import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wbmgurckzygdhhrliyvl.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_15fRJCpoYBkRlTa3cJIXUjg_Ajskglr1';

// デバッグ用ログ
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Service Key exists:', !!supabaseServiceKey);

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
