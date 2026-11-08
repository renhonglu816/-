import express from 'express';
import supabase from '../utils/supabase.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();
const CARE_PROFILE_MESSAGE_TYPE = 'care_profile';

const generateGroupCode = () => String(Math.floor(100000 + Math.random() * 900000));
const invitationIsActive = group => Date.now() - new Date(group.updated_at || group.created_at).getTime() < 24 * 60 * 60 * 1000;

const createUniqueCode = async () => {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const candidate = generateGroupCode();
    const { data } = await supabase.from('family_groups').select('id').eq('group_code', candidate).single();
    if (!data) return candidate;
  }
  return null;
};

const parseCareProfile = content => {
  try {
    const parsed = JSON.parse(content || '{}');
    const carePermission = parsed.care_permission === 'manager' ? 'manager' : 'viewer';
    return {
      relationship: String(parsed.relationship || '家属').trim().slice(0, 20) || '家属',
      remark: String(parsed.remark || '').trim().slice(0, 20),
      care_permission: carePermission
    };
  } catch (_error) {
    return { relationship: '家属', remark: '', care_permission: 'viewer' };
  }
};

const getCareProfile = async (parentId, childId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, content')
    .eq('type', CARE_PROFILE_MESSAGE_TYPE)
    .eq('from_user_id', childId)
    .eq('to_user_id', parentId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const record = data?.[0];
  return record ? { id: record.id, ...parseCareProfile(record.content) } : null;
};

const saveCareProfile = async (parentId, childId, changes = {}) => {
  const existing = await getCareProfile(parentId, childId);
  const profile = {
    relationship: String(changes.relationship ?? existing?.relationship ?? '家属').trim().slice(0, 20) || '家属',
    remark: String(changes.remark ?? existing?.remark ?? '').trim().slice(0, 20),
    care_permission: changes.care_permission === 'manager'
      ? 'manager'
      : (changes.care_permission === 'viewer' ? 'viewer' : (existing?.care_permission || 'viewer'))
  };
  if (existing?.id) {
    const { error } = await supabase
      .from('messages')
      .update({ content: JSON.stringify(profile) })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('messages').insert({
      from_user_id: childId,
      to_user_id: parentId,
      type: CARE_PROFILE_MESSAGE_TYPE,
      content: JSON.stringify(profile),
      is_read: true
    });
    if (error) throw error;
  }
  return profile;
};

const getCircle = async profile => {
  if (!profile.family_group_id) return null;
  const { data: group, error: groupError } = await supabase
    .from('family_groups')
    .select('*')
    .eq('id', profile.family_group_id)
    .single();
  if (groupError || !group) return null;

  const { data: members, error: memberError } = await supabase
    .from('profiles')
    .select('id, username, real_name, role, family_group_id, created_at')
    .eq('family_group_id', group.id);
  if (memberError) throw memberError;

  const parent = (members || []).find(member => member.role === 'parent') || null;
  let profilesByChildId = new Map();
  if (parent) {
    const { data: careProfiles, error: careProfileError } = await supabase
      .from('messages')
      .select('from_user_id, content, created_at')
      .eq('type', CARE_PROFILE_MESSAGE_TYPE)
      .eq('to_user_id', parent.id)
      .order('created_at', { ascending: false });
    if (careProfileError) throw careProfileError;
    profilesByChildId = new Map();
    (careProfiles || []).forEach(record => {
      if (!profilesByChildId.has(record.from_user_id)) {
        profilesByChildId.set(record.from_user_id, parseCareProfile(record.content));
      }
    });
  }

  const decoratedMembers = (members || []).map(member => {
    const careProfile = profilesByChildId.get(member.id);
    return {
      ...member,
      care_permission: member.role === 'parent' ? 'owner' : (careProfile?.care_permission || 'viewer'),
      relationship: member.role === 'child' ? (careProfile?.relationship || '家属') : null,
      family_remark: member.role === 'child' ? (careProfile?.remark || '') : null
    };
  });
  return {
    group,
    members: decoratedMembers,
    parent: decoratedMembers.find(member => member.role === 'parent') || null
  };
};

// 当前账号所属照护圈。未加入时返回 circle: null，便于前端直接判断。
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const circle = await getCircle(req.profile);
    res.status(200).json({ success: true, data: { circle } });
  } catch (error) {
    console.error('Get care circle error:', error);
    res.status(500).json({ success: false, error: '暂时无法读取照护圈' });
  }
});

