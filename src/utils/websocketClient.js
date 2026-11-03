class WebSocketClient {
  constructor() {
    this.socket = null;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.reconnectTimer = null;
    this.shouldReconnect = false;
  }

  // 连接到 WebSocket 服务器
  connect(userId) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.shouldReconnect = true;
      const baseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
      const token = localStorage.getItem('childToken') || localStorage.getItem('elderlyToken') || '';
      const params = new URLSearchParams({ userId, token });
      const wsUrl = `${baseUrl}?${params.toString()}`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        this.attemptReconnect(userId);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.attemptReconnect(userId);
    }
  }

  // 尝试重连
  attemptReconnect(userId) {
    if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.reconnectTimer = setTimeout(() => {
        this.connect(userId);
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }

  // 处理接收到的消息
  handleMessage(message) {
    const { type, data } = message;
    
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in message callback:', error);
        }
      });
    }

    this.showNotification(data);
  }

  // 显示浏览器桌面通知
  showNotification(data) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('药物提醒', {
        body: data.message,
        icon: '/favicon.ico'
      });
    }
  }

  // 注册消息监听器
  on(type, callback) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  // 移除消息监听器
  off(type, callback) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }

  // 断开连接
  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  // 发送消息
  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  // 检查连接状态
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// 导出单例实例
const wsClient = new WebSocketClient();
export default wsClient;
