import { medicationAPI, messageAPI, reviewAPI, familyAPI, sosAPI } from './api';

// 配置：使用 API 还是 localStorage
const USE_API = import.meta.env.VITE_USE_API === 'true';

// ==================== LocalStorage 实现 ====================
const localStorageImpl = {
  async getMedications() {
    const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
    const stored = localStorage.getItem(`medications_${elderlyId}`);
    return { success: true, data: { medications: stored ? JSON.parse(stored) : [] } };
  },

  async createMedication(data) {
    const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
    const medications = JSON.parse(localStorage.getItem(`medications_${elderlyId}`) || '[]');
    const newMed = { ...data, id: Date.now(), status: 'pending' };
    medications.push(newMed);
    localStorage.setItem(`medications_${elderlyId}`, JSON.stringify(medications));
    
    // 触发 storage 事件（同域页面）
    window.dispatchEvent(new StorageEvent('storage', {
      key: `medications_${elderlyId}`,
      newValue: JSON.stringify(medications)
    }));
    
    return { success: true, data: { medication: newMed } };
  },

  async updateMedication(id, data) {
    const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
    const medications = JSON.parse(localStorage.getItem(`medications_${elderlyId}`) || '[]');
    const index = medications.findIndex(m => m.id === id);
    if (index > -1) {
      medications[index] = { ...medications[index], ...data };
      localStorage.setItem(`medications_${elderlyId}`, JSON.stringify(medications));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: `medications_${elderlyId}`,
        newValue: JSON.stringify(medications)
      }));
      
      return { success: true, data: { medication: medications[index] } };
    }
    return { success: false, error: '未找到用药记录' };
  },

  async deleteMedication(id) {
    const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
    const medications = JSON.parse(localStorage.getItem(`medications_${elderlyId}`) || '[]');
    const filtered = medications.filter(m => m.id !== id);
    localStorage.setItem(`medications_${elderlyId}`, JSON.stringify(filtered));
    
    window.dispatchEvent(new StorageEvent('storage', {
      key: `medications_${elderlyId}`,
      newValue: JSON.stringify(filtered)
    }));
    
    return { success: true };
  },

  async toggleStatus(id) {
    const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
    const medications = JSON.parse(localStorage.getItem(`medications_${elderlyId}`) || '[]');
    const index = medications.findIndex(m => m.id === id);
    if (index > -1) {
      const med = medications[index];
      if (med.status === 'taken') {
        med.status = 'pending';
        med.takenTime = null;
      } else {
        med.status = 'taken';
        med.takenTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      }
      localStorage.setItem(`medications_${elderlyId}`, JSON.stringify(medications));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: `medications_${elderlyId}`,
        newValue: JSON.stringify(medications)
      }));
      
      return { success: true, data: { medication: med } };
    }
    return { success: false, error: '未找到用药记录' };
  },

  async getMessages() {
    const currentUserId = localStorage.getItem('currentUserId') || 'guest';
    const stored = localStorage.getItem(`messages_${currentUserId}`);
    return { success: true, data: { messages: stored ? JSON.parse(stored) : [] } };
  },

  async sendMessage(toUserId, content, type = 'text') {
    const fromUserId = localStorage.getItem('currentUserId') || 'guest';
    const message = {
      id: Date.now(),
      from_user_id: fromUserId,
      to_user_id: toUserId,
      content,
      type,
      is_read: false,
      created_at: new Date().toISOString()
    };
    
    // 保存到发送者
    const fromMessages = JSON.parse(localStorage.getItem(`messages_${fromUserId}`) || '[]');
    fromMessages.push(message);
    localStorage.setItem(`messages_${fromUserId}`, JSON.stringify(fromMessages));
    
    // 保存到接收者
    const toMessages = JSON.parse(localStorage.getItem(`messages_${toUserId}`) || '[]');
    toMessages.push(message);
    localStorage.setItem(`messages_${toUserId}`, JSON.stringify(toMessages));
    
    // 发送通知
    const notifications = JSON.parse(localStorage.getItem(`notifications_${toUserId}`) || '[]');
    notifications.push({
      id: Date.now(),
      type: 'message',
      message: `收到新消息: ${content.substring(0, 20)}...`,
      timestamp: new Date().toISOString(),
      read: false
    });
    localStorage.setItem(`notifications_${toUserId}`, JSON.stringify(notifications));
    
    return { success: true, data: { message } };
  },

  async markAsRead(messageId) {
    const currentUserId = localStorage.getItem('currentUserId') || 'guest';
    const messages = JSON.parse(localStorage.getItem(`messages_${currentUserId}`) || '[]');
    const index = messages.findIndex(m => m.id === messageId);
    if (index > -1) {
      messages[index].is_read = true;
      localStorage.setItem(`messages_${currentUserId}`, JSON.stringify(messages));
      return { success: true, data: { message: messages[index] } };
    }
    return { success: false, error: '未找到消息' };
  },

  async createReviewRequest(medication, imageUrl) {
    const elderlyId = localStorage.getItem('currentElderlyId') || 'guest';
    const request = {
      id: Date.now(),
      elderly_id: elderlyId,
      medication,
      image_url: imageUrl,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    const requests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
    requests.push(request);
    localStorage.setItem('medicationReviewRequests', JSON.stringify(requests));
    
    // 通知子女
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (currentUser.family_group_id) {
      const family = JSON.parse(localStorage.getItem(`family_${currentUser.family_group_id}`) || '[]');
      family.forEach(member => {
        if (member.role === 'child') {
          const notifications = JSON.parse(localStorage.getItem(`notifications_${member.id}`) || '[]');
          notifications.push({
            id: Date.now(),
            type: 'review',
            message: `有新的药品需要复核: ${medication.name}`,
            timestamp: new Date().toISOString(),
            read: false
          });
          localStorage.setItem(`notifications_${member.id}`, JSON.stringify(notifications));
        }
      });
    }
    
    return { success: true, data: { request } };
  },

  async getReviewRequests() {
    const requests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
    return { success: true, data: { requests } };
  },

  async confirmReview(requestId) {
    const requests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
    const index = requests.findIndex(r => r.id === requestId);
    if (index > -1) {
      requests[index].status = 'confirmed';
      localStorage.setItem('medicationReviewRequests', JSON.stringify(requests));
      
      // 自动添加到用药列表
      const med = requests[index].medication;
      if (med) {
        const elderlyId = requests[index].elderly_id;
        const medications = JSON.parse(localStorage.getItem(`medications_${elderlyId}`) || '[]');
        medications.push({ ...med, id: Date.now(), status: 'pending' });
        localStorage.setItem(`medications_${elderlyId}`, JSON.stringify(medications));
      }
      
      return { success: true };
    }
    return { success: false, error: '未找到复核请求' };
  },

  async rejectReview(requestId) {
    const requests = JSON.parse(localStorage.getItem('medicationReviewRequests') || '[]');
    const index = requests.findIndex(r => r.id === requestId);
    if (index > -1) {
      requests[index].status = 'rejected';
      localStorage.setItem('medicationReviewRequests', JSON.stringify(requests));
      return { success: true };
    }
    return { success: false, error: '未找到复核请求' };
  },
};

