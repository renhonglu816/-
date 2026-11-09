import React, { useState, useEffect } from 'react';
import wsClient from '../utils/websocketClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const NotificationModal = () => {
  const [notifications, setNotifications] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // 连接 WebSocket
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user) {
      wsClient.connect(user.id);
    }

    // 监听药物提醒通知
    const handleMedicationReminder = (data) => {
      const newNotification = {
        id: Date.now(),
        type: 'medication',
        title: '药物提醒',
        message: data.message,
        medication: data.medication,
        reminderLog: data.reminder_log,
        timestamp: new Date()
      };
      setNotifications(prev => [newNotification, ...prev]);
      setShowModal(true);
    };

    // 监听父母药物提醒通知（子女端）
    const handleParentMedicationReminder = (data) => {
      const newNotification = {
        id: Date.now(),
        type: 'parent_medication',
        title: '父母药物提醒',
        message: data.message,
        medication: data.medication,
        reminderLog: data.reminder_log,
        timestamp: new Date()
      };
      setNotifications(prev => [newNotification, ...prev]);
      setShowModal(true);
    };

    // 监听错过的药物提醒通知
    const handleMissedMedicationReminder = (data) => {
      const newNotification = {
        id: Date.now(),
        type: 'missed_medication',
        title: '错过药物提醒',
        message: data.message,
        medication: data.medication,
        reminderLog: data.reminder_log,
        timestamp: new Date()
      };
      setNotifications(prev => [newNotification, ...prev]);
      setShowModal(true);
    };

    // 注册监听器
    wsClient.on('medication_reminder', handleMedicationReminder);
    wsClient.on('parent_medication_reminder', handleParentMedicationReminder);
    wsClient.on('missed_medication_reminder', handleMissedMedicationReminder);

    // 清理函数
    return () => {
      wsClient.off('medication_reminder', handleMedicationReminder);
      wsClient.off('parent_medication_reminder', handleParentMedicationReminder);
      wsClient.off('missed_medication_reminder', handleMissedMedicationReminder);
    };
  }, []);

  const handleClose = () => {
    setShowModal(false);
  };

  const handleMarkTaken = async (reminderLogId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reminders/${reminderLogId}/take`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('childToken') || localStorage.getItem('elderlyToken')}`
        }
      });

      if (response.ok) {
        // 移除通知
        setNotifications(prev => prev.filter(n => n.reminderLog.id !== reminderLogId));
        if (notifications.length === 1) {
          setShowModal(false);
        }
      }
    } catch (error) {
      console.error('Error marking medication as taken:', error);
    }
  };

  if (!showModal || notifications.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleClose}></div>
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">通知</h3>
        </div>
        <div className="p-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="mb-4 p-3 border rounded-lg bg-gray-50">
              <h4 className="font-medium text-gray-900 mb-2">{notification.title}</h4>
              <p className="text-gray-700 mb-3">{notification.message}</p>
              {notification.medication && (
                <div className="text-sm text-gray-600 mb-3">
                  <p>药品：{notification.medication.name}</p>
                  <p>剂量：{notification.medication.dosage}</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-200 rounded-md text-gray-800 hover:bg-gray-300"
                >
                  关闭
                </button>
                {notification.reminderLog && (
                  <button
                    onClick={() => handleMarkTaken(notification.reminderLog.id)}
                    className="px-4 py-2 bg-blue-600 rounded-md text-white hover:bg-blue-700"
                  >
                    标记已服用
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
