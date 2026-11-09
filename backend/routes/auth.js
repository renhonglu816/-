import express from 'express';
const router = express.Router();
import verifyIdentity from '../utils/verifyIdentity.js';
import supabase, {
  createAuthClient,
  isSupabaseAuthConfigured,
  isSupabaseConfigured,
} from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

const requirePasswordAuth = (_req, res, next) => {
  if (process.env.ALLOW_MOCK_AUTH === 'true' || isSupabaseAuthConfigured) {
    return next();
  }
  return res.status(503).json({
    success: false,
    error: '账号服务尚未完成配置，请联系管理员'
  });
};

const normalizeUsername = (value) => String(value || '').trim();
const usernamePattern = /^[A-Za-z0-9_\-\u4e00-\u9fa5]{3,20}$/;

const createInternalEmail = () => {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  return `u-${id.replace(/[^a-zA-Z0-9]/g, '')}@auth.yaojide.invalid`;
};

const signInUser = async (email, password) => {
  const authClient = createAuthClient();
  if (!authClient) return { data: null, error: new Error('账号服务不可用') };
  return authClient.auth.signInWithPassword({ email, password });
};

// 登录
router.post('/login', requirePasswordAuth, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: '用户名和密码是必填项'
      });
    }

    const normalizedUsername = normalizeUsername(username);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', normalizedUsername)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(401).json({ success: false, error: '账号不存在或密码错误' });
    }

    if (process.env.ALLOW_MOCK_AUTH === 'true' && !isSupabaseAuthConfigured) {
      const token = `mock-token-${normalizedUsername}-${Date.now()}`;
      return res.status(200).json({ success: true, data: { user: profile, token } });
    }

    const { data: authUserData, error: authUserError } =
      await supabase.auth.admin.getUserById(profile.id);
    const email = authUserData?.user?.email;
    if (authUserError || !email) {
      return res.status(409).json({
        success: false,
        error: '该账号来自旧版演示数据，请联系管理员迁移账号'
      });
    }

    const { data: authData, error: signInError } = await signInUser(email, password);
    if (signInError || !authData?.session?.access_token) {
      return res.status(401).json({ success: false, error: '账号不存在或密码错误' });
    }

    res.status(200).json({
      success: true,
      data: {
        user: profile,
        token: authData.session.access_token
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
router.post('/register', requirePasswordAuth, async (req, res) => {
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

    const normalizedUsername = normalizeUsername(username);
    if (!usernamePattern.test(normalizedUsername)) {
      return res.status(400).json({
        success: false,
        error: '用户名需为3到20位中文、字母、数字、下划线或短横线'
      });
    }

    const { data: existingProfile, error: existingProfileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle();
    if (existingProfileError) {
      throw existingProfileError;
    }
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

    if (process.env.ALLOW_MOCK_AUTH === 'true' && !isSupabaseAuthConfigured) {
      const newUserId = globalThis.crypto?.randomUUID?.();
      const { data: mockUser, error: mockInsertError } = await supabase
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
      if (mockInsertError || !mockUser) {
        return res.status(503).json({ success: false, error: '账号创建失败，请稍后重试' });
      }
      return res.status(201).json({
        success: true,
        data: { user: mockUser, token: `mock-token-${normalizedUsername}-${Date.now()}` }
      });
    }

    const internalEmail = createInternalEmail();
    const { data: createdAuthData, error: createAuthError } =
      await supabase.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: { username: normalizedUsername, role }
      });

    const authUser = createdAuthData?.user;
    if (createAuthError || !authUser) {
      console.error('[auth/register] Supabase Auth 创建失败:', createAuthError?.message);
      return res.status(503).json({ success: false, error: '账号创建失败，请稍后重试' });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.id,
        username: normalizedUsername,
        role,
        real_name: real_name || normalizedUsername,
        id_card: id_card || null
      })
      .select('*')
      .single();

    if (insertError || !newUser) {
      console.error('[auth/register] profiles 写入失败:', insertError?.message);
      await supabase.auth.admin.deleteUser(authUser.id).catch(() => {});
      return res.status(503).json({ success: false, error: '账号创建失败，请稍后重试' });
    }

    const { data: authData, error: signInError } = await signInUser(internalEmail, password);
    if (signInError || !authData?.session?.access_token) {
      console.error('[auth/register] 新账号登录失败:', signInError?.message);
      return res.status(503).json({ success: false, error: '账号已创建，请重新登录' });
    }

    res.status(201).json({
      success: true,
      data: {
        user: newUser,
        token: authData.session.access_token
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

    if (isSupabaseAuthConfigured) {
      await supabase.auth.admin.updateUserById(req.profile.id, {
        user_metadata: { username }
      });
    }
    res.status(200).json({ success: true, data: { user: profile } });
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
