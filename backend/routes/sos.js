import express from 'express';
const router = express.Router();
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

// 发送 SOS 求助（父母自己发）
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { message, location } = req.body;

    const { data, error } = await supabase
      .from('sos_requests')
      .insert({
        elderly_id: req.profile.id,
        elderly_name: req.profile.real_name || req.profile.username || '长者',
        message: message || '紧急求助！',
        location: location || null,
        status: 'pending'
      })
      .select('*')
      .single();

    if (error) {
      console.error('SOS insert error:', error);
      return res.status(500).json({ error: '数据库写入失败: ' + (error.message || error.code) });
    }

    res.status(201).json({ success: true, data: { sos: data } });
  } catch (error) {
    console.error('发送 SOS 错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 获取 SOS 通知（父母看自己发的，子女看同 family_group 父母发的 pending）
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    const role = req.profile.role;

    if (role === 'child') {
      if (!req.profile.family_group_id) {
        return res.status(200).json({ success: true, data: { notifications: [] } });
      }
      // 查 family_group 内所有父母的 pending SOS
      const { data: parents, error: pErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_group_id', req.profile.family_group_id)
        .eq('role', 'parent');
      if (pErr) throw pErr;

      if (!parents || parents.length === 0) {
        return res.status(200).json({ success: true, data: { notifications: [] } });
      }

      const parentIds = parents.map(p => p.id);
      const { data, error } = await supabase
        .from('sos_requests')
        .select('*')
        .in('elderly_id', parentIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.status(200).json({ success: true, data: { notifications: data || [] } });
    } else {
      // 父母看自己发的所有
      const { data, error } = await supabase
        .from('sos_requests')
        .select('*')
        .eq('elderly_id', req.profile.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      res.status(200).json({ success: true, data: { notifications: data || [] } });
    }
  } catch (error) {
    console.error('获取 SOS 通知错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 标记 SOS 已处理
router.put('/notifications/:id/handled', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 验证 SOS 存在 + 权限
    const { data: sos, error: getError } = await supabase
      .from('sos_requests')
      .select('elderly_id, status')
      .eq('id', id)
      .single();

    if (getError || !sos) {
      return res.status(404).json({ error: 'SOS request not found' });
    }

    // 父母只能处理自己发的，子女可以处理同 family_group 父母发的
    if (req.profile.role === 'parent' && sos.elderly_id !== req.profile.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    if (req.profile.role === 'child' && req.profile.family_group_id) {
      const { data: parentCheck } = await supabase
        .from('profiles')
        .select('family_group_id')
        .eq('id', sos.elderly_id)
        .single();
      if (parentCheck?.family_group_id !== req.profile.family_group_id) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('sos_requests')
      .update({
        status: 'handled',
        handled_by: req.profile.id,
        handled_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    res.status(200).json({ success: true, data: { sos: updated } });
  } catch (error) {
    console.error('标记 SOS 已处理错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

export default router;
