import express from 'express';
const router = express.Router();
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';
import taskScheduler from '../services/taskScheduler.js';

// 获取当前用户的药物列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    let medications;
    let error;

    if (req.profile.role === 'child') {
      // 子女可以查看家庭组内所有父母的药物
      if (!req.profile.family_group_id) {
        return res.status(400).json({ error: 'User not in a family group' });
      }

      // 获取家庭组内的父母用户
      const { data: parents, error: parentsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_group_id', req.profile.family_group_id)
        .eq('role', 'parent');

      if (parentsError) {
        throw parentsError;
      }

      const parentIds = parents.map(parent => parent.id);

      // 获取父母的药物
      ({ data: medications, error } = await supabase
        .from('medications')
        .select('*')
        .in('user_id', parentIds));
    } else {
      // 父母只能查看自己的药物
      ({ data: medications, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', req.profile.id));
    }

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        medications
      }
    });
  } catch (error) {
    console.error('Get medications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 创建药物提醒（支持子女为父母创建）
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { user_id, name, dosage, time, reminder_times, is_active, usage, effect, frequency } = req.body;

    if (!name || !user_id) {
      return res.status(400).json({ error: 'Name and user_id are required' });
    }

    // 验证 user_id 是否存在且在同一家庭组
    const { data: targetUser, error: userError } = await supabase
      .from('profiles')
      .select('id, family_group_id, role')
      .eq('id', user_id)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // 验证目标用户是否为父母
    if (targetUser.role !== 'parent') {
      return res.status(400).json({ error: 'Target user must be a parent' });
    }

    // 验证是否在同一家庭组
    if (req.profile.role === 'child' && targetUser.family_group_id !== req.profile.family_group_id) {
      return res.status(403).json({ error: 'Target user not in the same family group' });
    }

    // 创建药物提醒
    const { data: medication, error: createError } = await supabase
      .from('medications')
      .insert({
        user_id,
        name,
        dosage,
        time: time || (reminder_times && reminder_times.length ? reminder_times[0] : ''),
        usage: usage || null,
        effect: effect || null,
        frequency: frequency || null,
        reminder_times: reminder_times || [],
        is_active: is_active !== false,
        created_by: req.profile.id
      })
      .select('*')
      .single();

    if (createError) {
      throw createError;
    }

    // 为药物创建提醒任务
    await taskScheduler.scheduleMedicationReminders(medication);

    res.status(201).json({
      success: true,
      data: {
        medication
      }
    });
  } catch (error) {
    console.error('Create medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 更新药物提醒
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    // 前端发的可选字段：name, dosage, time, status, taken_time, usage, effect, frequency, reminder_times, is_active
    const {
      name, dosage, time, usage, effect, frequency,
      reminder_times, is_active, status, taken_time
    } = req.body;

    // 获取药物信息
    const { data: medication, error: getError } = await supabase
      .from('medications')
      .select('user_id, created_by')
      .eq('id', id)
      .single();

    if (getError || !medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    // 验证权限：只有创建者或药物所属用户可以更新
    if (medication.created_by !== req.profile.id && medication.user_id !== req.profile.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // 构造 update payload，只传有值的字段
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (dosage !== undefined) updates.dosage = dosage;
    if (time !== undefined) updates.time = time;
    if (usage !== undefined) updates.usage = usage;
    if (effect !== undefined) updates.effect = effect;
    if (frequency !== undefined) updates.frequency = frequency;
    if (reminder_times !== undefined) updates.reminder_times = reminder_times;
    if (is_active !== undefined) updates.is_active = is_active;
    if (status !== undefined) updates.status = status;
    if (taken_time !== undefined) updates.taken_time = taken_time;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updatedMedication, error: updateError } = await supabase
      .from('medications')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    // 更新药物提醒任务
    await taskScheduler.scheduleMedicationReminders(updatedMedication);

    res.status(200).json({
      success: true,
      data: {
        medication: updatedMedication
      }
    });
  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 删除药物提醒
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取药物信息
    const { data: medication, error: getError } = await supabase
      .from('medications')
      .select('user_id, created_by')
      .eq('id', id)
      .single();

    if (getError || !medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    // 验证权限：只有创建者或药物所属用户可以删除
    if (medication.created_by !== req.profile.id && medication.user_id !== req.profile.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // 删除药物提醒
    const { error: deleteError } = await supabase
      .from('medications')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // 删除药物提醒任务
    await taskScheduler.removeMedicationReminders(id);

    res.status(200).json({
      success: true,
      message: 'Medication deleted successfully'
    });
  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 启用/禁用提醒
router.post('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取药物信息
    const { data: medication, error: getError } = await supabase
      .from('medications')
      .select('user_id, created_by, is_active')
      .eq('id', id)
      .single();

    if (getError || !medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    // 验证权限：只有创建者或药物所属用户可以切换状态
    if (medication.created_by !== req.profile.id && medication.user_id !== req.profile.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // 切换启用状态
    const { data: updatedMedication, error: updateError } = await supabase
      .from('medications')
      .update({
        is_active: !medication.is_active
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    // 更新药物提醒任务
    await taskScheduler.scheduleMedicationReminders(updatedMedication);

    res.status(200).json({
      success: true,
      data: {
        medication: updatedMedication
      }
    });
  } catch (error) {
    console.error('Toggle medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;