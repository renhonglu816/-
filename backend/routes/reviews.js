import express from 'express';
const router = express.Router();
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

// 获取复核请求
router.get('/', authMiddleware, async (req, res) => {
  try {
    const role = req.profile.role;
    let query = supabase
      .from('medication_review_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'child') {
      // 子女：查看同 family_group 父母的复核请求
      if (req.profile.family_group_id) {
        const { data: parents, error: pErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('family_group_id', req.profile.family_group_id)
          .eq('role', 'parent');
        if (pErr) throw pErr;
        if (parents && parents.length > 0) {
          const parentIds = parents.map(p => p.id);
          query = query.in('elderly_id', parentIds);
        } else {
          return res.status(200).json({ success: true, data: { requests: [] } });
        }
      } else {
        return res.status(200).json({ success: true, data: { requests: [] } });
      }
    } else {
      // 父母：只看自己的
      query = query.eq('elderly_id', req.profile.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data: { requests: data || [] } });
  } catch (error) {
    console.error('获取复核请求错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 创建复核请求
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { medication, image_url } = req.body;
    if (!medication || !medication.name) {
      return res.status(400).json({ error: 'medication 是必填项' });
    }

    const { data, error } = await supabase
      .from('medication_review_requests')
      .insert({
        elderly_id: req.profile.id,
        medication,
        image_url: image_url || null,
        status: 'pending'
      })
      .select('*')
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data: { request: data } });
  } catch (error) {
    console.error('创建复核请求错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 确认复核请求
router.put('/:id/confirm', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('medication_review_requests')
      .update({ status: 'confirmed' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, data: { request: data } });
  } catch (error) {
    console.error('确认复核请求错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 拒绝复核请求
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('medication_review_requests')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, data: { request: data } });
  } catch (error) {
    console.error('拒绝复核请求错误:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

export default router;
