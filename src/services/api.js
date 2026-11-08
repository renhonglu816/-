import axios from 'axios';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
apiClient.interceptors.request.use(
  (config) => {
    // 兼容 ElderlyApp 本地登录存的 elderlyToken 和标准 authToken
    const token = localStorage.getItem('authToken') || localStorage.getItem('elderlyToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    if (error.response?.status === 401) {
      // 只清 token，不强制刷新页面——让各页面自己决定怎么处理（例如弹登录框）
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
    }
    return Promise.reject(error);
  }
);

// ==================== 认证相关 API ====================
export const authAPI = {
  // 登录
  async login(username, password, role) {
    const response = await apiClient.post('/auth/login', { username, password, role });
    if (response.success && response.data?.token) {
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
    }
    return response;
  },

  // 注册
  async register(userData) {
    const response = await apiClient.post('/auth/register', userData);
    if (response.success && response.data?.token) {
      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
    }
    return response;
  },

  // 登出
  async logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    return { success: true };
  },

  // 获取当前用户
  getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  },

  async updateProfile(data) {
    const response = await apiClient.put('/auth/profile', data);
    if (response.success && response.data?.user) {
      localStorage.setItem('currentUser', JSON.stringify(response.data.user));
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
        localStorage.setItem('elderlyToken', response.data.token);
      }
    }
    return response;
  },
};

// ==================== 家庭组 API ====================
export const familyAPI = {
  // 创建家庭组
  async createGroup() {
    return await apiClient.post('/family/create-group');
  },

  // 加入家庭组
  async joinGroup(groupCode, relationship = '家属', carePermission = 'viewer') {
    return await apiClient.post('/family/join', {
      group_code: groupCode,
      relationship,
      care_permission: carePermission
    });
  },

  // 获取家庭成员
  async getMembers() {
    return await apiClient.get('/family/members');
  },

  async getMyCircle() {
    return await apiClient.get('/family/me');
  },

  async removeMember(memberId) {
    return await apiClient.delete(`/family/members/${memberId}`);
  },

  async updateMemberProfile(memberId, data) {
    return await apiClient.put(`/family/members/${memberId}/profile`, data);
  },
};

// ==================== 用药管理 API ====================
export const medicationAPI = {
  // 获取用药列表
  async getMedications() {
    return await apiClient.get('/medications');
  },

  // 创建用药提醒
  async createMedication(data) {
    return await apiClient.post('/medications', data);
  },

  // 更新用药提醒
  async updateMedication(id, data) {
    return await apiClient.put(`/medications/${id}`, data);
  },

  // 删除用药提醒
  async deleteMedication(id) {
    return await apiClient.delete(`/medications/${id}`);
  },

  // 切换用药状态（已服用/未服用）
  async toggleStatus(id) {
    return await apiClient.post(`/medications/${id}/toggle`);
  },
};

// ==================== 留言板 API ====================
export const messageAPI = {
  // 获取消息列表
  async getMessages() {
    return await apiClient.get('/messages');
  },

  // 发送消息
  async sendMessage(toUserId, content, type = 'text') {
    return await apiClient.post('/messages', { to_user_id: toUserId, content, type });
  },

  // 标记已读
  async markAsRead(messageId) {
    return await apiClient.put(`/messages/${messageId}/read`);
  },
};

// ==================== 药品复核 API ====================
export const reviewAPI = {
  // 获取复核请求
  async getReviewRequests() {
    return await apiClient.get('/medications/reviews');
  },

  // 创建复核请求
  async createReviewRequest(medication, imageUrl) {
    return await apiClient.post('/medications/reviews', { medication, image_url: imageUrl });
  },

  // 确认复核请求
  async confirmReview(requestId) {
    return await apiClient.put(`/medications/reviews/${requestId}/confirm`);
  },

  // 拒绝复核请求
  async rejectReview(requestId) {
    return await apiClient.put(`/medications/reviews/${requestId}/reject`);
  },
};

// ==================== 提醒 API ====================
export const reminderAPI = {
  // 获取提醒列表
  async getReminders() {
    return await apiClient.get('/reminders');
  },

  // 发送提醒
  async sendReminder(medicationId, userId) {
    return await apiClient.post('/reminders', { medication_id: medicationId, user_id: userId });
  },
};

// ==================== SOS 紧急求助 API ====================
export const sosAPI = {
  // 发送 SOS 求助
  async sendSOS(payload = {}) {
    return await apiClient.post('/sos', payload);
  },

  // 获取 SOS 通知
  async getSOSNotifications() {
    return await apiClient.get('/sos/notifications');
  },

  // 标记 SOS 已处理
  async markSOSHandled(notificationId) {
    return await apiClient.put(`/sos/notifications/${notificationId}/handled`);
  },
};

export default apiClient;
