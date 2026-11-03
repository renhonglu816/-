import express from 'express';
const router = express.Router();
import verifyIdentity from '../utils/verifyIdentity.js';

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
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码是必填项'
      });
    }

    // 模拟登录 - 实际项目应该验证密码
    // 使用固定 UUID，匹配 profiles 表里已有的演示用户，保证后续 medications POST 能通过 user_id 校验
    const DEMO_PARENT_UUID = '00000000-0000-0000-0000-000000000001';
    const DEMO_CHILD_UUID  = '00000000-0000-0000-0000-000000000002';

    const userUuid = (role === 'child') ? DEMO_CHILD_UUID : DEMO_PARENT_UUID;

    const mockUser = {
      id: userUuid,
      username,
      role: role || 'parent',
      real_name: username,
      // family_group_id 统一用 parent 的 UUID，保证 child 能查到同组 parent 的药
      family_group_id: DEMO_PARENT_UUID,
      created_at: new Date().toISOString()
    };

    // 生成令牌
    const token = `mock-token-${username}-${Date.now()}`;

    res.status(200).json({
      success: true,
      data: {
        user: mockUser,
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

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码是必填项'
      });
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

    // 尝试写入 Supabase profiles（不阻塞注册流程，RLS 已关闭）
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        await supabase.from('profiles').insert({
          id: newUserId,
          username,
          role: role || 'parent',
          real_name: real_name || username,
          id_card: id_card || null
        });
      }
    } catch (_dbErr) {
      // 忽略 DB 写入失败（可能未配置或 profiles 表不存在）
      console.warn('[auth/register] profiles 写入失败，继续返回 mock 用户:', _dbErr.message);
    }

    const newUser = {
      id: newUserId,
      username,
      role: role || 'parent',
      real_name: real_name || username,
      family_group_id: newUserId,
      created_at: new Date().toISOString()
    };

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
