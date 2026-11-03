import express from 'express';
const router = express.Router();
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

// 获取留言列表（既包含我收到的，也包含我发出的）
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 用 OR 过滤：to_user_id=我 OR from_user_id=我
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .or(`to_user_id.eq.${req.profile.id},from_user_id.eq.${req.profile.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.status(200).json({
      success: true,
      data: {
        messages
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 发送留言
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { to_user_id, content, type } = req.body;

    if (!to_user_id || !content) {
      return res.status(400).json({ error: 'to_user_id and content are required' });
    }

    // 验证接收者是否存在
    const { data: recipient, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', to_user_id)
      .single();

    if (userError || !recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // 验证是否在同一家庭组（如果是子女发送给父母）
    if (req.profile.role === 'child') {
      const { data: recipientProfile, error: profileError } = await supabase
        .from('profiles')
        .select('family_group_id')
        .eq('id', to_user_id)
        .single();

      if (profileError || !recipientProfile) {
        return res.status(404).json({ error: 'Recipient profile not found' });
      }

      if (recipientProfile.family_group_id !== req.profile.family_group_id) {
        return res.status(403).json({ error: 'Recipient not in the same family group' });
      }
    }

    // 创建留言
    const { data: message, error: createError } = await supabase
      .from('messages')
      .insert({
        from_user_id: req.profile.id,
        to_user_id,
        content,
        type: type || 'text',
        is_read: false
      })
      .select('*')
      .single();

    if (createError) {
      throw createError;
    }

    res.status(201).json({
      success: true,
      data: {
        message
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 标记已读
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取留言信息
    const { data: message, error: getError } = await supabase
      .from('messages')
      .select('to_user_id')
      .eq('id', id)
      .single();

    if (getError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // 验证权限：只有接收者可以标记已读
    if (message.to_user_id !== req.profile.id) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // 标记已读
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({
        is_read: true
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json({
      success: true,
      data: {
        message: updatedMessage
      }
    });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;