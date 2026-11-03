import { createClient } from '@supabase/supabase-js';

// Supabase 配置
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// 创建 Supabase 客户端
let supabase;
try {
  if (!isSupabaseConfigured) {
    throw new Error('缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY');
  }
  supabase = createClient(supabaseUrl, supabaseKey);
} catch (error) {
  console.warn('Supabase 未配置，数据库接口不可用:', error.message);
  // 创建一个模拟的 supabase 对象，以便服务器可以启动
  supabase = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })
    },
    from: () => ({
      select: () => ({ 
        eq: () => ({ 
          single: () => ({ data: null, error: { message: 'Not found' } }) 
        })
      }),
      insert: () => ({ 
        select: () => ({ 
          single: () => ({ data: null, error: null }) 
        })
      }),
      update: () => ({ 
        eq: () => ({ error: null }) 
      }),
      delete: () => ({ 
        eq: () => ({ error: null }) 
      })
    })
  };
}

export { isSupabaseConfigured };
export default supabase;