// 长者创建照护圈；已经创建过时直接返回原照护圈，避免产生多个邀请码。
router.post('/create-group', authMiddleware, async (req, res) => {
  try {
    if (req.profile.role !== 'parent') {
      return res.status(403).json({ success: false, error: '只有长者账号可以创建照护圈' });
    }

    const existingCircle = await getCircle(req.profile);
    if (existingCircle) {
      if (!invitationIsActive(existingCircle.group)) {
        const refreshedCode = await createUniqueCode();
        if (!refreshedCode) return res.status(500).json({ success: false, error: '邀请码生成失败，请重试' });
        const { data: refreshedGroup, error: refreshError } = await supabase
          .from('family_groups')
          .update({ group_code: refreshedCode, updated_at: new Date().toISOString() })
          .eq('id', existingCircle.group.id)
          .select('*')
          .single();
        if (refreshError) throw refreshError;
        existingCircle.group = refreshedGroup;
      }
      return res.status(200).json({ success: true, data: { family_group: existingCircle.group, circle: existingCircle } });
    }

    const groupCode = await createUniqueCode();
    if (!groupCode) return res.status(500).json({ success: false, error: '邀请码生成失败，请重试' });

    const { data: familyGroup, error: createError } = await supabase
      .from('family_groups')
      .insert({ group_code: groupCode, created_by: req.profile.id })
      .select('*')
      .single();
    if (createError) throw createError;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ family_group_id: familyGroup.id })
      .eq('id', req.profile.id);
    if (updateError) throw updateError;

    const refreshedProfile = { ...req.profile, family_group_id: familyGroup.id };
    const circle = await getCircle(refreshedProfile);
    res.status(201).json({ success: true, data: { family_group: familyGroup, circle } });
  } catch (error) {
    console.error('Create care circle error:', error);
    res.status(500).json({ success: false, error: '照护圈创建失败，请稍后重试' });
  }
});

// 家属使用六位邀请码加入。一个家属账号同一时间只属于一个照护圈。
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const groupCode = String(req.body.group_code || '').trim();
    const relationship = String(req.body.relationship || '家属').trim().slice(0, 20);
    const carePermission = req.body.care_permission === 'manager' ? 'manager' : (req.body.care_permission === 'viewer' ? 'viewer' : '');
    if (req.profile.role !== 'child') {
      return res.status(403).json({ success: false, error: '只有家属账号可以加入照护圈' });
    }
    if (!/^\d{6}$/.test(groupCode)) {
      return res.status(400).json({ success: false, error: '请输入6位数字邀请码' });
    }
    if (!carePermission) {
      return res.status(400).json({ success: false, error: '请选择在照护圈中的权限角色' });
    }

    const { data: familyGroup, error: findError } = await supabase
      .from('family_groups')
      .select('*')
      .eq('group_code', groupCode)
      .single();
    if (findError || !familyGroup) {
      return res.status(404).json({ success: false, error: '邀请码无效或已经失效' });
    }
    if (!invitationIsActive(familyGroup)) {
      return res.status(410).json({ success: false, error: '邀请码已过期，请让长者重新生成' });
    }

    // 重复点击或网络重试时直接更新关系并返回，保证接口幂等。
    if (req.profile.family_group_id === familyGroup.id) {
      const { data: parent } = await supabase
        .from('profiles')
        .select('id')
        .eq('family_group_id', familyGroup.id)
        .eq('role', 'parent')
        .single();
      if (parent) await saveCareProfile(parent.id, req.profile.id, { relationship, care_permission: carePermission });
      const circle = await getCircle(req.profile);
      return res.status(200).json({
        success: true,
        data: {
          family_group: familyGroup,
          circle,
          membership: { relationship, care_permission: carePermission, already_joined: true }
        }
      });
    }

    const { data: members, error: membersError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('family_group_id', familyGroup.id);
    if (membersError) throw membersError;
    if (!(members || []).some(member => member.role === 'parent')) {
      return res.status(409).json({ success: false, error: '该照护圈暂时没有长者账号' });
    }
    if ((members || []).filter(member => member.role === 'child').length >= 5) {
      return res.status(409).json({ success: false, error: '这个照护圈的家属成员已满' });
    }

    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ family_group_id: familyGroup.id })
      .eq('id', req.profile.id)
      .select('*')
      .single();
    if (updateError || !updatedProfile || updatedProfile.family_group_id !== familyGroup.id) {
      throw updateError || new Error('绑定关系未能写入数据库');
    }

    const parent = (members || []).find(member => member.role === 'parent');
    await saveCareProfile(parent.id, req.profile.id, { relationship, care_permission: carePermission });

    const circle = await getCircle(updatedProfile);
    res.status(200).json({
      success: true,
      data: {
        family_group: familyGroup,
        circle,
        membership: { relationship, care_permission: carePermission }
      }
    });
  } catch (error) {
    console.error('Join care circle error:', error);
    res.status(500).json({ success: false, error: '暂时无法加入照护圈' });
  }
});

