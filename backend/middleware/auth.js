import supabase, { isSupabaseConfigured } from '../utils/supabase.js';

// 简单的认证中间件 - 实际项目应该使用 JWT
const authMiddleware = async (req, res, next) => {
  try {
    // 从 header 获取 token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: '未提供认证令牌' 
      });
    }

    const token = authHeader.substring(7);

    // mock auth 优先判断：ALLOW_MOCK_AUTH=true 且 token 以 mock-token- 开头时，
    // 无论 Supabase 是否已配置都放行（用于本地联调）
    // 尝试从 Supabase profiles 表查真实 profile（按 token 里的 username），查不到就 fallback
    if (process.env.ALLOW_MOCK_AUTH === 'true' && token.startsWith('mock-token-')) {
      try {
        // token 格式: mock-token-{username}-{timestamp}
        const parts = token.split('-');
        // parts[0]='mock', parts[1]='token', parts.slice(2,-1) 是 username（中间段），parts[last] 是 timestamp
        // 取 parts 中间部分当 username（兼容中间有 '-' 字符的情况）
        const lastPart = parts[parts.length - 1];
        const middleParts = parts.slice(2, -1);
        const usernameFromToken = middleParts.join('-');

        if (supabase && usernameFromToken) {
          const { data: realProfile, error: pErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', usernameFromToken)
            .single();
          if (!pErr && realProfile) {
            req.profile = realProfile;
            return next();
          }
        }
      } catch (_) { /* 查 profile 失败就走 fallback */ }

      // fallback 默认返回 parent 角色（兼容无 Supabase 时的本地 mock）
      req.profile = {
        id: '00000000-0000-0000-0000-000000000001',
        username: 'demo',
        real_name: '演示用户',
        role: 'parent',
        family_group_id: '00000000-0000-0000-0000-000000000001'
      };
      return next();
    }

    if (!isSupabaseConfigured) {
      return res.status(503).json({
        success: false,
        error: '认证服务尚未配置'
      });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: '认证令牌无效' });
    }

    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (error || !user) {
      return res.status(403).json({ success: false, error: '用户资料不存在' });
    }

    req.profile = user;
    return next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(401).json({ 
      success: false, 
      error: '认证失败' 
    });
  }
};

export default authMiddleware;
