import express from 'express';
const router = express.Router();
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

// 标记已吃药
router.post('/:logId/take', authMiddleware, async (req, res) => {
  try {
    const { logId } = req.params;

    // 获取提醒日志信息
    const { data: reminderLog, error: getError } = await supabase
      .from('reminder_logs')
      .select('medication_id')
      .eq('id', logId)
      .single();

    if (getError || !reminderLog) {
      return res.status(404).json({ error: 'Reminder log not found' });
    }

    // 获取药物信息，验证权限
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('user_id, created_by')
      .eq('id', reminderLog.medication_id)
      .single();

    if (medError || !medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    // 验证权限：只有药物所属用户或创建者可以标记
    if (medication.user_id !== req.profile.id && medication.created_by !== req.profile.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // 更新提醒日志状态
    const { data: updatedLog, error: updateError } = await supabase
      .from('reminder_logs')
      .update({
        status: 'taken',
        actual_taken_time: new Date().toISOString()
      })
      .eq('id', logId)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: {
        reminder_log: updatedLog
      }
    });
  } catch (error) {
    console.error('Mark medication taken error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 子女远程发送吃药提醒
router.post('/send/:medicationId', authMiddleware, async (req, res) => {
  try {
    const { medicationId } = req.params;

    // 验证用户角色是否为子女
    if (req.profile.role !== 'child') {
      return res.status(403).json({ error: 'Only children can send reminders' });
    }

    // 获取药物信息
    const { data: medication, error: medError } = await supabase
      .from('medications')
      .select('user_id, name')
      .eq('id', medicationId)
      .single();

    if (medError || !medication) {
      return res.status(404).json({ error: 'Medication not found' });
    }

    // 验证药物所属用户是否在同一家庭组
    const { data: parentUser, error: userError } = await supabase
      .from('profiles')
      .select('family_group_id')
      .eq('id', medication.user_id)
      .single();

    if (userError || !parentUser) {
      return res.status(404).json({ error: 'Parent user not found' });
    }

    if (parentUser.family_group_id !== req.profile.family_group_id) {
      return res.status(403).json({ error: 'Parent not in the same family group' });
    }

    // 创建提醒日志（status 用 CHECK 约束允许的值：pending/sent/taken/missed）
    const { data: reminderLog, error: logError } = await supabase
      .from('reminder_logs')
      .insert({
        medication_id: medicationId,
        scheduled_time: new Date().toISOString(),
        status: 'sent'
      })
      .select('*')
      .single();

    if (logError) {
      throw logError;
    }

    // 创建提醒消息
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        from_user_id: req.profile.id,
        to_user_id: medication.user_id,
        content: `请记得服用 ${medication.name}`,
        type: 'reminder',
        is_read: false
      });

    if (messageError) {
      console.error('Create message error:', messageError);
    }

    res.status(200).json({
      success: true,
      data: {
        reminder_log: reminderLog
      }
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取今日提醒列表
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let medicationIds = [];

    if (req.profile.role === 'child') {
      // 子女可以查看家庭组内所有父母的药物提醒
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
      const { data: medications, error: medsError } = await supabase
        .from('medications')
        .select('id')
        .in('user_id', parentIds)
        .eq('is_active', true);

      if (medsError) {
        throw medsError;
      }

      medicationIds = medications.map(med => med.id);
    } else {
      // 父母只能查看自己的药物提醒
      const { data: medications, error: medsError } = await supabase
        .from('medications')
        .select('id')
        .eq('user_id', req.profile.id)
        .eq('is_active', true);

      if (medsError) {
        throw medsError;
      }

      medicationIds = medications.map(med => med.id);
    }

    if (medicationIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          reminders: []
        }
      });
    }

    // 获取今日提醒日志
    const { data: reminders, error: remindersError } = await supabase
      .from('reminder_logs')
      .select('*')
      .in('medication_id', medicationIds)
      .gte('scheduled_time', today.toISOString())
      .lt('scheduled_time', tomorrow.toISOString());

    if (remindersError) {
      throw remindersError;
    }

    res.status(200).json({
      success: true,
      data: {
        reminders
      }
    });
  } catch (error) {
    console.error('Get today reminders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;