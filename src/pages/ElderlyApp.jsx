import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, ChevronRight, ClipboardList, Clock, Copy, FileText, Info, Mic, Pill, Plus, RefreshCw, X, Save, User, Lock, LogOut, Shield, Users, MessageSquare } from 'lucide-react';
import NotificationModal from '../components/NotificationModal';
import MedicineScanner from '../components/elderly/MedicineScanner';
import MedicationReminder from '../components/elderly/MedicationReminder';
import MessageBoard from '../components/message/MessageBoard';
import SOSButton from '../components/elderly/SOSButton';
import SOSAlert from '../components/elderly/SOSAlert';
import AIMedicationAdvisor from '../components/elderly/AIMedicationAdvisor';
import MedicationReport from '../components/family/MedicationReport';
import RegistrationFlow from '../components/auth/RegistrationFlow';
import XiaoNuan from '../components/XiaoNuan';
import Logo from '../components/Logo';
import { ElderConnectionCard, ElderCreativeDashboard } from '../components/care/CareExperience';
import { useCrossWindowSync, SYNC_EVENTS } from '../hooks/useCrossWindowSync';
import dataAdapter from '../services/dataAdapter';
import { authAPI } from '../services/api';
import { brandAsset } from '../utils/assets';

const ElderlyApp = ({ onLogout }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');

  const [showVisionModal, setShowVisionModal] = useState(false);
  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false);
  const [showMedicationReminder, setShowMedicationReminder] = useState(false);
  const [currentReminderMedication, setCurrentReminderMedication] = useState(null);
  const [medications, setMedications] = useState([]);
  const [newMedication, setNewMedication] = useState({ time: '', name: '' });
  
  // 家庭组相关
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showInviteFamilyModal, setShowInviteFamilyModal] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  const [editingFamilyMemberId, setEditingFamilyMemberId] = useState(null);
  const [familyMemberRemark, setFamilyMemberRemark] = useState('');
  
  // 留言功能
  const [showMessageBoard, setShowMessageBoard] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const sessionUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const currentUserId = sessionUser.id || 'parent1';
  const currentChildId = familyMembers[0]?.id || 'child1';
  const [profileUsername, setProfileUsername] = useState(sessionUser.username || '');
  const [usernameDraft, setUsernameDraft] = useState(sessionUser.username || '');
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('elderlyProfileAvatar') || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileDetails, setProfileDetails] = useState(() => {
    try {
      return { gender: '', birthday: '', hometown: '', residence: '', tags: '', ...JSON.parse(localStorage.getItem('elderlyProfileDetails') || '{}') };
    } catch (_error) {
      return { gender: '', birthday: '', hometown: '', residence: '', tags: '' };
    }
  });
  const avatarInputRef = useRef(null);
  
  // SOS紧急求助功能
  const [showSOSAlert, setShowSOSAlert] = useState(false);
  
  // AI用药顾问
  const [showAIMedAdvisor, setShowAIMedAdvisor] = useState(false);
  
  // 服药行为记录
  const [showBehaviorRecord, setShowBehaviorRecord] = useState(false);
  const [showMyPage, setShowMyPage] = useState(false);
  const [myPageSection, setMyPageSection] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState('medication');

  const { sendMessage } = useCrossWindowSync();

  const openMyPage = () => {
    const latestUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const latestUsername = latestUser.username || username || '未设置用户名';
    setProfileUsername(latestUsername);
    setUsernameDraft(latestUsername);
    setProfileAvatar(localStorage.getItem('elderlyProfileAvatar') || '');
    setProfileMessage('');
    setShowProfileEditor(false);
    setMyPageSection(null);
    setShowVisionModal(false);
    setShowAIMedAdvisor(false);
    setActiveBottomTab('my');
    setShowMyPage(true);
  };

  const handleAvatarUpload = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMessage('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage('头像图片不能超过2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const avatar = String(reader.result || '');
        localStorage.setItem('elderlyProfileAvatar', avatar);
        setProfileAvatar(avatar);
        setProfileMessage('头像已保存');
      } catch (_error) {
        setProfileMessage('头像保存失败，请选择更小的图片');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfileUsername = async () => {
    const nextUsername = usernameDraft.trim();
    if (!nextUsername) {
      setProfileMessage('用户名不能为空');
      return false;
    }
    if (nextUsername === profileUsername) {
      return true;
    }
    setIsSavingProfile(true);
    setProfileMessage('');
    try {
      const res = await authAPI.updateProfile({ username: nextUsername });
      if (!res.success) throw new Error(res.error || '修改失败');
      setProfileUsername(res.data.user.username);
      setUsernameDraft(res.data.user.username);
      setUsername(res.data.user.username);
      setProfileMessage('用户名已修改，下次请使用新用户名登录');
      return true;
    } catch (error) {
      setProfileMessage(error.response?.data?.error || error.message || '暂时无法修改用户名');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const openProfileEditor = () => {
    setUsernameDraft(profileUsername || '');
    try {
      setProfileDetails({ gender: '', birthday: '', hometown: '', residence: '', tags: '', ...JSON.parse(localStorage.getItem('elderlyProfileDetails') || '{}') });
    } catch (_error) {
      setProfileDetails({ gender: '', birthday: '', hometown: '', residence: '', tags: '' });
    }
    setProfileMessage('');
    setShowProfileEditor(true);
  };

  const saveProfileDetails = async event => {
    event.preventDefault();
    const usernameSaved = await saveProfileUsername();
    if (!usernameSaved) return;
    localStorage.setItem('elderlyProfileDetails', JSON.stringify(profileDetails));
    setProfileMessage('资料已保存');
    setShowProfileEditor(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('elderlyToken');
    if (token) {
      const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (storedUser.id) {
        localStorage.setItem('currentElderlyId', storedUser.id);
        localStorage.setItem('elderlyName', storedUser.real_name || storedUser.username || '长者');
      }
      setIsLoggedIn(true);
      // 先加载药品数据和家庭组成员，再设置showWelcome为false
      loadMedicationData();
      loadFamilyMembers();
      setShowWelcome(false);
    } else {
      setShowWelcome(true);
      // 未登录状态也加载药品数据
      loadMedicationData();
    }
  }, []);

  // 监听 localStorage 变化，实现跨标签页/浏览器同步
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && (e.key.startsWith('medications_') || e.key.startsWith('notifications_') || e.key.startsWith('messages_'))) {
        loadMedicationData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 同时使用定时器定期检查（备用方案）
    const interval = setInterval(() => {
      const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
      const currentData = JSON.stringify(medications);
      const storedData = localStorage.getItem(`medications_${elderlyId}`);
      if (storedData && currentData !== storedData) {
        loadMedicationData();
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [medications]);

  // 当药品数据加载后，开始检查提醒
  useEffect(() => {
    if (medications.length > 0) {
      const cleanup = startMedicationReminderCheck();
      return cleanup;
    }
  }, [medications.length]);

  // 开始服药提醒检查
  const startMedicationReminderCheck = () => {
    // 立即检查一次
    checkMedicationReminders();
    
    // 每分钟检查一次
    const interval = setInterval(() => {
      checkMedicationReminders();
    }, 60 * 1000);

    return () => clearInterval(interval);
  };

  // 检查服药提醒
  const checkMedicationReminders = () => {
    const now = new Date();
    // 获取24小时制时间，格式 HH:MM
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    medications.forEach(medication => {
      if (medication.time === currentTime && medication.status === 'pending') {
        handleMedicationReminder(medication);
      }
    });
  };

  // 检查超时未服用的药品
  useEffect(() => {
    const checkMedicationTimeout = async () => {
      const now = new Date();
      const newlyMissed = [];
      
      const updatedMedications = medications.map(med => {
        if (med.status === 'pending') {
          const [hours, minutes] = med.time.split(':').map(Number);
          const medTime = new Date();
          medTime.setHours(hours, minutes, 0, 0);
          
          // 检查是否超时30分钟
          const timeDiff = now - medTime;
          const minutesDiff = timeDiff / (1000 * 60);
          
          if (minutesDiff >= 30) {
            // 标记为未服用，并记录哪些是刚漏服的
            newlyMissed.push(med);
            return { ...med, status: 'missed' };
          }
        }
        return med;
      });
      
      // 检查是否有变化
      const hasChanges = JSON.stringify(updatedMedications) !== JSON.stringify(medications);
      if (hasChanges) {
        setMedications(updatedMedications);
        
        // 为每个刚漏服的药品触发子女端提醒
        await Promise.all(newlyMissed.map(async missedMed => {
          try {
            await dataAdapter.updateMedication(missedMed.id, { status: 'missed' });
          } catch (error) {
            console.warn('同步逾期状态失败，稍后重试:', error);
          }
          triggerChildReminder(missedMed);
        }));
      }
    };

    // 每分钟检查一次
    const interval = setInterval(checkMedicationTimeout, 60000);
    
    return () => clearInterval(interval);
  }, [medications]);

  const loadMedicationData = async () => {
    try {
      const res = await dataAdapter.getMedications();
      if (res.success && res.data?.medications) {
        setMedications(res.data.medications);
      } else {
        setMedications([]);
      }
    } catch (e) {
      console.warn('加载用药失败，回退到本地:', e);
      const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
      const storedMedications = localStorage.getItem(`medications_${elderlyId}`);
      if (storedMedications) {
        setMedications(JSON.parse(storedMedications));
      }
    }
  };

  const handleLogin = async () => {
    
    try {
      // 尝试调后端 auth/login（mock 模式也支持）
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'parent' })
      });
      const json = await res.json();
      if (json.success && json.data) {
        // 存 token（api.js 拦截器读 authToken；同时存 elderlyToken 兼容旧逻辑）
        localStorage.setItem('authToken', json.data.token);
        localStorage.setItem('elderlyToken', json.data.token);
        // 存 UUID user_id（后端 medications 表 user_id 列需要 UUID 类型）
        localStorage.setItem('userId', json.data.user.id);
        localStorage.setItem('elderlyName', json.data.user.real_name || username);
        localStorage.setItem('currentElderlyId', json.data.user.id);
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setLoginError('');
        await loadMedicationData();
        loadFamilyMembers();
        return;
      }
    } catch (e) {
      console.warn('后端登录不可用，回退本地登录:', e);
    }

    // 回退：纯本地登录（没有后端时也能用）
    const users = JSON.parse(localStorage.getItem('elderlyUsers') || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    if (user || (username === 'testuser' && password === '123456')) {
      const fallbackUser = user || { username: 'testuser', elderlyId: 'ELDTEST123456' };
      const mockToken = 'mock-token-' + Date.now();
      localStorage.setItem('elderlyToken', mockToken);
      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('currentElderlyId', fallbackUser.elderlyId);
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setLoginError('');
      loadMedicationData();
      loadFamilyMembers();
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setRegisterError('两次输入的密码不一致');
      return;
    }

    if (!realName.trim()) {
      setRegisterError('请填写希望家人看到的称呼');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setRegisterError('密码至少 8 位，并同时包含字母和数字');
      return;
    }

    try {
      // 优先调后端 auth/register
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, real_name: realName, role: 'parent' })
      });
      const json = await res.json();
      if (json.success && json.data) {
        // 自动登录
        localStorage.setItem('authToken', json.data.token);
        localStorage.setItem('elderlyToken', json.data.token);
        localStorage.setItem('userId', json.data.user.id);
        localStorage.setItem('elderlyName', json.data.user.real_name || realName);
        localStorage.setItem('currentElderlyId', json.data.user.id);
        setShowRegisterModal(false);
        setRegisterError('');
        setIsLoggedIn(true);
        return;
      }
    } catch (e) {
      console.warn('后端注册不可用，回退本地:', e);
    }

    // 回退：纯本地注册
    const users = JSON.parse(localStorage.getItem('elderlyUsers') || '[]');
    if (users.some(u => u.username === username)) {
      setRegisterError('用户名已存在');
      return;
    }

    const newElderlyId = 'ELD' + Date.now().toString().slice(-10);
    users.push({ username, password, realName, elderlyId: newElderlyId });
    localStorage.setItem('elderlyUsers', JSON.stringify(users));
    setShowRegisterModal(false);
    setRegisterError('');
    handleLogin();
  };

  const handleLogout = () => {
    localStorage.removeItem('elderlyToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentElderlyId');
    localStorage.removeItem('userId');
    localStorage.removeItem('elderlyName');
    localStorage.removeItem('currentUser');
    setIsLoggedIn(false);
    setShowWelcome(true);
    onLogout?.();
  };

  const handleAddMedication = async () => {
    if (!newMedication.time || !newMedication.name) return;

    const userId = localStorage.getItem('userId') || localStorage.getItem('currentElderlyId');
    const payload = {
      user_id: userId,
      name: newMedication.name,
      dosage: newMedication.dosage || '未知',
      time: newMedication.time,
      usage: newMedication.usage || '',
      effect: newMedication.effect || '',
      frequency: newMedication.frequency || '',
      reminder_times: [newMedication.time],
      is_active: true
    };

    try {
      const res = await dataAdapter.createMedication(payload);
      if (res.success && res.data?.medication) {
        setMedications(prev => [...prev, res.data.medication]);
      } else {
        throw new Error(res.error || '添加失败');
      }
    } catch (e) {
      // 回退：本地 mock
      const localMed = { id: Date.now(), status: 'pending', ...payload };
      setMedications(prev => [...prev, localMed]);
      console.warn('后端添加失败，回退本地:', e);
    }
    setNewMedication({ time: '', name: '' });
    setShowAddMedicationModal(false);
  };

  // 处理服药提醒
  const handleMedicationReminder = (medication) => {
    setCurrentReminderMedication(medication);
    setShowMedicationReminder(true);
  };

  // 确认服药
  const handleConfirmMedication = async () => {
    if (currentReminderMedication) {
      const newStatus = 'taken';
      const takenTime = new Date().toISOString();
      try {
        await dataAdapter.updateMedication(currentReminderMedication.id, {
          status: newStatus,
          taken_time: takenTime
        });
      } catch (e) {
        console.warn('后端更新失败:', e);
      }
      setMedications(prev => prev.map(med =>
        med.id === currentReminderMedication.id
          ? { ...med, status: newStatus, takenTime }
          : med
      ));
    }
    setShowMedicationReminder(false);
    setCurrentReminderMedication(null);
  };

  // 稍后提醒
  const handleSnoozeMedication = () => {
    setShowMedicationReminder(false);
    // 5分钟后再次提醒
    setTimeout(() => {
      setCurrentReminderMedication(currentReminderMedication);
      setShowMedicationReminder(true);
    }, 5 * 60 * 1000);
  };

  const handleToggleMedicationStatus = async (id) => {
    const target = medications.find(m => m.id === id);
    const nextStatus = target?.status === 'taken' ? 'pending' : 'taken';
    const takenTime = nextStatus === 'taken' ? new Date().toISOString() : null;

    try {
      await dataAdapter.updateMedication(id, { status: nextStatus, taken_time: takenTime });
    } catch (e) {
      console.warn('后端更新失败:', e);
    }

    setMedications(prev => prev.map(med =>
      med.id === id
        ? {
            ...med,
            status: nextStatus,
            takenTime: nextStatus === 'taken'
              ? new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              : null
          }
        : med
    ));

    // 发送同步消息
    const changedMed = medications.find(med => med.id === id);
    if (changedMed) {
      sendMessage(SYNC_EVENTS.MEDICATION_TAKEN, {
        medicationId: id,
        status: nextStatus,
        takenTime,
        medicationName: changedMed.name,
        medicationTime: changedMed.time,
        timestamp: new Date().toISOString()
      });

      sendMessage(SYNC_EVENTS.DATA_REFRESH, { 
        type: 'medication', 
        timestamp: new Date().toISOString() 
      });
    }
  };

  // 触发子女端提醒
  const triggerChildReminder = (missedMed) => {
    const elderlyId = localStorage.getItem('currentElderlyId');
    const elderlyName = localStorage.getItem('elderlyName') || '老人';
    
    if (elderlyId && missedMed) {
      // 创建漏服提醒，类似SOS的格式
      const missedAlert = {
        id: Date.now(),
        type: 'missed',
        elderlyId,
        elderlyName,
        medicationName: missedMed.name,
        medicationTime: missedMed.time,
        message: `⚠️ ${elderlyName}的药品漏服：${missedMed.name}（${missedMed.time}），请及时提醒！`,
        timestamp: new Date().toISOString(),
        read: false
      };

      // 发送给子女端 - 使用和SOS相同的机制
      // 先检查是否有绑定的长者关系
      const boundElderlyKey = 'boundElderly';
      const boundElderly = JSON.parse(localStorage.getItem(boundElderlyKey) || 'null');
      if (boundElderly && boundElderly.childUsername) {
        const notificationsKey = `notifications_${boundElderly.childUsername}`;
        const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');
        notifications.push(missedAlert);
        localStorage.setItem(notificationsKey, JSON.stringify(notifications));
      } else {
        // 如果没有绑定，尝试发送给测试账号
        const testKey = 'notifications_testchild';
        const notifications = JSON.parse(localStorage.getItem(testKey) || '[]');
        notifications.push(missedAlert);
        localStorage.setItem(testKey, JSON.stringify(notifications));
      }
      
      // 同时也保存到家庭组成员
      if (familyMembers.length > 0) {
        familyMembers.forEach(member => {
          const memberKey = `notifications_${member.username}`;
          const memberNotifications = JSON.parse(localStorage.getItem(memberKey) || '[]');
          memberNotifications.push(missedAlert);
          localStorage.setItem(memberKey, JSON.stringify(memberNotifications));
        });
      }
    }
  };

  // 处理扫描药盒后的添加逻辑
  const handleVisionAddMedication = (medInfo) => {
    if (isLoggedIn) {
      // 识别结果由长者本人核对时间与剂量，保存后直接加入用药计划。
      setNewMedication({
        time: '',
        name: medInfo.name,
        dosage: medInfo.dosage || '',
        usage: medInfo.usage || '',
        effect: medInfo.effect || '',
        frequency: medInfo.frequency || ''
      });
      setShowVisionModal(false);
      setActiveBottomTab('medication');
      setShowAddMedicationModal(true);
    } else {
      // 未登录状态，弹出登录弹窗
      setShowWelcome(false);
      setShowLoginModal(true);
    }
  };
  
  // 生成邀请码
  const generateInvitationCode = async () => {
    try {
      const res = await dataAdapter.createFamilyGroup();
      const group = res.data?.family_group;
      if (!res.success || !group?.group_code) throw new Error(res.error || '邀请码生成失败');
      setInvitationCode(group.group_code);
      setInvitationLink(`${window.location.origin}?invite=${group.group_code}`);
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, family_group_id: group.id }));
      await loadFamilyMembers();
      return group.group_code;
    } catch (error) {
      console.error('创建照护圈失败:', error);
      alert(error.response?.data?.error || error.message || '暂时无法创建照护圈');
      return null;
    }
  };
  
  // 加载家庭组成员
  const loadFamilyMembers = async () => {
    try {
      const res = await dataAdapter.getFamilyMembers();
      if (res.success) {
        const members = (res.data?.members || []).filter(member => member.role === 'child');
        setFamilyMembers(members);
        const code = res.data?.circle?.group?.group_code;
        if (code) {
          setInvitationCode(code);
          setInvitationLink(`${window.location.origin}?invite=${code}`);
        }
      }
    } catch (error) {
      console.warn('读取照护圈失败:', error);
      setFamilyMembers([]);
    }
  };
  
  // 移除家庭成员
  const removeFamilyMember = async (memberId) => {
    if (!window.confirm('确定将这位家属移出照护圈吗？移除后对方将无法继续查看您的用药信息。')) return;
    try {
      const res = await dataAdapter.removeFamilyMember(memberId);
      if (!res.success) throw new Error(res.error || '移除失败');
      await loadFamilyMembers();
    } catch (error) {
      alert(error.response?.data?.error || error.message || '暂时无法移除成员');
    }
  };

  const getFamilyMemberName = member => {
    if (member.family_remark) return member.family_remark;
    if (member.real_name && member.real_name !== member.username) return member.real_name;
    return '未备注姓名';
  };

  const saveFamilyMemberRemark = async memberId => {
    const remark = familyMemberRemark.trim();
    if (!remark) {
      alert('请输入家人的姓名或称呼');
      return;
    }
    try {
      const res = await dataAdapter.updateFamilyMemberProfile(memberId, { remark });
      if (!res.success) throw new Error(res.error || '保存失败');
      setFamilyMembers(current => current.map(member => (
        member.id === memberId ? { ...member, family_remark: remark } : member
      )));
      setEditingFamilyMemberId(null);
      setFamilyMemberRemark('');
    } catch (error) {
      alert(error.response?.data?.error || error.message || '暂时无法保存备注');
    }
  };
  
  // 复制邀请链接
  const copyInvitationLink = () => {
    navigator.clipboard.writeText(invitationLink).then(() => {
      alert('邀请链接已复制到剪贴板');
    }).catch(err => {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="w-full min-h-screen bg-light flex items-center justify-center p-4">
        {showWelcome && (
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-lg w-full text-center">
            <h1 className="elderly-title text-primary mb-3 sm:mb-4">药记得</h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8">您的智能用药助手</p>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div
                className="p-4 sm:p-6 bg-blue-50 rounded-xl cursor-pointer hover:bg-blue-100 transition min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center"
                onClick={() => {
                  setShowWelcome(false);
                  setShowVisionModal(true);
                }}
              >
                <Camera className="w-12 h-12 sm:w-16 sm:h-16 text-primary mx-auto mb-2 sm:mb-3" />
                <p className="text-base sm:text-lg font-medium">拍药盒</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">智能识别药品</p>
              </div>
              <div
                className="p-4 sm:p-6 bg-purple-50 rounded-xl cursor-pointer hover:bg-purple-100 transition min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center"
                onClick={() => {
                  setShowWelcome(false);
                  setShowAIMedAdvisor(true);
                }}
              >
                <Mic className="w-12 h-12 sm:w-16 sm:h-16 text-purple-600 mx-auto mb-2 sm:mb-3" />
                <p className="text-base sm:text-lg font-medium text-purple-600">AI用药顾问</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">药物相互作用分析</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-5 sm:mb-6">
                <p className="text-base sm:text-lg text-gray-700 mb-2">
                  <Shield className="inline mr-2 text-primary w-5 h-5" />
                  实名认证保障安全
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mb-2">
                  完成实名认证后，可享受完整服务<br className="hidden sm:block" /> 子女可远程守护您的用药健康
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  <strong>无需登录即可使用：</strong>拍药盒和AI用药顾问功能无需注册登录，可直接使用
                </p>
              </div>

            <button
              onClick={() => {
                setShowWelcome(false);
                setShowLoginModal(true);
              }}
              className="elderly-button bg-primary text-white w-full mb-3 sm:mb-4"
            >
              登录 / 注册
            </button>

            <p className="text-xs sm:text-sm text-gray-400">
              登录后可保存用药记录，家人可查看您的服药情况
            </p>
          </div>
        )}

        {showLoginModal && !showRegisterModal && !showWelcome && (
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 max-w-md w-full mx-2 sm:mx-4">
            <div className="text-center mb-5 sm:mb-6">
              <h1 className="elderly-title text-primary">药记得</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-2">长者端登录</p>
            </div>

            {loginError && (
              <div className="bg-red-100 text-danger p-3 sm:p-4 rounded-lg mb-5">
                {loginError}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">用户名</label>
                <div className="relative">
                  <User size={20} className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">密码</label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button onClick={handleLogin} className="elderly-button bg-primary text-white">
                登录
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowRegisterModal(true);
                  }}
                  className="text-primary text-base sm:text-lg hover:underline min-h-[40px] sm:min-h-[44px] inline-flex items-center"
                >
                  还没有账号？立即注册
                </button>
              </div>

              <div className="text-center mt-3 sm:mt-4">
                <button
                  onClick={() => {
                    setShowWelcome(true);
                    setShowLoginModal(false);
                    setShowRegisterModal(false);
                  }}
                  className="text-gray-500 text-base sm:text-lg hover:underline min-h-[40px] sm:min-h-[44px] inline-flex items-center"
                >
                  返回首页先了解一下
                </button>
              </div>
            </div>
          </div>
        )}

        {showRegisterModal && !showWelcome && (
          <RegistrationFlow
            role="parent"
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            realName={realName}
            setRealName={setRealName}
            error={registerError}
            onSubmit={handleRegister}
            onLogin={() => {
              setRegisterError('');
              setShowRegisterModal(false);
              setShowLoginModal(true);
            }}
            onExplore={() => {
              setRegisterError('');
              setShowWelcome(true);
              setShowLoginModal(false);
              setShowRegisterModal(false);
            }}
          />
        )}

        {/* 未登录时也渲染模态框组件，确保未认证用户可以使用 */}
        <MedicineScanner
          isOpen={showVisionModal}
          onClose={() => {
            setShowVisionModal(false);
            if (!showLoginModal && !showRegisterModal) {
              setShowWelcome(true);
            }
          }}
          onAddMedication={handleVisionAddMedication}
          isLoggedIn={isLoggedIn}
        />



        <AIMedicationAdvisor
          isOpen={showAIMedAdvisor}
          onClose={() => {
            setShowAIMedAdvisor(false);
            if (!showLoginModal && !showRegisterModal) {
              setShowWelcome(true);
            }
          }}
          currentMedications={medications}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col">
      <NotificationModal />
      
      {/* 顶部区域 */}
      {activeBottomTab === 'medication' && (
        <div className="elder-medication-page w-full flex flex-col items-center pb-28">
          <ElderCreativeDashboard
            medications={medications}
            onToggle={handleToggleMedicationStatus}
            onAddMedication={() => setShowAddMedicationModal(true)}
            onScanMedication={() => setShowVisionModal(true)}
            emergencyAction={<SOSButton variant="header" onTrigger={() => setShowSOSAlert(true)} />}
          />
        </div>
      )}

      {/* 底部导航栏 - 固定在底部 */}
      {!showAIMedAdvisor && <div className="care-bottom-nav care-bottom-nav--elder fixed bottom-0 left-0 right-0 glass border-t shadow-lg z-40">
        <div className="care-bottom-nav__items care-bottom-nav__items--elder">
          <button
            type="button"
            onClick={() => {
              setShowMyPage(false);
              setShowVisionModal(false);
              setShowAIMedAdvisor(false);
              setActiveBottomTab('medication');
            }}
            className={`care-nav-button ${activeBottomTab === 'medication' ? 'is-active' : ''}`}
          >
            <span className="care-nav-button__icon care-nav-button__icon--medication"><Pill size={24} /></span>
            <strong>今日用药</strong>
          </button>

          {/* AI用药顾问 */}
          <button
            type="button"
            onClick={() => {
              setShowMyPage(false);
              setShowVisionModal(false);
              setActiveBottomTab('advisor');
              setShowAIMedAdvisor(true);
            }}
            className={`care-nav-button care-nav-button--advisor ${activeBottomTab === 'advisor' ? 'is-active' : ''}`}
          >
            <span className="care-nav-button__icon care-nav-button__icon--advisor"><img src={brandAsset('yaoxiaonuan-nav-cropped.png')} alt="" /></span>
            <strong>问小暖</strong>
          </button>

          {/* 我的 */}
          <button
            onClick={openMyPage}
            className={`care-nav-button ${activeBottomTab === 'my' ? 'is-active' : ''}`}
          >
            <span className="care-nav-button__icon care-nav-button__icon--my"><User size={25} /></span>
            <strong>我的</strong>
            {messageUnreadCount > 0 && (
              <span className="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                {messageUnreadCount}
              </span>
            )}
          </button>
        </div>
      </div>}

      {showMyPage && (
        <div className="my-page feature-page">
          <header className="my-page__header">
            <h1>我的</h1>
          </header>

          <main className="my-page__content">
            <button type="button" className="my-profile-card my-profile-card--entry" onClick={openProfileEditor} aria-label="编辑个人资料">
              <span className="my-profile-card__avatar">
                <img src={profileAvatar || brandAsset('default-profile-avatar.png')} alt={profileAvatar ? '我的头像' : '默认头像'} />
              </span>
              <div className="my-profile-card__identity">
                <strong>{profileUsername || '未设置用户名'}</strong>
                {profileMessage && <p className="my-profile-card__message">{profileMessage}</p>}
              </div>
              <ChevronRight size={24} className="my-profile-card__chevron" />
            </button>

            <section className="my-menu-card" aria-label="我的功能">
              <button type="button" onClick={() => {
                setShowMyPage(false);
                setShowFamilyModal(true);
              }}>
                <span className="my-menu-card__icon my-menu-card__icon--family"><Users size={24} /></span>
                <strong>家人</strong>
                {messageUnreadCount > 0 && <em>{messageUnreadCount}</em>}
                <ChevronRight size={23} />
              </button>
              <button type="button" onClick={() => {
                setShowMyPage(false);
                setShowBehaviorRecord(true);
              }}>
                <span className="my-menu-card__icon my-menu-card__icon--record"><ClipboardList size={24} /></span>
                <strong>用药报告</strong>
                <ChevronRight size={23} />
              </button>
              <button type="button" onClick={() => setMyPageSection(current => current === 'about' ? null : 'about')}>
                <span className="my-menu-card__icon my-menu-card__icon--about"><Info size={24} /></span>
                <strong>关于我们</strong>
                <ChevronRight size={23} className={myPageSection === 'about' ? 'is-open' : ''} />
              </button>
              {myPageSection === 'about' && (
                <div className="my-menu-detail">
                  <Logo size="small" />
                  <h2>关于药记得</h2>
                  <p>药记得是一款面向长者与家人的用药管理工具，帮助记录每日计划、确认服药状态，并让家人及时了解照护情况。</p>
                </div>
              )}
              <button type="button" onClick={() => setMyPageSection(current => current === 'privacy' ? null : 'privacy')}>
                <span className="my-menu-card__icon my-menu-card__icon--privacy"><FileText size={24} /></span>
                <strong>隐私政策</strong>
                <ChevronRight size={23} className={myPageSection === 'privacy' ? 'is-open' : ''} />
              </button>
              {myPageSection === 'privacy' && (
                <div className="my-menu-detail">
                  <h2>隐私政策</h2>
                  <p>我们仅使用提供服务所必需的账号、用药计划与照护圈信息。您的用药信息只向同一照护圈内已绑定的成员展示，不会用于无关用途。</p>
                </div>
              )}
              <button type="button" onClick={() => setShowLogoutConfirm(true)}>
                <span className="my-menu-card__icon my-menu-card__icon--logout"><LogOut size={24} /></span>
                <strong>退出账号</strong>
                <ChevronRight size={23} />
              </button>
            </section>
          </main>
        </div>
      )}

      {showProfileEditor && (
        <div className="profile-editor-page" role="dialog" aria-modal="true" aria-label="编辑资料">
          <header className="profile-editor-page__header">
            <button type="button" onClick={() => setShowProfileEditor(false)} aria-label="返回我的"><ArrowLeft size={25} /></button>
            <h1>编辑资料</h1>
            <span aria-hidden="true" />
          </header>
          <form className="profile-editor-page__content" onSubmit={saveProfileDetails}>
            <div className="profile-editor-avatar">
              <button type="button" onClick={() => avatarInputRef.current?.click()} aria-label="更换头像">
                <img src={profileAvatar || brandAsset('default-profile-avatar.png')} alt="当前头像" />
                <span><Camera size={18} />更换头像</span>
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} hidden />
            </div>

            <section className="profile-editor-fields" aria-label="个人资料">
              <label className="profile-editor-row">
                <span>用户名</span>
                <input value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value.slice(0, 20))} placeholder="请输入用户名" />
              </label>
              <div className="profile-editor-row is-readonly">
                <span>账号ID</span>
                <strong>{sessionUser.elderlyId || sessionUser.elderly_id || sessionUser.id || '—'}</strong>
              </div>
              <label className="profile-editor-row">
                <span>性别</span>
                <select value={profileDetails.gender} onChange={(event) => setProfileDetails(current => ({ ...current, gender: event.target.value }))}>
                  <option value="">请选择</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                  <option value="保密">保密</option>
                </select>
              </label>
              <label className="profile-editor-row">
                <span>生日</span>
                <input type="date" value={profileDetails.birthday} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setProfileDetails(current => ({ ...current, birthday: event.target.value }))} />
              </label>
              <label className="profile-editor-row">
                <span>家乡</span>
                <input value={profileDetails.hometown} onChange={(event) => setProfileDetails(current => ({ ...current, hometown: event.target.value.slice(0, 30) }))} placeholder="请输入家乡" />
              </label>
              <label className="profile-editor-row">
                <span>常居地</span>
                <input value={profileDetails.residence} onChange={(event) => setProfileDetails(current => ({ ...current, residence: event.target.value.slice(0, 30) }))} placeholder="请输入常居地" />
              </label>
              <label className="profile-editor-row">
                <span>我的标签</span>
                <input value={profileDetails.tags} onChange={(event) => setProfileDetails(current => ({ ...current, tags: event.target.value.slice(0, 40) }))} placeholder="例如：爱散步、喜欢听戏" />
              </label>
            </section>

            {profileMessage && <p className="profile-editor-message" role="status">{profileMessage}</p>}
            <button type="submit" className="profile-editor-save" disabled={isSavingProfile}>{isSavingProfile ? '保存中…' : '保存修改'}</button>
          </form>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="logout-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title" onClick={() => setShowLogoutConfirm(false)}>
          <section className="logout-confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="logout-confirm-dialog__close" onClick={() => setShowLogoutConfirm(false)} aria-label="关闭退出确认"><X size={22} /></button>
            <span className="logout-confirm-dialog__icon"><LogOut size={30} /></span>
            <h2 id="logout-confirm-title">确认退出账号？</h2>
            <p>退出后需要重新输入用户名和密码才能进入。</p>
            <div className="logout-confirm-dialog__actions">
              <button type="button" onClick={() => setShowLogoutConfirm(false)}>取消</button>
              <button type="button" className="is-danger" onClick={() => {
                setShowLogoutConfirm(false);
                handleLogout();
              }}>确认退出</button>
            </div>
          </section>
        </div>
      )}

      {showAddMedicationModal && (
        <div className="add-medication-layer" role="presentation">
          <section className="add-medication-modal" role="dialog" aria-modal="true" aria-labelledby="add-medication-title">
            <header className="add-medication-modal__header">
              <span className="add-medication-modal__mark" aria-hidden="true"><Pill size={25} /></span>
              <div>
                <h2 id="add-medication-title">添加用药</h2>
                <p>填写今天需要服用的药品</p>
              </div>
              <button type="button" onClick={() => setShowAddMedicationModal(false)} aria-label="关闭添加用药"><X size={24} /></button>
            </header>

            <div className="add-medication-modal__body">
              <label className="add-medication-field">
                <span><Clock size={21} />用药时间</span>
                <small>请选择计划服药的具体时间</small>
                <input
                  type="time"
                  value={newMedication.time}
                  onChange={(e) => setNewMedication({ ...newMedication, time: e.target.value })}
                />
              </label>

              <label className="add-medication-field">
                <span><Pill size={21} />药品名称</span>
                <small>请填写药盒或处方上的名称</small>
                <input
                  type="text"
                  value={newMedication.name}
                  onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                  placeholder="例如：阿司匹林"
                />
              </label>

              <label className="add-medication-field">
                <span><FileText size={21} />每次剂量</span>
                <small>填写数量和单位，方便家人核对</small>
                <input
                  type="text"
                  value={newMedication.dosage || ''}
                  onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                  placeholder="例如：1片、500mg"
                />
              </label>

              <button type="button" onClick={handleAddMedication} className="add-medication-save">
                <Save size={22} />
                保存用药计划
              </button>
            </div>
          </section>
        </div>
      )}

      <MedicineScanner
        isOpen={showVisionModal}
        pageMode
        onClose={() => {
          setShowVisionModal(false);
          setActiveBottomTab('medication');
        }}
        onAddMedication={handleVisionAddMedication}
        isLoggedIn={isLoggedIn}
      />



      <MedicationReminder
        isOpen={showMedicationReminder}
        onClose={() => setShowMedicationReminder(false)}
        medication={currentReminderMedication}
        onConfirm={handleConfirmMedication}
        onSnooze={handleSnoozeMedication}
      />
      
      {/* 家人页面 */}
      {showFamilyModal && (
        <div className="elder-family-page" role="dialog" aria-modal="true" aria-label="我的家人">
          <div className="elder-family-page__surface">
            <header className="elder-family-page__header">
              <button type="button"
                onClick={() => {
                  setShowInviteFamilyModal(false);
                  setShowFamilyModal(false);
                  openMyPage();
                }}
                aria-label="返回我的"
              >
                <ArrowLeft size={24} />
              </button>
              <h2>我的家人</h2>
            </header>
            
            <main className="elder-family-page__content">
              <div className="mb-5">
                <ElderConnectionCard
                  familyRecipientId={familyMembers[0]?.id}
                  familyMembers={familyMembers.map(member => ({ id: member.id, name: getFamilyMemberName(member) }))}
                  currentUserId={currentUserId}
                  onOpenMessages={() => { setShowFamilyModal(false); setShowMessageBoard(true); }}
                />
              </div>

              {/* 打开后先看到家庭成员 */}
              <div className="mb-6">
                <div className="family-members-heading">
                  <h3>家庭成员</h3>
                  <button type="button" onClick={() => {
                    setShowInviteFamilyModal(true);
                    if (!invitationCode) generateInvitationCode();
                  }} className="invite-family-trigger">
                    <Plus size={19} />
                    邀请家人
                  </button>
                </div>
                {familyMembers.length === 0 ? (
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <XiaoNuan size="small" pose="wave" />
                    <p className="text-gray-500">暂无家庭成员</p>
                    <p className="text-sm text-gray-400 mt-2">点击“邀请家人”，即可分享邀请码</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {familyMembers.map(member => (
                      <div key={member.id} className="rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                        {editingFamilyMemberId === member.id ? (
                          <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">给这位家人备注姓名</label>
                            <input
                              value={familyMemberRemark}
                              onChange={(event) => setFamilyMemberRemark(event.target.value.slice(0, 20))}
                              onKeyDown={(event) => event.key === 'Enter' && saveFamilyMemberRemark(member.id)}
                              placeholder="例如：小任、女儿小敏"
                              autoFocus
                              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                onClick={() => saveFamilyMemberRemark(member.id)}
                                className="min-h-[44px] rounded-xl bg-primary font-bold text-white"
                              >
                                保存姓名
                              </button>
                              <button
                                onClick={() => {
                                  setEditingFamilyMemberId(null);
                                  setFamilyMemberRemark('');
                                }}
                                className="min-h-[44px] rounded-xl bg-white font-bold text-gray-600"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-lg font-bold text-gray-900">{getFamilyMemberName(member)}</p>
                              <p className="mt-1 text-sm font-medium text-orange-700">{member.relationship || '家属'}</p>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <button
                                onClick={() => {
                                  setEditingFamilyMemberId(member.id);
                                  setFamilyMemberRemark(member.family_remark || '');
                                }}
                                className="min-h-[40px] rounded-lg bg-white px-3 font-bold text-primary shadow-sm"
                              >
                                备注姓名
                              </button>
                              <button
                                onClick={() => removeFamilyMember(member.id)}
                                className="min-h-[40px] rounded-lg bg-red-50 px-3 font-bold text-red-600"
                              >
                                移除
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </main>
          </div>

          {showInviteFamilyModal && (
            <div className="invite-family-overlay" role="dialog" aria-modal="true" aria-labelledby="invite-family-title" onClick={() => setShowInviteFamilyModal(false)}>
              <section className="invite-family-dialog" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="invite-family-dialog__close" onClick={() => setShowInviteFamilyModal(false)} aria-label="关闭邀请家人"><X size={23} /></button>
                <div className="invite-family-dialog__icon"><Users size={30} /></div>
                <p className="care-eyebrow">一起照护，更安心</p>
                <h2 id="invite-family-title">邀请新家人</h2>
                <p className="invite-family-dialog__intro">让家人在注册或登录后输入这个邀请码，即可加入您的照护圈。</p>
                <div className="invite-family-code" aria-label={`邀请码 ${invitationCode || '生成中'}`}>
                  <span>家庭邀请码</span>
                  <strong>{invitationCode || '生成中…'}</strong>
                </div>
                {invitationLink && <p className="invite-family-link">{invitationLink}</p>}
                <button type="button" className="invite-family-dialog__primary" onClick={invitationLink ? copyInvitationLink : generateInvitationCode}>
                  <Copy size={20} />
                  {invitationLink ? '复制邀请链接' : '生成邀请码'}
                </button>
                <button type="button" className="invite-family-dialog__refresh" onClick={generateInvitationCode}>
                  <RefreshCw size={18} />
                  刷新邀请码
                </button>
                <small>邀请码24小时有效，最多可加入5位家属。</small>
              </section>
            </div>
          )}
        </div>
      )}

      {/* 留言板 */}
      {showMessageBoard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto mx-4">
            <div className="bg-primary text-white p-4 flex justify-between items-center">
              <h2 className="text-xl sm:text-2xl font-bold flex items-center">
                <MessageSquare size={24} className="mr-2" />
                留言板
              </h2>
              <button 
                onClick={() => {
                  setShowMessageBoard(false);
                  openMyPage();
                }}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <MessageBoard 
                userType="parent"
                userId={currentUserId}
                recipientId={currentChildId}
                onUnreadCountChange={setMessageUnreadCount}
              />
            </div>
          </div>
        </div>
      )}

      {/* SOS紧急求助弹窗 */}
      <SOSAlert 
        isOpen={showSOSAlert} 
        onClose={() => {
          setShowSOSAlert(false);
        }} 
        onConfirm={async () => {
          try {
            await dataAdapter.sendSOS('紧急求助！');
            console.warn('SOS 已发送到后端');
          } catch (e) {
            console.warn('SOS 发送失败:', e);
          }
          setShowSOSAlert(false);
        }}
        elderlyInfo={{ name: localStorage.getItem('elderlyName') || '长者' }}
      />
      
      {/* AI用药顾问 */}
      <AIMedicationAdvisor 
        isOpen={showAIMedAdvisor} 
        pageMode
        onClose={() => {
          setShowAIMedAdvisor(false);
          setActiveBottomTab('medication');
        }}
        currentMedications={medications}
      />
      
      {/* 用药报告 */}
      <MedicationReport
        isOpen={showBehaviorRecord}
        pageMode
        title="用药报告"
        showPeaceTree
        onClose={() => {
          setShowBehaviorRecord(false);
          openMyPage();
        }}
        medications={medications}
        boundElderly={{ elderlyId: currentUserId, realName: sessionUser.real_name || localStorage.getItem('elderlyName') || '您' }}
      />
    </div>
  );
};

export default ElderlyApp;