// ==================== API 实现（代理） ====================
const apiImpl = {
  async getMedications() {
    return await medicationAPI.getMedications();
  },

  async createMedication(data) {
    return await medicationAPI.createMedication(data);
  },

  async updateMedication(id, data) {
    return await medicationAPI.updateMedication(id, data);
  },

  async deleteMedication(id) {
    return await medicationAPI.deleteMedication(id);
  },

  async toggleStatus(id) {
    return await medicationAPI.toggleStatus(id);
  },

  async getMessages() {
    return await messageAPI.getMessages();
  },

  async sendMessage(toUserId, content, type = 'text') {
    return await messageAPI.sendMessage(toUserId, content, type);
  },

  async markAsRead(messageId) {
    return await messageAPI.markAsRead(messageId);
  },

  async getReviewRequests() {
    return await reviewAPI.getReviewRequests();
  },

  async createReviewRequest(medication, imageUrl) {
    return await reviewAPI.createReviewRequest(medication, imageUrl);
  },

  async confirmReview(requestId) {
    return await reviewAPI.confirmReview(requestId);
  },

  async rejectReview(requestId) {
    return await reviewAPI.rejectReview(requestId);
  },

  // ==================== 家庭组 API ====================
  async createFamilyGroup() {
    return await familyAPI.createGroup();
  },

  async joinFamilyGroup(groupCode) {
    return await familyAPI.joinGroup(groupCode);
  },

  async getFamilyMembers() {
    return await familyAPI.getMembers();
  },

  // ==================== SOS API ====================
  async sendSOS(message, location) {
    return await sosAPI.sendSOS({ message, location });
  },

  async getSOSNotifications() {
    return await sosAPI.getSOSNotifications();
  },

  async markSOSHandled(notificationId) {
    return await sosAPI.markSOSHandled(notificationId);
  },
};

// 选择使用哪个实现
const dataAdapter = USE_API ? apiImpl : localStorageImpl;

export default dataAdapter;
export { USE_API, localStorageImpl, apiImpl };
