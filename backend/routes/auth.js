import express from 'express';
const router = express.Router();
import verifyIdentity from '../utils/verifyIdentity.js';
import supabase, { isSupabaseConfigured } from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

const requireMockAuthEnabled = (_req, res, next) => {
  if (process.env.ALLOW_MOCK_AUTH === 'true') return next();
  return res.status(501).json({
    success: false,
    error: '账号密码认证尚未接入；请配置 Supabase Auth，或仅在本地演示时启用 ALLOW_MOCK_AUTH'
  });
};

// 登录
router.post('/login', requireMockAuthEnabled, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码是必填项'
      });
    }

    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, error: '账号服务暂不可用' });
    }

    // 账号角色只从数据库读取，登录端不能自行指定或切换角色。
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.trim())
      .single();

    if (profileError || !profile) {
      return res.status(401).json({ success: false, error: '账号不存在或密码错误' });
    }

    // 生成令牌
    const token = `mock-token-${username}-${Date.now()}`;

    res.status(200).json({
      success: true,
      data: {
        user: profile,
        token
      }
    });
  } catch (error) {
    console.error('登录路由错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 注册
router.post('/register', requireMockAuthEnabled, async (req, res) => {
  try {
    const { username, password, real_name, id_card, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        error: '用户名、密码和账号类型是必填项'
      });
    }

    if (!['parent', 'child'].includes(role)) {
      return res.status(400).json({ success: false, error: '账号类型不正确' });
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ success: false, error: '密码至少 8 位，并同时包含字母和数字' });
    }

    if (!isSupabaseConfigured) {
      return res.status(503).json({ success: false, error: '账号服务暂不可用' });
    }

    const normalizedUsername = username.trim();
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .single();
    if (existingProfile) {
      return res.status(409).json({ success: false, error: '该用户名已被注册' });
    }

    // 验证身份（如果提供）
    if (real_name && id_card) {
      const identityResult = await verifyIdentity(real_name, id_card);
      if (!identityResult.success) {
        return res.status(400).json(identityResult);
      }
    }

    // 生成合法 UUID（与 Supabase profiles/medications 等表对齐）
    const newUserId = globalThis.crypto?.randomUUID?.() ||
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

    const { data: newUser, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: newUserId,
        username: normalizedUsername,
        role,
        real_name: real_name || normalizedUsername,
        id_card: id_card || null
      })
      .select('*')
      .single();

    if (insertError || !newUser) {
      console.error('[auth/register] profiles 写入失败:', insertError?.message);
      return res.status(503).json({ success: false, error: '账号创建失败，请稍后重试' });
    }

    // 生成令牌
    const token = `mock-token-${username}-${Date.now()}`;

    res.status(201).json({
      success: true,
      data: {
        user: newUser,
        token
      }
    });
  } catch (error) {
    console.error('注册路由错误:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

// 修改当前账号资料。用户名变更后同时签发新令牌，保证后续请求仍能认证。
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    if (!/^[A-Za-z0-9_\-\u4e00-\u9fa5]{2,20}$/.test(username)) {
      return res.status(400).json({ success: false, error: '用户名需为2到20位中文、字母、数字、下划线或短横线' });
    }

    const { data: existingProfiles, error: findError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', req.profile.id)
      .limit(1);
    if (findError) throw findError;
    if (existingProfiles?.length) {
      return res.status(409).json({ success: false, error: '该用户名已被使用' });
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ username })
      .eq('id', req.profile.id)
      .select('*')
      .single();
    if (updateError || !profile) throw updateError || new Error('账号资料更新失败');

    const token = `mock-token-${username}-${Date.now()}`;
    res.status(200).json({ success: true, data: { user: profile, token } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: '暂时无法修改用户名' });
  }
});

// 身份验证路由
router.post('/verify-identity', async (req, res) => {
  try {
    const { name, id_card } = req.body;

    if (!name || !id_card) {
      return res.status(400).json({
        success: false,
        message: '姓名和身份证号是必填项'
      });
    }

    // 调用身份验证函数
    const result = await verifyIdentity(name, id_card);

    // 返回验证结果
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('身份验证路由错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;
