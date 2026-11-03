import React, { useState, useEffect } from 'react';
import { Camera, Mic, Clock, Plus, X, Save, User, Lock, LogOut, Shield, Users, MessageSquare } from 'lucide-react';
import NotificationModal from '../components/NotificationModal';
import MedicationTimeline from '../components/elderly/MedicationTimeline';
import MedicineScanner from '../components/elderly/MedicineScanner';
import MedicationReminder from '../components/elderly/MedicationReminder';
import MessageBoard from '../components/message/MessageBoard';
import SOSButton from '../components/elderly/SOSButton';
import SOSAlert from '../components/elderly/SOSAlert';
import AIMedicationAdvisor from '../components/elderly/AIMedicationAdvisor';
import MedicationBehaviorRecord from '../components/elderly/MedicationBehaviorRecord';
import { useCrossWindowSync, SYNC_EVENTS } from '../hooks/useCrossWindowSync';
import dataAdapter from '../services/dataAdapter';

const ElderlyApp = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
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
  const [familyMembers, setFamilyMembers] = useState([]);
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationLink, setInvitationLink] = useState('');
  
  // 留言功能
  const [showMessageBoard, setShowMessageBoard] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const currentUserId = 'parent1'; // 模拟用户ID
  const currentChildId = 'child1'; // 模拟子女ID
  
  // SOS紧急求助功能
  const [showSOSAlert, setShowSOSAlert] = useState(false);
  
  // AI用药顾问
  const [showAIMedAdvisor, setShowAIMedAdvisor] = useState(false);
  
  // 服药行为记录
  const [showBehaviorRecord, setShowBehaviorRecord] = useState(false);

  const { sendMessage } = useCrossWindowSync();

  const generateElderlyId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ELD${timestamp}${random}`.toUpperCase();
  };

  useEffect(() => {
    const token = localStorage.getItem('elderlyToken');
    if (token) {
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
    const checkMedicationTimeout = () => {
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
        newlyMissed.forEach(missedMed => {
          triggerChildReminder(missedMed);
        });
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

    if (!realName || !idCard) {
      setRegisterError('请填写完整的实名信息');
      return;
    }

    // 身份证号格式验证
    const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    if (!idCardRegex.test(idCard)) {
      setRegisterError('身份证号格式不正确，请检查后重试');
      return;
    }

    try {
      // 优先调后端 auth/register
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, real_name: realName, id_card: idCard, role: 'parent' })
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
    users.push({ username, password, realName, idCard, elderlyId: newElderlyId });
    localStorage.setItem('elderlyUsers', JSON.stringify(users));
    setShowRegisterModal(false);
    setRegisterError('');
    handleLogin();
  };

  // 模拟身份验证函数（实际项目中会调用后端API）
  const verifyIdentity = (name, idCard) => {
    // 这里应该调用后端API进行身份验证
    // 现在实现身份证号校验码验证
    return validateIdCard(idCard);
  };

  // 身份证号校验函数
  const validateIdCard = (idCard) => {
    // 1. 验证格式
    const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    if (!idCardRegex.test(idCard)) {
      return false;
    }

    // 2. 验证校验码
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += parseInt(idCard[i]) * weights[i];
    }
    
    const checkCode = checkCodes[sum % 11];
    const lastChar = idCard[17].toUpperCase();
    
    return lastChar === checkCode;
  };

  const handleLogout = () => {
    localStorage.removeItem('elderlyToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentElderlyId');
    localStorage.removeItem('userId');
    localStorage.removeItem('elderlyName');
    setIsLoggedIn(false);
    setShowWelcome(true);
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

  const handleDeleteMedication = async (id) => {
    try {
      const res = await dataAdapter.deleteMedication(id);
      if (res.success) {
        setMedications(prev => prev.filter(med => med.id !== id));
      } else {
        console.warn('后端删除失败:', res.error);
      }
    } catch (e) {
      console.warn('后端删除失败，不本地删:', e);
      // 后端失败时不本地移除，避免 UI 与 Supabase 不一致
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
  const handleVisionAddMedication = (medInfo, imageUrl) => {
    
    // 检查是否是首次扫描的新药
    const isNewMedicine = !medications.some(med => med.name === medInfo.name);
    
    if (isLoggedIn) {
      if (isNewMedicine) {
        // 发送复核请求给子女端
        sendMedicationReviewRequest(medInfo, imageUrl);
        // 显示提示信息
        alert('药品已提交给子女复核，待子女确认后会自动加入用药计划');
        // 关闭拍药盒弹窗
        setShowVisionModal(false);
      } else {
        // 填充药品信息到newMedication
        setNewMedication({
          time: '',
          name: medInfo.name,
          usage: medInfo.usage,
          effect: medInfo.effect,
          frequency: medInfo.frequency
        });
        // 关闭拍药盒弹窗
        setShowVisionModal(false);
        // 打开添加用药模态框，让用户选择时间
        setShowAddMedicationModal(true);
      }
    } else {
      // 未登录状态，弹出登录弹窗
      setShowWelcome(false);
      setShowLoginModal(true);
    }
  };
  
  // 发送药品复核请求给子女端（优先走后端）
  const sendMedicationReviewRequest = async (medInfo, imageUrl) => {
    try {
      await dataAdapter.createReviewRequest(medInfo, imageUrl);
    } catch (e) {
      console.warn('后端复核请求失败，回退本地:', e);
      // 回退：localStorage
      const reviewRequest = {
        id: Date.now(),
        elderlyId: localStorage.getItem('currentElderlyId'),
        medication: medInfo,
        imageUrl,
        status: 'pending',
        timestamp: new Date().toISOString()
      };
      const requests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
      requests.push(reviewRequest);
      localStorage.setItem('medicationReviewRequests', JSON.stringify(requests));
    }
  };
  
  // 生成邀请码
  const generateInvitationCode = () => {
    const elderlyId = localStorage.getItem('currentElderlyId');
    if (elderlyId) {
      // 生成6位随机邀请码
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      // 保存邀请码到本地存储
      localStorage.setItem(`invitationCode_${elderlyId}`, code);
      setInvitationCode(code);
      // 生成邀请链接
      const link = `${window.location.origin}?invite=${code}&elderlyId=${elderlyId}`;
      setInvitationLink(link);
      return code;
    }
    return null;
  };
  
  // 加载家庭组成员
  const loadFamilyMembers = () => {
    const elderlyId = localStorage.getItem('currentElderlyId');
    if (elderlyId) {
      const family = JSON.parse(localStorage.getItem(`family_${elderlyId}`) || '[]');
      setFamilyMembers(family);
    }
  };
  
  // 移除家庭成员
  const removeFamilyMember = (memberId) => {
    const elderlyId = localStorage.getItem('currentElderlyId');
    if (elderlyId) {
      const family = JSON.parse(localStorage.getItem(`family_${elderlyId}`) || '[]');
      const updatedFamily = family.filter(member => member.id !== memberId);
      localStorage.setItem(`family_${elderlyId}`, JSON.stringify(updatedFamily));
      setFamilyMembers(updatedFamily);
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
          <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6 max-w-md w-full mx-2 sm:mx-4">
            <div className="text-center mb-5 sm:mb-6">
              <h1 className="elderly-title text-primary">药记得</h1>
              <p className="text-sm sm:text-base text-gray-500 mt-2">长者端注册</p>
              <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-blue-50 rounded-lg">
                <p className="text-xs sm:text-sm text-primary flex items-start">
                  <Shield className="mr-1.5 sm:mr-2 flex-shrink-0 mt-0.5 w-4 h-4" />
                  为了您的用药安全，请完成实名认证
                </p>
              </div>
            </div>

            {registerError && (
              <div className="bg-red-100 text-danger p-3 sm:p-4 rounded-lg mb-5">
                {registerError}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">真实姓名</label>
                <input
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  placeholder="请输入真实姓名"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">身份证号</label>
                <input
                  type="text"
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  placeholder="请输入身份证号"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-base sm:text-lg font-medium mb-2">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg rounded-xl border-2 border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <button onClick={handleRegister} className="elderly-button bg-primary text-white">
                注册
              </button>

              <div className="text-center">
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    setShowLoginModal(true);
                  }}
                  className="text-primary text-base sm:text-lg hover:underline min-h-[40px] sm:min-h-[44px] inline-flex items-center"
                >
                  已有账号？立即登录
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

  const currentElderlyId = localStorage.getItem('currentElderlyId');

  return (
    <div className="w-full min-h-screen flex flex-col">
      <NotificationModal />
      
      {/* 顶部区域 */}
      <div className="w-full flex flex-col items-center p-3 sm:p-8 pb-24">
        <div className="w-full mb-5 sm:mb-8 glass rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="elderly-title text-primary">药记得</h1>
            <p className="elderly-text text-gray-600 text-sm sm:text-base">您的编号：{currentElderlyId}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            {/* 留言板按钮 */}
            <button
              onClick={() => setShowMessageBoard(!showMessageBoard)}
              className="relative min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center hover:bg-gray-200/60 rounded-lg transition-all"
            >
              <MessageSquare size={20} sm:size={24} className="text-gray-600" />
              {messageUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-white text-xs">
                  {messageUnreadCount}
                </span>
              )}
            </button>
            {/* 家庭组管理按钮 */}
            <button
              onClick={() => {
                generateInvitationCode();
                setShowFamilyModal(true);
              }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-primary/90 text-white rounded-lg hover:bg-primary min-h-[40px] sm:min-h-[44px] transition-all"
            >
              <Users size={18} sm:size={20} />
              <span className="text-sm sm:text-lg">家庭组</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-200/60 rounded-lg text-gray-600 hover:bg-gray-300/60 min-h-[40px] sm:min-h-[44px] transition-all"
            >
              <LogOut size={18} sm:size={20} />
              <span className="text-sm sm:text-lg">退出</span>
            </button>
          </div>
        </div>

        <div className="w-full mb-7 sm:mb-12">
          <div className="flex justify-between items-center mb-3 sm:mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-xl animate-pulse border-4 border-yellow-200/50">
                <Clock size={24} sm:size={32} className="text-white drop-shadow-md" />
              </div>
              <div>
                <h2 className="text-xl sm:text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent drop-shadow-2xl animate-pulse">
                  今日用药时间轴
                </h2>
                <div className="h-2 w-32 sm:w-48 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full mt-2 shadow-lg animate-pulse"></div>
              </div>
            </div>
            <button
              onClick={() => setShowAddMedicationModal(true)}
              className="p-3 sm:p-4 bg-gradient-to-br from-orange-400 to-orange-600 text-white rounded-full shadow-lg min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] transition-all hover:scale-105 hover:shadow-xl hover:rotate-90"
            >
              <Plus size={24} sm:size={28} />
            </button>
          </div>

          {medications.length === 0 ? (
            <div className="glass rounded-2xl p-6 sm:p-12 text-center">
              <Clock size={40} sm:size={48} className="mx-auto mb-3 sm:mb-4 text-gray-500" />
              <p className="elderly-text text-gray-600">暂无用药记录</p>
              <p className="elderly-text text-gray-500 mt-2">点击右上角按钮添加用药</p>
            </div>
          ) : (
            <MedicationTimeline
              medications={medications}
              onToggleStatus={handleToggleMedicationStatus}
              onDelete={handleDeleteMedication}
            />
          )}
        </div>
      </div>

      {/* 底部导航栏 - 固定在底部 */}
      <div className="fixed bottom-0 left-0 right-0 glass border-t-2 border-white/40 shadow-lg z-40">
        <div className="flex justify-around items-center py-3 sm:py-4 max-w-md mx-auto">
          {/* 拍药盒 */}
          <button
            onClick={() => setShowVisionModal(true)}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-3xl hover:scale-105 active:scale-95 transition-all min-h-[60px] sm:min-h-[70px] relative overflow-hidden"
            style={{
              boxShadow: '0 8px 0 rgba(217, 119, 6, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)',
              transform: 'translateY(-2px)',
              transitionDuration: '100ms'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(4px) scale(0.97)';
              e.currentTarget.style.boxShadow = '0 2px 0 rgba(217, 119, 6, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transitionDuration = '50ms';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(217, 119, 6, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(217, 119, 6, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'translateY(4px) scale(0.97)';
              e.currentTarget.style.boxShadow = '0 2px 0 rgba(217, 119, 6, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transitionDuration = '50ms';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(217, 119, 6, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-400 via-orange-400 to-orange-600 rounded-full flex items-center justify-center">
              <Camera size={24} sm:size={28} className="text-white" />
            </div>
            <span className="text-sm sm:text-base font-bold text-black drop-shadow-md">拍药盒</span>
          </button>

          {/* AI用药顾问 */}
          <button
            onClick={() => setShowAIMedAdvisor(true)}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-3xl hover:scale-105 active:scale-95 transition-all min-h-[60px] sm:min-h-[70px] relative overflow-hidden ambient-glow purple-glow"
            style={{
              boxShadow: '0 8px 0 rgba(102, 51, 153, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)',
              transform: 'translateY(-2px)',
              transitionDuration: '100ms'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(4px) scale(0.97)';
              e.currentTarget.style.boxShadow = '0 2px 0 rgba(102, 51, 153, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transitionDuration = '50ms';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(102, 51, 153, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(102, 51, 153, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'translateY(4px) scale(0.97)';
              e.currentTarget.style.boxShadow = '0 2px 0 rgba(102, 51, 153, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transitionDuration = '50ms';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(102, 51, 153, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
              <Mic size={24} sm:size={28} className="text-white" />
            </div>
            <span className="text-sm sm:text-base font-bold text-black drop-shadow-md">AI顾问</span>
          </button>

          {/* 服药记录 */}
          <button
            onClick={() => setShowBehaviorRecord(true)}
            className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-3xl hover:scale-105 active:scale-95 transition-all min-h-[60px] sm:min-h-[70px] relative overflow-hidden"
            style={{
              boxShadow: '0 8px 0 rgba(37, 99, 235, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)',
              transform: 'translateY(-2px)',
              transitionDuration: '100ms'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translateY(4px) scale(0.97)';
              e.currentTarget.style.boxShadow = '0 2px 0 rgba(37, 99, 235, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transitionDuration = '50ms';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(37, 99, 235, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(37, 99, 235, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
            onTouchStart={(e) => {
              e.currentTarget.style.transform = 'translateY(4px) scale(0.97)';
              e.currentTarget.style.boxShadow = '0 2px 0 rgba(37, 99, 235, 0.5), 0 4px 8px rgba(0, 0, 0, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transitionDuration = '50ms';
            }}
            onTouchEnd={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
              e.currentTarget.style.boxShadow = '0 8px 0 rgba(37, 99, 235, 0.5), 0 10px 20px rgba(0, 0, 0, 0.15), inset 0 -4px 0 rgba(0, 0, 0, 0.2), inset 0 4px 0 rgba(255, 255, 255, 0.4)';
              e.currentTarget.style.transitionDuration = '100ms';
            }}
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center">
              <Clock size={24} sm:size={28} className="text-white" />
            </div>
            <span className="text-sm sm:text-base font-bold text-black drop-shadow-md">服药记录</span>
          </button>
        </div>
      </div>

      {showAddMedicationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden mx-2 sm:mx-4">
            <div className="bg-primary text-white p-3 sm:p-4 flex justify-between items-center">
              <h2 className="text-lg sm:text-2xl font-bold">添加用药</h2>
              <button onClick={() => setShowAddMedicationModal(false)} className="p-2 min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center">
                <X size={20} sm:size={24} />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-5 sm:mb-6">
                <label className="block text-base sm:text-lg font-medium mb-2">用药时间</label>
                <input
                  type="time"
                  value={newMedication.time}
                  onChange={(e) => setNewMedication({ ...newMedication, time: e.target.value })}
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div className="mb-5 sm:mb-6">
                <label className="block text-base sm:text-lg font-medium mb-2">药品名称</label>
                <input
                  type="text"
                  value={newMedication.name}
                  onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                  placeholder="请输入药品名称"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <div className="mb-5 sm:mb-6">
                <label className="block text-base sm:text-lg font-medium mb-2">剂量</label>
                <input
                  type="text"
                  value={newMedication.dosage || ''}
                  onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                  placeholder="请输入剂量，如：500mg"
                  className="w-full px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:border-primary"
                />
              </div>

              <button onClick={handleAddMedication} className="elderly-button bg-primary text-white">
                <Save size={24} sm:size={28} className="mr-2.5 sm:mr-3" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      <MedicineScanner
        isOpen={showVisionModal}
        onClose={() => setShowVisionModal(false)}
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
      
      {/* 家庭组管理模态框 */}
      {showFamilyModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-2 sm:mx-4 overflow-hidden">
            <div className="bg-primary text-white p-3 sm:p-4 flex justify-between items-center">
              <h2 className="text-lg sm:text-2xl font-bold">家庭组管理</h2>
              <button 
                onClick={() => setShowFamilyModal(false)}
                className="p-2 min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center"
              >
                <X size={20} sm:size={24} />
              </button>
            </div>
            
            <div className="p-5 sm:p-6">
              {/* 邀请码和邀请链接 */}
              <div className="mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">邀请家属</h3>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                  <p className="mb-2 text-sm sm:text-base">邀请码：<strong>{invitationCode}</strong></p>
                  <p className="mb-3 sm:mb-4 text-sm sm:text-base">邀请链接：<strong className="text-primary break-all">{invitationLink}</strong></p>
                  <button
                    onClick={copyInvitationLink}
                    className="w-full py-2.5 sm:py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition min-h-[40px] sm:min-h-[44px]"
                  >
                    复制邀请链接
                  </button>
                  <button
                    onClick={generateInvitationCode}
                    className="w-full mt-2 py-2.5 sm:py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition min-h-[40px] sm:min-h-[44px]"
                  >
                    重新生成邀请码
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-gray-500">
                  请将邀请码或链接分享给您的家属，他们可以通过邀请码或链接加入您的家庭组。
                  <br className="hidden sm:block" />每个家庭组最多支持5名家属成员。
                </p>
              </div>
              
              {/* 家庭成员列表 */}
              <div>
                <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">家庭成员</h3>
                {familyMembers.length === 0 ? (
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4 text-center">
                    <p className="text-gray-500">暂无家庭成员</p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-2">请通过邀请码或链接邀请家属加入</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {familyMembers.map(member => (
                      <div key={member.id} className="bg-gray-50 rounded-lg p-3 sm:p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{member.username}</p>
                          <p className="text-xs sm:text-sm text-gray-500">{member.relationship}</p>
                        </div>
                        <button
                          onClick={() => removeFamilyMember(member.id)}
                          className="px-2.5 sm:px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition min-h-[36px]"
                        >
                          移除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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
                onClick={() => setShowMessageBoard(false)}
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

      {/* SOS紧急求助按钮 */}
      <SOSButton onTrigger={() => setShowSOSAlert(true)} />
      
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
        onClose={() => setShowAIMedAdvisor(false)}
        currentMedications={medications}
      />
      
      {/* 服药行为记录 */}
      <MedicationBehaviorRecord
        isOpen={showBehaviorRecord}
        onClose={() => setShowBehaviorRecord(false)}
        medications={medications}
        elderlyInfo={{ name: localStorage.getItem('elderlyName') || '长者' }}
      />
    </div>
  );
};

export default ElderlyApp;
