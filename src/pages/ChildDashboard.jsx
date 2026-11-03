import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Bell, Clock, Calendar, User, Lock, LogOut, Plus, X, Link, Users, Edit, Trash, MessageSquare, AlertTriangle, Activity } from 'lucide-react';
import NotificationModal from '../components/NotificationModal';
import MessageBoard from '../components/message/MessageBoard';
import SOSNotification from '../components/family/SOSNotification';
import MedicationReport from '../components/family/MedicationReport';
import { useCrossWindowSync, SYNC_EVENTS } from '../hooks/useCrossWindowSync';
import dataAdapter from '../services/dataAdapter';

const ChildDashboard = () => {
  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(true);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [bindError, setBindError] = useState('');
  
  // 绑定长者相关
  const [elderlyId, setElderlyId] = useState('');
  const [relationship, setRelationship] = useState('');
  const [boundElderly, setBoundElderly] = useState(null);
  
  // 用药数据
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  // 留言功能
  const [showMessageBoard, setShowMessageBoard] = useState(false);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const currentUserId = 'child1'; // 模拟用户ID
  const currentElderlyId = 'parent1'; // 模拟长者ID
  
  // SOS紧急求助通知
  const [showSOSNotification, setShowSOSNotification] = useState(false);
  const [hasSOSAlert, setHasSOSAlert] = useState(false);
  
  // 服药报告
  const [showMedicationReport, setShowMedicationReport] = useState(false);
  
  // 药品复核请求
  const [reviewRequests, setReviewRequests] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReviewRequest, setCurrentReviewRequest] = useState(null);
  
  // 家庭组邀请
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  
  // 服药提醒管理
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [medicationForm, setMedicationForm] = useState({ time: '', name: '', dosage: '', usage: '', effect: '', frequency: '' });
  
  // 历史服药记录
  const [historyRecords, setHistoryRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // 处理跨窗口同步的事件
  const handleMedicationTaken = useCallback(() => {
    loadMedicationData();
  }, []);

  const handleDataRefresh = useCallback(() => {
    loadMedicationData();
  }, []);

  useCrossWindowSync({
    [SYNC_EVENTS.MEDICATION_TAKEN]: handleMedicationTaken,
    [SYNC_EVENTS.DATA_REFRESH]: handleDataRefresh
  });

  // 检查登录状态，并确保路演测试账号可用
  useEffect(() => {
    const createTestAccount = () => {
      const users = JSON.parse(localStorage.getItem('childUsers') || '[]');
      if (!users.some(u => u.username === 'testchild')) {
        const testUser = { username: 'testchild', password: '123456', boundElderly: null };
        users.push(testUser);
        localStorage.setItem('childUsers', JSON.stringify(users));
        return testUser;
      }
      return users.find(u => u.username === 'testchild');
    };
    
    createTestAccount();

    const token = localStorage.getItem('childToken');
    const storedUser = localStorage.getItem('currentUser');
    if (token && storedUser) {
      try {
        JSON.parse(storedUser);
        setIsLoggedIn(true);
        setShowLoginModal(false);
        loadBoundElderly();
      } catch (_error) {
        localStorage.removeItem('childToken');
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  // 监听 localStorage 变化，实现跨标签页/浏览器同步
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key && (
        e.key.startsWith('medications_') || 
        e.key.startsWith('notifications_') || 
        e.key.startsWith('messages_') ||
        e.key.startsWith('medicationReviewRequests')
      )) {
        loadMedicationData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 同时使用定时器定期检查（备用方案）
    const interval = setInterval(() => {
      if (boundElderly) {
        const storedData = localStorage.getItem(`medications_${boundElderly.elderlyId}`);
        const currentData = JSON.stringify(medications);
        if (storedData && currentData !== storedData) {
          loadMedicationData();
        }
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [medications, boundElderly]);

  // 监听提醒信息
  useEffect(() => {
    const checkReminders = () => {
      const allReminders = JSON.parse(localStorage.getItem('medicationReminders') || '[]');
      if (boundElderly) {
        const relevantReminders = allReminders.filter(
          reminder => reminder.elderlyId === boundElderly.elderlyId
        );
        setReminders(relevantReminders);
      }
    };

    // 初始加载
    checkReminders();

    // 每分钟检查一次
    const interval = setInterval(checkReminders, 60000);
    
    return () => clearInterval(interval);
  }, [boundElderly]);

  // 监听SOS和漏服通知（优先后端，回退 localStorage）
  useEffect(() => {
    let cancelled = false;
    const checkAlerts = async () => {
      try {
        const res = await dataAdapter.getSOSNotifications();
        if (res.success && res.data?.notifications && !cancelled) {
          const pending = res.data.notifications.filter(n => n.status === 'pending');
          if (pending.length > 0) {
            setHasSOSAlert(true);
            if (!showSOSNotification) {
              setShowSOSNotification(true);
            }
          } else {
            setHasSOSAlert(false);
          }
          return;
        }
      } catch (e) {
        console.warn('后端 SOS 拉取失败，回退本地:', e);
      }

      // 回退：localStorage
      let currentUser = localStorage.getItem('childUsername') || 'testchild';
      try {
        const notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser}`) || '[]');
        const unreadAlerts = notifications.filter(n =>
          n && (n.type === 'sos' || n.type === 'missed') && !n.read
        );
        if (unreadAlerts.length > 0) {
          setHasSOSAlert(true);
          if (!showSOSNotification) setShowSOSNotification(true);
        } else {
          setHasSOSAlert(false);
        }
      } catch (e) {
        setHasSOSAlert(false);
      }
    };

    checkAlerts();
    const interval = setInterval(checkAlerts, 15000);

    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('notifications_')) {
        checkAlerts();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [showSOSNotification]);

  // 监听药品复核请求（优先走后端）
  useEffect(() => {
    let cancelled = false;
    const checkReviewRequests = async () => {
      try {
        const res = await dataAdapter.getReviewRequests();
        if (res.success && res.data?.requests && !cancelled) {
          const pending = res.data.requests.filter(r => r.status === 'pending');
          setReviewRequests(pending);
          if (pending.length > 0 && !showReviewModal) {
            setCurrentReviewRequest(pending[0]);
            setShowReviewModal(true);
          }
          return;
        }
      } catch (e) {
        console.warn('后端复核请求加载失败，回退本地:', e);
      }

      // 回退：localStorage
      try {
        const allReviewRequests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
        if (boundElderly) {
          const relevantRequests = allReviewRequests.filter(
            request => request && request.elderlyId === boundElderly.elderlyId && request.status === 'pending'
          );
          setReviewRequests(relevantRequests);
          if (relevantRequests.length > 0 && !showReviewModal) {
            setCurrentReviewRequest(relevantRequests[0]);
            setShowReviewModal(true);
          }
        }
      } catch (e) {
        console.error('解析复核请求失败:', e);
        setReviewRequests([]);
      }
    };

    checkReviewRequests();
    const interval = setInterval(checkReviewRequests, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [boundElderly, showReviewModal]);

  // 实时监听用药数据变化
  useEffect(() => {
    const checkMedicationData = () => {
      if (boundElderly) {
        // 从本地存储加载今日用药（基于长者ID）
        const storedMedications = localStorage.getItem(`medications_${boundElderly.elderlyId}`);
        if (storedMedications) {
          setMedications(JSON.parse(storedMedications));
        }
      }
    };

    // 初始加载
    checkMedicationData();

    // 每5秒检查一次数据变化
    const interval = setInterval(checkMedicationData, 5000);
    
    return () => clearInterval(interval);
  }, [boundElderly]);

  // 加载绑定的长者信息
  const loadBoundElderly = () => {
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      const boundElderlyInfo = user.boundElderly;
      if (boundElderlyInfo) {
        setBoundElderly(boundElderlyInfo);
        setElderlyId(boundElderlyInfo.elderlyId);
        setRelationship(boundElderlyInfo.relationship);
      } else {
        // 如果没有绑定长者，显示绑定界面
        setShowBindModal(true);
      }
    }
  };

  // 加载用药数据（优先从后端）
  const loadMedicationData = async () => {
    try {
      const res = await dataAdapter.getMedications();
      if (res.success && res.data?.medications) {
        setMedications(res.data.medications);
        return;
      }
    } catch (e) {
      console.warn('后端加载失败，回退本地:', e);
    }

    // 回退：本地存储
    if (!boundElderly) return;
    const storedMedications = localStorage.getItem(`medications_${boundElderly.elderlyId}`);
    if (storedMedications) {
      setMedications(JSON.parse(storedMedications));
    }
  };

  // 模拟登录
  const handleLogin = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role: 'child' })
      });
      const json = await res.json();
      if (json.success && json.data) {
        localStorage.setItem('authToken', json.data.token);
        localStorage.setItem('childToken', json.data.token);
        localStorage.setItem('userId', json.data.user.id);
        localStorage.setItem('currentUser', JSON.stringify(json.data.user));
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setLoginError('');
        loadBoundElderly();
        await loadMedicationData();
        return;
      }
    } catch (e) {
      console.warn('后端登录不可用，回退本地:', e);
    }

    // 回退：纯本地登录
    const users = JSON.parse(localStorage.getItem('childUsers') || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      const token = 'mock-token-' + Date.now();
      localStorage.setItem('childToken', token);
      localStorage.setItem('authToken', token);
      localStorage.setItem('currentUser', JSON.stringify(user));
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setLoginError('');
      loadBoundElderly();
      loadMedicationData();
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  // 模拟注册
  const handleRegister = () => {
    if (password !== confirmPassword) {
      setRegisterError('两次输入的密码不一致');
      return;
    }
    
    const users = JSON.parse(localStorage.getItem('childUsers') || '[]');
    if (users.some(u => u.username === username)) {
      setRegisterError('用户名已存在');
      return;
    }
    
    const newUser = { username, password, boundElderly: null };
    users.push(newUser);
    localStorage.setItem('childUsers', JSON.stringify(users));
    setShowRegisterModal(false);
    setRegisterError('');
    // 注册成功后自动登录
    handleLogin();
  };

  // 绑定长者
  const handleBindElderly = () => {
    if (!elderlyId || !relationship) {
      setBindError('请填写完整的长者编号和关系');
      return;
    }

    // 验证长者编号是否存在
    const elderlyUsers = JSON.parse(localStorage.getItem('elderlyUsers') || '[]');
    const elderly = elderlyUsers.find(u => u.elderlyId === elderlyId);
    
    if (!elderly) {
      setBindError('长者编号不存在，请检查编号是否正确');
      return;
    }

    // 更新当前用户的绑定信息
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    currentUser.boundElderly = {
      elderlyId: elderly.elderlyId,
      realName: elderly.realName,
      relationship: relationship
    };
    
    // 更新用户列表
    const childUsers = JSON.parse(localStorage.getItem('childUsers') || '[]');
    const userIndex = childUsers.findIndex(u => u.username === currentUser.username);
    if (userIndex !== -1) {
      childUsers[userIndex] = currentUser;
      localStorage.setItem('childUsers', JSON.stringify(childUsers));
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // 同时也更新长者端的家庭组成员列表
    const familyKey = `family_${elderlyId}`;
    const family = JSON.parse(localStorage.getItem(familyKey) || '[]');
    
    // 检查是否已经在家庭成员中
    const existingMember = family.find(m => m.username === currentUser.username);
    if (!existingMember) {
      family.push({
        id: Date.now(),
        username: currentUser.username,
        relationship: relationship,
        joinedAt: new Date().toISOString()
      });
      localStorage.setItem(familyKey, JSON.stringify(family));
    }
    
    // 设置统一的绑定关系（用于SOS通知）
    localStorage.setItem('boundElderly', JSON.stringify({
      elderlyId: elderlyId,
      childUsername: currentUser.username
    }));
    
    setBoundElderly(currentUser.boundElderly);
    setShowBindModal(false);
    setBindError('');
    loadMedicationData();
  };

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('childToken');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userId');
    setIsLoggedIn(false);
    setShowLoginModal(true);
    setBoundElderly(null);
    setMedications([]);
  };
  
  // 处理药品复核请求 - 确认
  const handleReviewConfirm = async () => {
    if (!currentReviewRequest) return;
    try {
      // 1. 把 review status 改成 confirmed
      await dataAdapter.confirmReview(currentReviewRequest.id);
      // 2. 把确认后的药真写进 Supabase medications 表
      // currentReviewRequest.elderly_id 就是发起复核的父母 UUID
      const parentId = currentReviewRequest.elderly_id || '00000000-0000-0000-0000-000000000001';
      await dataAdapter.createMedication({
        user_id: parentId,
        name: currentReviewRequest.medication.name,
        dosage: '待设置',
        time: '',
        usage: currentReviewRequest.medication.usage || '',
        effect: currentReviewRequest.medication.effect || '',
        frequency: currentReviewRequest.medication.frequency || '',
        reminder_times: [],
        is_active: true
      });
    } catch (e) {
      console.warn('后端确认失败，回退本地:', e);
      // 回退：localStorage
      const allReviewRequests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
      const updatedRequests = allReviewRequests.map(r =>
        r.id === currentReviewRequest.id ? { ...r, status: 'confirmed' } : r
      );
      localStorage.setItem('medicationReviewRequests', JSON.stringify(updatedRequests));
      const medication = {
        id: Date.now(), time: '',
        name: currentReviewRequest.medication.name, dosage: '未知',
        usage: currentReviewRequest.medication.usage,
        effect: currentReviewRequest.medication.effect,
        frequency: currentReviewRequest.medication.frequency,
        status: 'pending'
      };
      if (boundElderly) {
        const stored = JSON.parse(localStorage.getItem(`medications_${boundElderly.elderlyId}`) || '[]');
        localStorage.setItem(`medications_${boundElderly.elderlyId}`, JSON.stringify([...stored, medication]));
      }
    }
    await loadMedicationData();
    setShowReviewModal(false);
    setCurrentReviewRequest(null);
    alert('药品已确认并添加到用药计划');
  };

  // 处理药品复核请求 - 拒绝
  const handleReviewReject = async () => {
    if (!currentReviewRequest) return;
    try {
      await dataAdapter.rejectReview(currentReviewRequest.id);
    } catch (e) {
      console.warn('后端拒绝失败，回退本地:', e);
      const allReviewRequests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
      const updatedRequests = allReviewRequests.map(r =>
        r.id === currentReviewRequest.id ? { ...r, status: 'rejected' } : r
      );
      localStorage.setItem('medicationReviewRequests', JSON.stringify(updatedRequests));
    }
    setShowReviewModal(false);
    setCurrentReviewRequest(null);
    alert('药品已拒绝，未添加到用药计划');
  };
  
  // 处理邀请码加入家庭组
  const handleJoinFamily = () => {
    if (!inviteCode) {
      setBindError('请输入邀请码');
      return;
    }
    
    // 查找邀请码对应的老人ID
    let targetElderlyId = null;
    const elderlyUsers = JSON.parse(localStorage.getItem('elderlyUsers') || '[]');
    
    for (const elderly of elderlyUsers) {
      const storedCode = localStorage.getItem(`invitationCode_${elderly.elderlyId}`);
      if (storedCode === inviteCode) {
        targetElderlyId = elderly.elderlyId;
        break;
      }
    }
    
    if (!targetElderlyId) {
      setBindError('邀请码无效，请检查邀请码是否正确');
      return;
    }
    
    // 检查家庭组人数是否已满
    const family = JSON.parse(localStorage.getItem(`family_${targetElderlyId}`) || '[]');
    if (family.length >= 5) {
      setBindError('家庭组人数已满，最多支持5名家属成员');
      return;
    }
    
    // 获取当前用户信息
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
      setBindError('请先登录');
      return;
    }
    
    // 检查用户是否已经在家庭组中
    if (family.some(member => member.id === currentUser.username)) {
      setBindError('您已经在该家庭组中');
      return;
    }
    
    // 添加用户到家庭组
    const newMember = {
      id: currentUser.username,
      username: currentUser.username,
      relationship: relationship
    };
    
    const updatedFamily = [...family, newMember];
    localStorage.setItem(`family_${targetElderlyId}`, JSON.stringify(updatedFamily));
    
    // 更新当前用户的绑定信息
    currentUser.boundElderly = {
      elderlyId: targetElderlyId,
      realName: elderlyUsers.find(e => e.elderlyId === targetElderlyId)?.realName || '未知老人',
      relationship: relationship
    };
    
    // 更新用户列表
    const childUsers = JSON.parse(localStorage.getItem('childUsers') || '[]');
    const userIndex = childUsers.findIndex(u => u.username === currentUser.username);
    if (userIndex !== -1) {
      childUsers[userIndex] = currentUser;
      localStorage.setItem('childUsers', JSON.stringify(childUsers));
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    setBoundElderly(currentUser.boundElderly);
    setShowInviteModal(false);
    setBindError('');
    loadMedicationData();
    
    // 显示成功提示
    alert('成功加入家庭组');
  };
  
  // 检查URL中的邀请码
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('invite');
    if (code) {
      setInviteCode(code);
      setShowInviteModal(true);
    }
  }, []);
  
  // 打开编辑服药提醒模态框
  const openEditMedicationModal = (medication) => {
    setEditingMedication(medication);
    setMedicationForm({
      time: medication.time,
      name: medication.name,
      dosage: medication.dosage || '未知',
      usage: medication.usage || '',
      effect: medication.effect || '',
      frequency: medication.frequency || ''
    });
    setShowMedicationModal(true);
  };
  
  // 保存服药提醒修改
  const saveMedicationChanges = () => {
    if (!boundElderly) return;
    
    const updatedMedications = medications.map(med => {
      if (med.id === editingMedication.id) {
        return {
          ...med,
          ...medicationForm
        };
      }
      return med;
    });
    
    localStorage.setItem(`medications_${boundElderly.elderlyId}`, JSON.stringify(updatedMedications));
    setMedications(updatedMedications);
    setShowMedicationModal(false);
    setEditingMedication(null);
    
    // 显示成功提示
    alert('服药提醒已更新');
  };
  
  // 删除服药提醒
  const deleteMedication = (medicationId) => {
    if (!boundElderly) return;
    
    if (window.confirm('确定要删除这个服药提醒吗？')) {
      const updatedMedications = medications.filter(med => med.id !== medicationId);
      localStorage.setItem(`medications_${boundElderly.elderlyId}`, JSON.stringify(updatedMedications));
      setMedications(updatedMedications);
      
      // 显示成功提示
      alert('服药提醒已删除');
    }
  };
  
  // 添加新的服药提醒
  const addNewMedication = () => {
    if (!boundElderly) return;
    
    const newMedication = {
      id: Date.now(),
      ...medicationForm,
      status: 'pending'
    };
    
    const updatedMedications = [...medications, newMedication];
    localStorage.setItem(`medications_${boundElderly.elderlyId}`, JSON.stringify(updatedMedications));
    setMedications(updatedMedications);
    setShowMedicationModal(false);
    setMedicationForm({ time: '', name: '', dosage: '', usage: '', effect: '', frequency: '' });
    
    // 显示成功提示
    alert('服药提醒已添加');
  };
  
  // 加载历史服药记录
  const loadHistoryRecords = () => {
    if (!boundElderly) return;
    
    const history = JSON.parse(localStorage.getItem(`medicationHistory_${boundElderly.elderlyId}`) || '[]');
    // 按日期筛选记录
    const filteredRecords = history.filter(record => record.date === selectedDate);
    setHistoryRecords(filteredRecords);
  };
  
  // 当绑定的老人或选择的日期变化时，加载历史记录
  useEffect(() => {
    if (boundElderly) {
      loadHistoryRecords();
    }
  }, [boundElderly, selectedDate]);

  // 登录界面
  if (!isLoggedIn) {
    return (
      <div className="w-full min-h-screen bg-animated-background flex items-center justify-center p-6">
        {showLoginModal && (
          <div className="glass rounded-3xl shadow-xl p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">药记得</h1>
              <p className="text-gray-500 mt-2">子女监控端登录</p>
            </div>
            
            {loginError && (
              <div className="bg-red-100 text-danger p-4 rounded-lg mb-6">
                {loginError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">用户名</label>
                <div className="relative">
                  <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">密码</label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
              
              <button
                onClick={handleLogin}
                className="elderly-button w-full max-w-md py-3 bg-gradient-to-br from-green-400 to-green-600 text-white rounded-3xl font-bold flex items-center justify-center min-h-[56px]"
              >
                登录
              </button>
              
              <div className="text-center">
                <button
                  onClick={() => {
                    setShowLoginModal(false);
                    setShowRegisterModal(true);
                  }}
                  className="text-primary hover:underline min-h-[44px] inline-flex items-center"
                >
                  还没有账号？立即注册
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showRegisterModal && (
          <div className="glass rounded-3xl shadow-xl p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">药记得</h1>
              <p className="text-gray-500 mt-2">子女监控端注册</p>
            </div>
            
            {registerError && (
              <div className="bg-red-100 text-danger p-4 rounded-lg mb-6">
                {registerError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">用户名</label>
                <div className="relative">
                  <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">密码</label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">确认密码</label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
              
              <button
                onClick={handleRegister}
                className="elderly-button w-full max-w-md py-3 bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-3xl font-bold flex items-center justify-center min-h-[56px]"
              >
                注册
              </button>
              
              <div className="text-center">
                <button
                  onClick={() => {
                    setShowRegisterModal(false);
                    setShowLoginModal(true);
                  }}
                  className="text-primary hover:underline min-h-[44px] inline-flex items-center"
                >
                  已有账号？立即登录
                </button>
              </div>
            </div>
          </div>
        )}
        
        {showBindModal && (
          <div className="glass rounded-3xl shadow-xl p-6 sm:p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">药记得</h1>
              <p className="text-gray-500 mt-2">绑定长者账号</p>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-primary flex items-start">
                  <Users className="mr-2 flex-shrink-0 mt-0.5" />
                  请输入长者的编号，建立监护关系
                </p>
              </div>
            </div>
            
            {bindError && (
              <div className="bg-red-100 text-danger p-4 rounded-lg mb-6">
                {bindError}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">长者编号</label>
                <div className="relative">
                  <Link size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={elderlyId}
                    onChange={(e) => setElderlyId(e.target.value)}
                    placeholder="请输入长者编号（如：ELDXXX）"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">与长者的关系</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                >
                  <option value="">请选择关系</option>
                  <option value="子女">子女</option>
                  <option value="孙子孙女">孙子孙女</option>
                  <option value="普通亲戚">普通亲戚</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              
              <button
                onClick={handleBindElderly}
                className="elderly-button w-full max-w-md py-3 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-3xl font-bold flex items-center justify-center min-h-[56px]"
              >
                绑定长者
              </button>
              
              <div className="text-center">
                <button
                  onClick={() => {
                    setShowBindModal(false);
                    setShowLoginModal(true);
                  }}
                  className="text-primary hover:underline min-h-[44px] inline-flex items-center"
                >
                  返回登录
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="w-full min-h-screen bg-animated-background p-4 sm:p-6">
      <NotificationModal />
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4 glass rounded-3xl p-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-dark">药记得 - 子女监控端</h1>
            {boundElderly && (
              <div className="mt-2 text-sm text-gray-600">
                <Users className="inline mr-1" />
                监护对象：{boundElderly.realName}（{boundElderly.relationship}）
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {boundElderly ? (
              <button
                onClick={() => setShowBindModal(true)}
                className="elderly-button flex items-center gap-2 px-4 py-2 sm:py-3 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-3xl font-bold min-h-[48px]"
              >
                <Link size={16} />
                重新绑定
              </button>
            ) : (
              <button
                onClick={() => setShowInviteModal(true)}
                className="elderly-button flex items-center gap-2 px-4 py-2 sm:py-3 bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-3xl font-bold min-h-[48px]"
              >
                <Users size={16} />
                加入家庭组
              </button>
            )}
            {/* 药品复核请求数量 */}
            {boundElderly && reviewRequests.length > 0 && (
              <button 
                onClick={() => {
                  if (reviewRequests.length > 0) {
                    setCurrentReviewRequest(reviewRequests[0]);
                    setShowReviewModal(true);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 sm:py-3 bg-blue-100 rounded-lg text-blue-600 hover:bg-blue-200 transition min-h-[44px] relative"
              >
                <Bell size={16} />
                <span className="text-sm sm:text-base">待复核 ({reviewRequests.length})</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-white text-xs">
                  {reviewRequests.length}
                </span>
              </button>
            )}
            <button
              onClick={() => setShowMessageBoard(!showMessageBoard)}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg"
            >
              <MessageSquare size={24} className="text-gray-600" />
              {messageUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-white text-xs">
                  {messageUnreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowSOSNotification(!showSOSNotification)}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg"
            >
              <AlertTriangle size={24} className={hasSOSAlert ? 'text-red-500 animate-pulse' : 'text-gray-600'} />
              {hasSOSAlert && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full flex items-center justify-center text-white text-xs animate-pulse">
                  !
                </span>
              )}
            </button>
            <button
              onClick={() => setShowMedicationReport(!showMedicationReport)}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg"
            >
              <Activity size={24} className="text-gray-600" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 sm:py-3 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 min-h-[44px]"
            >
              <LogOut size={16} />
              <span className="text-sm sm:text-base">退出</span>
            </button>
          </div>
        </div>

        {/* 今日服药状态 */}
        <div className="glass rounded-3xl shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 ambient-glow">
          <div className="flex items-center mb-6 gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-yellow-400 via-orange-400 to-red-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Clock size={24} sm:size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 drop-shadow-lg">
                今日服药状态
              </h2>
              <div className="h-1 w-24 mt-2 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 rounded-full shadow-md animate-pulse"></div>
            </div>
          </div>
          
          {!boundElderly ? (
            <div className="text-center py-8 sm:py-12">
              <Users size={36} sm:size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">请先加入家庭组</p>
              <p className="text-sm text-gray-400 mt-2">加入后即可查看长者的用药状态</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="elderly-button mt-6 px-6 py-3 bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-3xl font-bold transition min-h-[56px]"
              >
                <Users className="inline mr-2" />
                加入家庭组
              </button>
            </div>
          ) : (
            <>
              {/* 添加服药提醒按钮 */}
              <div className="mb-4 sm:mb-6">
                <button
                  onClick={() => {
                    setEditingMedication(null);
                    setMedicationForm({ time: '', name: '', dosage: '', usage: '', effect: '', frequency: '' });
                    setShowMedicationModal(true);
                  }}
                  className="elderly-button w-full px-4 py-3 bg-gradient-to-br from-green-400 to-green-600 text-white rounded-3xl font-bold flex items-center justify-center min-h-[56px]"
                >
                  <Plus size={16} className="mr-2" />
                  添加服药提醒
                </button>
              </div>
              
              {medications.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Clock size={36} sm:size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">暂无用药记录</p>
                  <p className="text-sm text-gray-400 mt-2">请点击上方按钮添加用药提醒</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {medications.map((med) => (
                    <div key={med.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg flex-wrap">
                      <div className="flex items-center">
                        <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full flex items-center justify-center mr-3 sm:mr-4">
                          {med.status === 'taken' ? (
                            <CheckCircle size={20} sm:size={24} className="text-secondary" />
                          ) : med.status === 'missed' ? (
                            <XCircle size={20} sm:size={24} className="text-danger" />
                          ) : (
                            <Clock size={20} sm:size={24} className="text-warning" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{med.name}</p>
                          <p className="text-sm text-gray-500">{med.time}</p>
                        </div>
                      </div>
                      <div className="mt-2 sm:mt-0 flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          med.status === 'taken' ? 'bg-green-100 text-secondary' :
                          med.status === 'missed' ? 'bg-red-100 text-danger' :
                          'bg-yellow-100 text-warning'
                        }`}>
                          {med.status === 'taken' ? '已服用' :
                           med.status === 'missed' ? '未服用' :
                           '待服用'}
                        </div>
                        {/* 编辑和删除按钮 */}
                        <button
                          onClick={() => openEditMedicationModal(med)}
                          className="p-2 text-primary hover:bg-gray-100 rounded-lg"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteMedication(med.id)}
                          className="p-2 text-danger hover:bg-gray-100 rounded-lg"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              

            </>
          )}
        </div>

        {/* 历史用药记录 */}
        <div className="glass rounded-3xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center mb-6 gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <Calendar size={24} sm:size={32} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 drop-shadow-lg">
                历史用药记录
              </h2>
              <div className="h-1 w-24 mt-2 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 rounded-full shadow-md animate-pulse"></div>
            </div>
          </div>
          
          {!boundElderly ? (
            <div className="text-center py-8 sm:py-12">
              <Users size={36} sm:size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">请先加入家庭组</p>
              <p className="text-sm text-gray-400 mt-2">加入后即可查看历史用药记录</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="elderly-button mt-6 px-6 py-3 bg-gradient-to-br from-purple-400 to-purple-600 text-white rounded-3xl font-bold transition min-h-[56px]"
              >
                <Users className="inline mr-2" />
                加入家庭组
              </button>
            </div>
          ) : (
            <>
              {/* 日期选择器 */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-medium mb-2">选择日期</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>
              
              {/* 历史记录列表 */}
              {historyRecords.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <Calendar size={36} sm:size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">该日期暂无用药记录</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {historyRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mr-3">
                          {record.status === 'taken' ? (
                            <CheckCircle size={20} className="text-secondary" />
                          ) : (
                            <XCircle size={20} className="text-danger" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{record.name}</p>
                          <p className="text-sm text-gray-500">{record.time}</p>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        record.status === 'taken' ? 'bg-green-100 text-secondary' :
                        'bg-red-100 text-danger'
                      }`}>
                        {record.status === 'taken' ? '已服用' : '未服用'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* 提醒列表 */}
        {reminders.length > 0 && (
          <div className="fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 max-w-xs mx-4">
            <h3 className="font-bold text-base sm:text-lg mb-2 flex items-center">
              <Bell className="mr-2 text-warning" />
              服药提醒
            </h3>
            <div className="space-y-2">
              {reminders.map(reminder => (
                <div key={reminder.id} className="p-2 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-sm">{reminder.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(reminder.timestamp).toLocaleString('zh-CN')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 绑定长者模态框 */}
        {showBindModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="glass rounded-3xl shadow-xl p-6 sm:p-8 max-w-md w-full mx-4">
              <div className="text-center mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-primary">药记得</h1>
                <p className="text-gray-500 mt-2">绑定长者账号</p>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-primary flex items-start">
                    <Users className="mr-2 flex-shrink-0 mt-0.5" />
                    请输入长者的编号，建立监护关系
                  </p>
                </div>
              </div>
              
              {bindError && (
                <div className="bg-red-100 text-danger p-4 rounded-lg mb-6">
                  {bindError}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">长者编号</label>
                  <div className="relative">
                    <Link size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={elderlyId}
                      onChange={(e) => setElderlyId(e.target.value)}
                      placeholder="请输入长者编号（如：ELDXXX）"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">与长者的关系</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  >
                    <option value="">请选择关系</option>
                    <option value="子女">子女</option>
                    <option value="孙子孙女">孙子孙女</option>
                    <option value="普通亲戚">普通亲戚</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                
                <button
                  onClick={handleBindElderly}
                  className="elderly-button w-full py-3 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-3xl font-bold min-h-[56px]"
                >
                  绑定长者
                </button>
                
                <div className="text-center">
                  <button
                    onClick={() => setShowBindModal(false)}
                    className="text-primary hover:underline min-h-[44px] inline-flex items-center"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 药品复核模态框 */}
        {showReviewModal && currentReviewRequest && (
          <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg mx-2 sm:mx-4 overflow-hidden max-h-[90vh] flex flex-col">
              <div className="bg-primary text-white p-3 sm:p-4 flex justify-between items-center flex-shrink-0">
                <h2 className="text-lg sm:text-xl font-bold">药品复核</h2>
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 min-h-[40px] sm:min-h-[44px] min-w-[40px] sm:min-w-[44px] flex items-center justify-center"
                >
                  <X size={20} sm:size={24} />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {/* 药品图片 */}
                {currentReviewRequest.imageUrl && (
                  <div className="mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-lg font-medium mb-2">药品图片</h3>
                    <div className="bg-gray-100 rounded-lg p-2 flex justify-center">
                      <img 
                        src={currentReviewRequest.imageUrl} 
                        alt="药品图片" 
                        className="max-h-48 sm:max-h-64 object-contain"
                      />
                    </div>
                  </div>
                )}
                
                {/* 药品信息 */}
                <div className="mb-4 sm:mb-6">
                  <h3 className="text-base sm:text-lg font-medium mb-2">药品信息</h3>
                  <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                    <p className="mb-1 sm:mb-2 text-sm sm:text-base"><strong>药品名称：</strong>{currentReviewRequest.medication.name}</p>
                    <p className="mb-1 sm:mb-2 text-sm sm:text-base"><strong>用法用量：</strong>{currentReviewRequest.medication.usage || '暂无'}</p>
                    <p className="mb-1 sm:mb-2 text-sm sm:text-base"><strong>主要功效：</strong>{currentReviewRequest.medication.effect || '暂无'}</p>
                    <p className="mb-1 sm:mb-2 text-sm sm:text-base"><strong>服用频率：</strong>{currentReviewRequest.medication.frequency || '暂无'}</p>
                  </div>
                </div>
              </div>
              
              {/* 操作按钮 - 固定在底部 */}
              <div className="p-4 sm:p-6 bg-gray-50 border-t flex-shrink-0">
                <div className="flex gap-3 sm:gap-4">
                  <button
                    onClick={handleReviewConfirm}
                    className="flex-1 py-3 sm:py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition min-h-[44px] text-sm sm:text-base"
                  >
                    确认添加
                  </button>
                  <button
                    onClick={handleReviewReject}
                    className="flex-1 py-3 sm:py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition min-h-[44px] text-sm sm:text-base"
                  >
                    拒绝添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 家庭组邀请模态框 */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="bg-primary text-white p-4 flex justify-between items-center">
                <h2 className="text-xl sm:text-2xl font-bold">加入家庭组</h2>
                <button 
                  onClick={() => setShowInviteModal(false)}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6">
                <p className="mb-6 text-gray-600">
                  请输入邀请码加入家庭组，加入后您可以查看老人的用药数据、接收异常通知、设置提醒等。
                </p>
                
                {bindError && (
                  <div className="bg-red-100 text-danger p-4 rounded-lg mb-6">
                    {bindError}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">邀请码</label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="请输入邀请码"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">与老人的关系</label>
                    <select
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    >
                      <option value="">请选择关系</option>
                      <option value="子女">子女</option>
                      <option value="配偶">配偶</option>
                      <option value="父母">父母</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleJoinFamily}
                    className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition min-h-[44px]"
                  >
                    加入家庭组
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* 服药提醒管理模态框 */}
        {showMedicationModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
              <div className="bg-primary text-white p-4 flex justify-between items-center">
                <h2 className="text-xl sm:text-2xl font-bold">{editingMedication ? '编辑服药提醒' : '添加服药提醒'}</h2>
                <button 
                  onClick={() => {
                    setShowMedicationModal(false);
                    setEditingMedication(null);
                    setMedicationForm({ time: '', name: '', dosage: '', usage: '', effect: '', frequency: '' });
                  }}
                  className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">服药时间</label>
                    <input
                      type="time"
                      value={medicationForm.time}
                      onChange={(e) => setMedicationForm({ ...medicationForm, time: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">药品名称</label>
                    <input
                      type="text"
                      value={medicationForm.name}
                      onChange={(e) => setMedicationForm({ ...medicationForm, name: e.target.value })}
                      placeholder="请输入药品名称"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">剂量</label>
                    <input
                      type="text"
                      value={medicationForm.dosage}
                      onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                      placeholder="请输入剂量"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">用法</label>
                    <input
                      type="text"
                      value={medicationForm.usage}
                      onChange={(e) => setMedicationForm({ ...medicationForm, usage: e.target.value })}
                      placeholder="请输入用法"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">功效</label>
                    <input
                      type="text"
                      value={medicationForm.effect}
                      onChange={(e) => setMedicationForm({ ...medicationForm, effect: e.target.value })}
                      placeholder="请输入功效"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">频率</label>
                    <input
                      type="text"
                      value={medicationForm.frequency}
                      onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                      placeholder="请输入频率"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={editingMedication ? saveMedicationChanges : addNewMedication}
                      className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition min-h-[44px]"
                    >
                      {editingMedication ? '保存修改' : '添加提醒'}
                    </button>
                    {editingMedication && (
                      <button
                        onClick={() => {
                          deleteMedication(editingMedication.id);
                          setShowMedicationModal(false);
                          setEditingMedication(null);
                        }}
                        className="flex-1 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition min-h-[44px]"
                      >
                        删除提醒
                      </button>
                    )}
                  </div>
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
                  userType="child"
                  userId={currentUserId}
                  recipientId={currentElderlyId}
                  onUnreadCountChange={setMessageUnreadCount}
                />
              </div>
            </div>
          </div>
        )}

        {/* SOS紧急求助通知 */}
        {showSOSNotification && (
          <SOSNotification 
            isOpen={showSOSNotification}
            onClose={() => setShowSOSNotification(false)}
            onOpen={() => setShowSOSNotification(true)}
          />
        )}
        
        {/* 服药报告 */}
        <MedicationReport 
          isOpen={showMedicationReport}
          onClose={() => setShowMedicationReport(false)}
          boundElderly={boundElderly}
        />
      </div>
    </div>
  );
};

export default ChildDashboard;
