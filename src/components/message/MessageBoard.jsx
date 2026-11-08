import React, { useState, useEffect } from 'react';
import { Send, Mic, Volume2, VolumeX, CheckCircle, MessageCircleHeart } from 'lucide-react';
import dataAdapter from '../../services/dataAdapter';

const MessageBoard = ({ userType, userId, recipientId, onUnreadCountChange, compact = false }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // 后端字段 → UI 字段映射
  const mapMsg = (m) => ({
    id: m.id,
    from: m.from_user_id === userId ? userType : (userType === 'child' ? 'parent' : 'child'),
    to: m.to_user_id === userId ? userType : (userType === 'child' ? 'parent' : 'child'),
    fromUserId: m.from_user_id,
    toUserId: m.to_user_id,
    content: m.content,
    type: m.type || 'text',
    isRead: m.is_read ?? false,
    timestamp: m.created_at || m.timestamp
  });

  // 加载消息（优先后端）
  const loadMessages = async () => {
    try {
      const res = await dataAdapter.getMessages();
      if (res.success && res.data?.messages) {
        const mapped = res.data.messages.map(mapMsg).reverse(); // 后端 asc=false，UI 需要正序
        setMessages(mapped);
        setUnreadCount(mapped.filter(msg => !msg.isRead && msg.from !== userType).length);
        return;
      }
    } catch (e) {
      console.warn('后端消息加载失败，回退本地:', e);
    }

    // 回退：localStorage
    const ids = [userId, recipientId].sort();
    const key = `messages_${ids[0]}_${ids[1]}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      setMessages(parsed);
      setUnreadCount(parsed.filter(msg => !msg.isRead && msg.from !== userType).length);
    }
  };

  // 发送消息（优先后端）
  const sendMessage = async (content, type = 'text') => {
    try {
      const res = await dataAdapter.sendMessage(recipientId, content, type);
      if (res.success && res.data?.message) {
        const newMsg = mapMsg(res.data.message);
        setMessages(prev => [...prev, newMsg]);
        setNewMessage('');
        return true;
      }
    } catch (e) {
      console.warn('后端发送失败，回退本地:', e);
    }
    // 回退：localStorage
    const ids = [userId, recipientId].sort();
    const key = `messages_${ids[0]}_${ids[1]}`;
    const stored = JSON.parse(localStorage.getItem(key) || '[]');
    const localMsg = {
      id: Date.now() + Math.random(),
      from: userType,
      to: userType === 'child' ? 'parent' : 'child',
      fromUserId: userId,
      toUserId: recipientId,
      content,
      type,
      isRead: false,
      timestamp: new Date().toISOString()
    };
    const updated = [...stored, localMsg];
    localStorage.setItem(key, JSON.stringify(updated));
    setMessages(updated);
    setNewMessage('');
    return true;
  };

  // 标记已读（优先后端）
  const markAsRead = async (id) => {
    try {
      await dataAdapter.markAsRead(id);
    } catch (e) {
      console.warn('后端已读标记失败，回退本地:', e);
      const updated = messages.map(msg =>
        msg.id === id ? { ...msg, isRead: true } : msg
      );
      const ids = [userId, recipientId].sort();
      const key = `messages_${ids[0]}_${ids[1]}`;
      localStorage.setItem(key, JSON.stringify(updated));
    }
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, isRead: true } : msg
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // 初始化
  useEffect(() => {
    loadMessages();
  }, [userId, recipientId]);

  // 定期刷新（后端模式下每 5s 拉一次）
  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [userId, recipientId]);

  useEffect(() => {
    if (onUnreadCountChange) {
      onUnreadCountChange(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  // 自动标记对方发来的未读消息为已读
  useEffect(() => {
    if (messages.length > 0) {
      messages.forEach(msg => {
        if (!msg.isRead && msg.from !== userType) {
          markAsRead(msg.id);
        }
      });
    }
  }, [messages.length, userType]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessage(newMessage.trim(), 'text');
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      setShowVoiceModal(true);
    }, 3000);
  };

  const handleSendVoiceMessage = () => {
    sendMessage('语音留言', 'voice');
    setShowVoiceModal(false);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${compact ? 'message-board--compact' : 'space-y-6'}`}>
      {/* 头部 */}
      {!compact && <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">留言板</h2>
          {unreadCount > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
              {unreadCount} 条未读
            </span>
          )}
        </div>
      </div>}

      {/* 消息列表 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 message-board__panel">
        {compact && <div className="message-board__heading"><div><MessageCircleHeart size={22} /><h2>留言</h2></div>{unreadCount > 0 && <span>{unreadCount}条未读</span>}</div>}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {!messages.length && <p className="message-board__empty">还没有留言，发一句关心吧。</p>}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.from === userType ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] p-4 rounded-lg ${message.from === userType ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}
              >
                {message.type === 'text' ? (
                  <p>{message.content}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mic size={16} />
                    <span>{message.content}</span>
                    <button className="ml-auto">
                      <Volume2 size={16} />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{formatTime(message.timestamp)}</span>
                  {message.from !== userType && !message.isRead && (
                    <button
                      onClick={() => markAsRead(message.id)}
                      className="flex items-center gap-1"
                    >
                      <CheckCircle size={12} />
                      标记已读
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 消息输入框 */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={handleStartRecording}
            className={`p-3 rounded-full ${isRecording ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}
          >
            <Mic size={20} />
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="输入消息..."
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className={`p-3 rounded-full ${newMessage.trim() ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* 语音留言模态框 */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50"></div>
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">语音留言</h3>
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic size={40} className="text-primary" />
              </div>
              <p className="text-center">语音录制完成</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition">
                  <VolumeX size={16} className="inline mr-1" />
                  重录
                </button>
                <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition">
                  <Volume2 size={16} className="inline mr-1" />
                  播放
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowVoiceModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                取消
              </button>
              <button
                onClick={handleSendVoiceMessage}
                className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition"
              >
                发送
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBoard;
