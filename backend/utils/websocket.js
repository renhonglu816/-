import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import supabase, { isSupabaseConfigured } from './supabase.js';

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // 存储用户 ID 到 WebSocket 连接的映射
    
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.wss.on('connection', async (ws, req) => {
      const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
      const requestedUserId = urlParams.get('userId');
      const token = urlParams.get('token');
      let userId = null;

      if (isSupabaseConfigured && token) {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data.user) userId = data.user.id;
      } else if (
        process.env.ALLOW_MOCK_AUTH === 'true'
        && token?.startsWith('mock-token-')
        && requestedUserId
      ) {
        userId = requestedUserId;
      }

      if (!userId) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      this.clients.set(userId, ws);

      ws.on('close', () => {
        if (userId) {
          this.clients.delete(userId);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        if (userId) {
          this.clients.delete(userId);
        }
      });
    });
  }

  // 向特定用户发送消息
  sendToUser(userId, message) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Error sending message:', error);
        return false;
      }
    }
    return false;
  }

  // 向多个用户发送消息
  sendToUsers(userIds, message) {
    userIds.forEach(userId => {
      this.sendToUser(userId, message);
    });
  }

  // 向所有连接的用户发送消息
  broadcast(message) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error broadcasting message:', error);
        }
      }
    });
  }

  // 获取当前连接的用户数量
  getConnectedUsersCount() {
    return this.clients.size;
  }
}

export default WebSocketService;