router.get('/members', authMiddleware, async (req, res) => {
  try {
    const circle = await getCircle(req.profile);
    if (!circle) return res.status(200).json({ success: true, data: { members: [], circle: null } });
    res.status(200).json({ success: true, data: { members: circle.members, circle } });
  } catch (error) {
    console.error('Get family members error:', error);
    res.status(500).json({ success: false, error: '暂时无法读取家庭成员' });
  }
});

// 长者可给家属设置自己看得懂的姓名备注；不改动对方账号资料。
router.put('/members/:memberId/profile', authMiddleware, async (req, res) => {
  try {
    if (req.profile.role !== 'parent' || !req.profile.family_group_id) {
      return res.status(403).json({ success: false, error: '只有照护圈长者可以修改成员备注' });
    }
    const remark = String(req.body.remark || '').trim().slice(0, 20);
    if (!remark) {
      return res.status(400).json({ success: false, error: '请输入家人的姓名或称呼' });
    }
    const { data: member, error: findError } = await supabase
      .from('profiles')
      .select('id, role, family_group_id')
      .eq('id', req.params.memberId)
      .single();
    if (findError || !member || member.family_group_id !== req.profile.family_group_id || member.role !== 'child') {
      return res.status(404).json({ success: false, error: '没有找到该家属成员' });
    }
    const profile = await saveCareProfile(req.profile.id, member.id, { remark });
    res.status(200).json({ success: true, data: { member: { ...member, ...profile, family_remark: profile.remark } } });
  } catch (error) {
    console.error('Update care circle member profile error:', error);
    res.status(500).json({ success: false, error: '暂时无法保存成员备注' });
  }
});

// 长者可以移除家属；不能通过此接口移除自己。
router.delete('/members/:memberId', authMiddleware, async (req, res) => {
  try {
    if (req.profile.role !== 'parent' || !req.profile.family_group_id) {
      return res.status(403).json({ success: false, error: '只有照护圈长者可以移除成员' });
    }
    const { data: member, error: findError } = await supabase
      .from('profiles')
      .select('id, role, family_group_id')
      .eq('id', req.params.memberId)
      .single();
    if (findError || !member || member.family_group_id !== req.profile.family_group_id || member.role !== 'child') {
      return res.status(404).json({ success: false, error: '没有找到该家属成员' });
    }
    const { error } = await supabase.from('profiles').update({ family_group_id: null }).eq('id', member.id);
    if (error) throw error;
    await supabase
      .from('messages')
      .delete()
      .eq('type', CARE_PROFILE_MESSAGE_TYPE)
      .eq('from_user_id', member.id)
      .eq('to_user_id', req.profile.id);
    res.status(200).json({ success: true, data: { removed_member_id: member.id } });
  } catch (error) {
    console.error('Remove care circle member error:', error);
    res.status(500).json({ success: false, error: '暂时无法移除成员' });
  }
});

export default router;
