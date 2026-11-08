import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronRight, User, Lock, X, Link, Users, Eye, ShieldCheck } from 'lucide-react';
import NotificationModal from '../components/NotificationModal';
import SOSNotification from '../components/family/SOSNotification';
import { useCrossWindowSync, SYNC_EVENTS } from '../hooks/useCrossWindowSync';
import dataAdapter from '../services/dataAdapter';
import RegistrationFlow from '../components/auth/RegistrationFlow';
import FamilyCareExperience from '../components/family/FamilyCareExperience';

const ChildDashboard = ({ onLogout }) => {
  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(localStorage.getItem('childToken') && localStorage.getItem('currentUser')));
  const [showLoginModal, setShowLoginModal] = useState(() => !localStorage.getItem('childToken'));
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
  const [customRelationship, setCustomRelationship] = useState('');
  const [carePermission, setCarePermission] = useState('');
  const [boundElderly, setBoundElderly] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('careBinding') || 'null');
      const current = JSON.parse(localStorage.getItem('currentUser') || 'null');
      return cached && (!cached.childUserId || cached.childUserId === current?.id) ? cached : null;
    } catch (_error) {
      return null;
    }
  });
  
  // 用药数据
  const [medications, setMedications] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  // 留言功能
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const sessionUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const currentUserId = sessionUser.id || 'child1';
  
  // SOS紧急求助通知
  const [showSOSNotification, setShowSOSNotification] = useState(false);
  const [careAlerts, setCareAlerts] = useState([]);
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [dataSource, setDataSource] = useState('loading');
  const seenSOSAlerts = useRef(new Set());
  
  // 药品复核请求
  const [reviewRequests, setReviewRequests] = useState([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentReviewRequest, setCurrentReviewRequest] = useState(null);
  
  // 家庭组邀请
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [isJoiningCircle, setIsJoiningCircle] = useState(false);
  const [isLoadingCircle, setIsLoadingCircle] = useState(true);
  const joinRequestLock = useRef(false);
  
  // 服药提醒管理
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [medicationForm, setMedicationForm] = useState({ time: '', name: '', dosage: '', usage: '', effect: '', frequency: '' });
  
  const canManageMedication = boundElderly?.carePermission === 'manager';

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
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const alertUsername = currentUser.username || localStorage.getItem('childUsername') || 'testchild';
      const localNotifications = (() => {
        try {
          const saved = JSON.parse(localStorage.getItem(`notifications_${alertUsername}`) || '[]');
          return Array.isArray(saved) ? saved : [];
        } catch (_error) { return []; }
      })();
      try {
        const res = await dataAdapter.getSOSNotifications();
        if (res.success && res.data?.notifications && !cancelled) {
          const pending = res.data.notifications.filter(n => n.status === 'pending').map(n => ({
            ...n, type: 'sos', timestamp: n.created_at, elderlyName: n.elderly_name, elderlyId: n.elderly_id
          }));
          const localMissed = localNotifications.filter(n => n?.type === 'missed' && !n.read);
          setCareAlerts([...pending, ...localMissed]);
          const unseen = pending.find(n => !seenSOSAlerts.current.has(n.id));
          pending.forEach(n => seenSOSAlerts.current.add(n.id));
          if (unseen) { setSelectedAlertId(unseen.id); setShowSOSNotification(true); }
          return;
        }
      } catch (e) {
        console.warn('后端 SOS 拉取失败，回退本地:', e);
      }

      // 回退：localStorage
      try {
        const notifications = localNotifications;
        setCareAlerts(notifications);
        const unreadAlerts = notifications.filter(n =>
          n && (n.type === 'sos' || n.type === 'missed') && !n.read
        );
        const unseen = unreadAlerts.find(n => n.type === 'sos' && !seenSOSAlerts.current.has(n.id));
        unreadAlerts.forEach(n => seenSOSAlerts.current.add(n.id));
        if (unseen) { setSelectedAlertId(unseen.id); setShowSOSNotification(true); }
      } catch (e) {
        setCareAlerts([]);
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
  }, []);

  // 监听药品复核请求（优先走后端）
  useEffect(() => {
    let cancelled = false;
    const checkReviewRequests = async () => {
      try {
        const res = await dataAdapter.getReviewRequests();
        if (res.success && res.data?.requests && !cancelled) {
          const pending = res.data.requests.filter(r => r.status === 'pending');
          setReviewRequests(pending);
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
  }, [boundElderly]);

  // 实时监听用药数据变化
  useEffect(() => {
    const checkMedicationData = async () => {
      if (boundElderly) await loadMedicationData();
    };

    // 初始加载
    checkMedicationData();

    // 每5秒检查一次数据变化
    const interval = setInterval(checkMedicationData, 5000);
    
    return () => clearInterval(interval);
  }, [boundElderly]);

  // 加载绑定的长者信息
  const loadBoundElderly = async () => {
    setIsLoadingCircle(true);
    const cachedBinding = (() => {
      try { return JSON.parse(localStorage.getItem('careBinding') || 'null'); } catch (_error) { return null; }
    })();
    try {
      const res = await dataAdapter.getMyCareCircle();
      const circle = res.data?.circle;
      if (res.success && circle?.parent) {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const membership = circle.members?.find(member => member.id === currentUser.id);
        const boundElderlyInfo = {
          elderlyId: circle.parent.id,
          realName: circle.parent.real_name || circle.parent.username,
          relationship: membership?.relationship || currentUser.relationship || cachedBinding?.relationship || '家属',
          carePermission: membership?.care_permission || cachedBinding?.carePermission || 'viewer',
          groupCode: circle.group.group_code,
          childUserId: currentUser.id
        };
        setBoundElderly(boundElderlyInfo);
        setElderlyId(boundElderlyInfo.elderlyId);
        setRelationship(boundElderlyInfo.relationship);
        setCarePermission(boundElderlyInfo.carePermission);
        localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, family_group_id: circle.group.id, boundElderly: boundElderlyInfo }));
        localStorage.setItem('careBinding', JSON.stringify(boundElderlyInfo));
        setShowInviteModal(false);
        return;
      }
      if (res.success) {
        setBoundElderly(null);
        localStorage.removeItem('careBinding');
        setShowInviteModal(false);
      }
    } catch (error) {
      console.warn('读取照护圈失败:', error);
      if (cachedBinding) {
        setBoundElderly(cachedBinding);
        setShowInviteModal(false);
      } else {
        setBindError('照护圈信息加载失败，请检查网络后重试');
      }
    } finally {
      setIsLoadingCircle(false);
    }
  };

  // 加载用药数据（优先从后端）
  const loadMedicationData = async () => {
    try {
      const res = await dataAdapter.getMedications();
      if (res.success && res.data?.medications) {
        setMedications(res.data.medications);
        setLastSyncedAt(new Date().toISOString());
        setDataSource('server');
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
      setDataSource('local');
    } else {
      setDataSource('loading');
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

  // 注册：优先使用后端，离线演示时保留本地回退
  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setRegisterError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setRegisterError('密码至少 8 位，并同时包含字母和数字');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/auth/register`, {
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
        setRegisterError('');
        setShowRegisterModal(false);
        setIsLoggedIn(true);
        setShowInviteModal(true);
        return;
      }
    } catch (error) {
      console.warn('后端注册不可用，回退本地注册:', error);
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
    await handleLogin();
  };

  // 绑定长者
  const handleBindElderly = () => {
    const relationshipLabel = relationship === '其他' ? customRelationship.trim() : relationship;
    if (!elderlyId || !relationship) {
      setBindError('请填写完整的长者编号和关系');
      return;
    }
    if (!relationshipLabel) {
      setBindError('请填写您与长者的具体关系');
      return;
    }
    if (!carePermission) {
      setBindError('请选择您是观察者还是管理者');
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
      relationship: relationshipLabel
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
        relationship: relationshipLabel,
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
    onLogout?.();
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
  const handleJoinFamily = async () => {
    if (joinRequestLock.current) return;
    if (!inviteCode) {
      setBindError('请输入邀请码');
      return;
    }
    
    if (!relationship) {
      setBindError('请选择您与长者的关系');
      return;
    }
    const relationshipLabel = relationship === '其他' ? customRelationship.trim() : relationship;
    if (!relationshipLabel) {
      setBindError('请填写您与长者的具体关系');
      return;
    }
    joinRequestLock.current = true;
    setIsJoiningCircle(true);
    try {
      setBindError('');
      const res = await dataAdapter.joinFamilyGroup(inviteCode.trim(), relationshipLabel, carePermission);
      const circle = res.data?.circle;
      if (!res.success || !circle?.parent) throw new Error(res.error || '加入失败');
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const boundElderlyInfo = {
        elderlyId: circle.parent.id,
        realName: circle.parent.real_name || circle.parent.username,
        relationship: relationshipLabel,
        carePermission: res.data?.membership?.care_permission || carePermission,
        groupCode: circle.group.group_code,
        childUserId: currentUser.id
      };
      localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, family_group_id: circle.group.id, relationship: relationshipLabel, care_permission: boundElderlyInfo.carePermission, boundElderly: boundElderlyInfo }));
      localStorage.setItem('careBinding', JSON.stringify(boundElderlyInfo));
      setBoundElderly(boundElderlyInfo);
      setElderlyId(boundElderlyInfo.elderlyId);
      setShowInviteModal(false);
      await loadMedicationData();
      window.history.replaceState({}, '', window.location.pathname);
    } catch (error) {
      setBindError(error.response?.data?.error || error.message || '暂时无法加入照护圈');
    } finally {
      joinRequestLock.current = false;
      setIsJoiningCircle(false);
    }
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
          <RegistrationFlow
            role="child"
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            error={registerError}
            onSubmit={handleRegister}
            onLogin={() => {
              setRegisterError('');
              setShowRegisterModal(false);
              setShowLoginModal(true);
            }}
          />
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
                  onChange={(e) => {
                    setRelationship(e.target.value);
                    if (e.target.value !== '其他') setCustomRelationship('');
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                >
                  <option value="">请选择关系</option>
                  <option value="儿子">儿子</option>
                  <option value="女儿">女儿</option>
                  <option value="孙子">孙子</option>
                  <option value="孙女">孙女</option>
                  <option value="老伴">老伴</option>
                  <option value="兄弟">兄弟</option>
                  <option value="姐妹">姐妹</option>
                  <option value="其他">其他</option>
                </select>
                {relationship === '其他' && (
                  <input
                    type="text"
                    value={customRelationship}
                    onChange={(e) => setCustomRelationship(e.target.value.slice(0, 20))}
                    placeholder="请填写具体关系"
                    className="mt-3 w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                )}
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
    <div className="family-app-shell">
      <NotificationModal />
      <FamilyCareExperience
        boundElderly={boundElderly}
        isLoadingCircle={isLoadingCircle}
        medications={medications}
        canManageMedication={canManageMedication}
        onJoinCircle={() => { setBindError(''); setShowInviteModal(true); }}
        onAddMedication={() => {
          setEditingMedication(null);
          setMedicationForm({ time: '', name: '', dosage: '', usage: '', effect: '', frequency: '' });
          setShowMedicationModal(true);
        }}
        onEditMedication={openEditMedicationModal}
        currentUserId={currentUserId}
        messageUnreadCount={messageUnreadCount}
        onUnreadCountChange={setMessageUnreadCount}
        alerts={careAlerts}
        reminders={reminders}
        reviewRequests={reviewRequests}
        onOpenSOS={alert => { setSelectedAlertId(alert?.id || null); setShowSOSNotification(true); }}
        onOpenReview={request => { setCurrentReviewRequest(request); setShowReviewModal(true); }}
        onLogout={handleLogout}
        lastSyncedAt={lastSyncedAt}
        dataSource={dataSource}
      />
      <div className="family-app-shell__dialogs">
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
                    onChange={(e) => {
                      setRelationship(e.target.value);
                      if (e.target.value !== '其他') setCustomRelationship('');
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  >
                    <option value="">请选择关系</option>
                    <option value="儿子">儿子</option>
                    <option value="女儿">女儿</option>
                    <option value="孙子">孙子</option>
                    <option value="孙女">孙女</option>
                    <option value="老伴">老伴</option>
                    <option value="兄弟">兄弟</option>
                    <option value="姐妹">姐妹</option>
                    <option value="其他">其他</option>
                  </select>
                  {relationship === '其他' && (
                    <input
                      type="text"
                      value={customRelationship}
                      onChange={(e) => setCustomRelationship(e.target.value.slice(0, 20))}
                      placeholder="请填写具体关系"
                      className="mt-3 w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                    />
                  )}
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
          <div className="join-circle-overlay" onClick={() => setShowInviteModal(false)}>
            <section className="join-circle-dialog" role="dialog" aria-modal="true" aria-labelledby="join-circle-title" onClick={event => event.stopPropagation()}>
              <button type="button" onClick={() => setShowInviteModal(false)} className="join-circle-dialog__close" aria-label="关闭加入照护圈"><X size={23} /></button>
              <header className="join-circle-dialog__header">
                <span className="join-circle-dialog__mark"><Users size={29} /></span>
                <span className="care-eyebrow">连接家人</span>
                <h2 id="join-circle-title">加入家人的照护圈</h2>
                <p>输入长者分享的6位邀请码，加入后即可查看用药计划并接收重要提醒。</p>
              </header>

              {bindError && <div className="join-circle-error" role="alert">{bindError}</div>}

              <div className="join-circle-form">
                <label className="join-circle-field join-circle-field--code">
                  <span><Link size={19} />邀请码</span>
                  <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="请输入6位数字" inputMode="numeric" maxLength={6} autoFocus />
                  <small>邀请码由长者在“我的－家人”中生成</small>
                </label>

                <label className="join-circle-field">
                  <span><Users size={19} />与长者的关系</span>
                  <select value={relationship} onChange={(e) => { setRelationship(e.target.value); if (e.target.value !== '其他') setCustomRelationship(''); }}>
                    <option value="">请选择关系</option><option value="儿子">儿子</option><option value="女儿">女儿</option><option value="孙子">孙子</option><option value="孙女">孙女</option><option value="老伴">老伴</option><option value="兄弟">兄弟</option><option value="姐妹">姐妹</option><option value="其他">其他</option>
                  </select>
                </label>

                {relationship === '其他' && <label className="join-circle-field"><span>具体关系</span><input type="text" value={customRelationship} onChange={(e) => setCustomRelationship(e.target.value.slice(0, 20))} placeholder="例如：邻居、护工" autoFocus /></label>}

                <fieldset className="join-circle-permission">
                  <legend><ShieldCheck size={19} />在照护圈中的权限</legend>
                  <div className="join-circle-permission__options">
                    <button type="button" className={carePermission === 'viewer' ? 'is-selected' : ''} onClick={() => setCarePermission('viewer')} aria-pressed={carePermission === 'viewer'}>
                      <span className="join-circle-permission__icon"><Eye size={22} /></span>
                      <span><strong>观察者</strong><small>查看用药情况和接收提醒</small></span>
                    </button>
                    <button type="button" className={carePermission === 'manager' ? 'is-selected' : ''} onClick={() => setCarePermission('manager')} aria-pressed={carePermission === 'manager'}>
                      <span className="join-circle-permission__icon"><ShieldCheck size={22} /></span>
                      <span><strong>管理者</strong><small>可查看并管理长者的用药计划</small></span>
                    </button>
                  </div>
                </fieldset>

                <button type="button" onClick={handleJoinFamily} disabled={isJoiningCircle} className="join-circle-submit">
                  {isJoiningCircle ? '正在确认并同步…' : '确认加入照护圈'}
                  {!isJoiningCircle && <ChevronRight size={21} />}
                </button>
              </div>
              <p className="join-circle-dialog__note">{
                carePermission === 'manager'
                  ? '管理者可以协助维护用药计划，操作记录会同步给家人。'
                  : '观察者只查看信息和接收提醒，不会修改长者的药品。'
              }</p>
            </section>
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

        {/* SOS紧急求助通知 */}
        {showSOSNotification && (
          <SOSNotification 
            isOpen={showSOSNotification}
            onClose={() => setShowSOSNotification(false)}
            onOpen={() => setShowSOSNotification(true)}
            remoteAlerts={careAlerts.filter(alert => alert.type === 'sos' && alert.status === 'pending')}
            selectedAlertId={selectedAlertId}
            onHandled={id => setCareAlerts(current => current.filter(alert => alert.id !== id))}
          />
        )}
        
      </div>
    </div>
  );
};

export default ChildDashboard;
