import express from 'express';
const router = express.Router();
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

// 生成随机绑定码
const generateGroupCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

// 创建家庭组并生成绑定码
router.post('/create-group', authMiddleware, async (req, res) => {
  try {
    // 生成唯一的绑定码（最多试 10 次）
    let groupCode;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      groupCode = generateGroupCode();
      const { data, error: findError } = await supabase
        .from('family_groups')
        .select('id')
        .eq('group_code', groupCode)
        .single();

      // PGRST116 = "0 rows returned" 是没找到，其他错误才是真的
      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }
      if (!data) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: '生成唯一绑定码失败，请重试' });
    }

    // 创建家庭组
    const { data: familyGroup, error: createError } = await supabase
      .from('family_groups')
      .insert({
        group_code: groupCode,
        created_by: req.profile.id
      })
      .select('*')
      .single();

    if (createError) {
      throw createError;
    }

    // 更新用户的家庭组ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_group_id: familyGroup.id })
      .eq('id', req.profile.id);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: {
        family_group: familyGroup
      }
    });
  } catch (error) {
    console.error('Create family group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 使用绑定码加入家庭组
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { group_code } = req.body;
    
    if (!group_code) {
      return res.status(400).json({ error: 'Group code is required' });
    }

    // 查找家庭组
    const { data: familyGroup, error: findError } = await supabase
      .from('family_groups')
      .select('*')
      .eq('group_code', group_code)
      .single();

    if (findError || !familyGroup) {
      return res.status(404).json({ error: 'Invalid group code' });
    }

    // 更新用户的家庭组ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_group_id: familyGroup.id })
      .eq('id', req.profile.id);

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: {
        family_group: familyGroup
      }
    });
  } catch (error) {
    console.error('Join family group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取家庭成员列表
router.get('/members', authMiddleware, async (req, res) => {
  try {
    if (!req.profile.family_group_id) {
      return res.status(400).json({ error: 'User not in a family group' });
    }

    // 获取家庭成员
    const { data: members, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('family_group_id', req.profile.family_group_id);

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        members
      }
    });
  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
