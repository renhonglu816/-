import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, MapPin, Clock, X, Check, ExternalLink, Pill } from 'lucide-react';
import { useCrossWindowSync, SYNC_EVENTS } from '../../hooks/useCrossWindowSync';
import dataAdapter from '../../services/dataAdapter';
import { speakChinese } from '../../utils/speech';

const SOSNotification = ({ onClose, onOpen, onHandled, remoteAlerts = [], selectedAlertId }) => {
  const [alerts, setAlerts] = useState([]);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [handlingAlertId, setHandlingAlertId] = useState(null);
  const holdTimerRef = useRef(null);

  // 获取当前用户的统一函数
  const getCurrentUser = () => {
    let currentUser = null;
    try { currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}').username; } catch (_error) { /* 使用本地演示账号 */ }
    if (!currentUser) currentUser = localStorage.getItem('childUsername');
    if (!currentUser) {
      currentUser = 'testchild';
    }
    return currentUser;
  };

  const loadAlerts = useCallback(() => {
    const currentUser = getCurrentUser();
    
    const notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser}`) || '[]');
    // 加载所有类型的未读通知（SOS和漏服）
    const unreadAlerts = notifications.filter(n => 
      (n.type === 'sos' || n.type === 'missed') && !n.read
    );
    const remoteIds = new Set(remoteAlerts.map(alert => String(alert.id)));
    setAlerts([...remoteAlerts, ...unreadAlerts.filter(alert => !remoteIds.has(String(alert.id)))]);
  }, [remoteAlerts]);

  // 处理跨窗口同步的SOS事件
  const handleSOSAlert = useCallback((sosAlert) => {
    loadAlerts();
    setCurrentAlert(sosAlert);
    setShowDetail(true);
    playAlertSound(sosAlert);
    playLoudAlarm(); // 播放响亮的警报声
    if (onOpen) onOpen();
  }, [loadAlerts, onOpen]);

  // 处理数据刷新事件
  const handleDataRefresh = useCallback(() => {
    loadAlerts();
  }, [loadAlerts]);

  useCrossWindowSync({
    [SYNC_EVENTS.SOS_ALERT]: handleSOSAlert,
    [SYNC_EVENTS.DATA_REFRESH]: handleDataRefresh
  });

  const playAlertSound = (alert) => {
    const text = alert.type === 'sos'
      ? '紧急求助！您的家人发送了紧急求助信号，请立即查看！'
      : `注意！${alert.elderlyName}的药品漏服了，请及时提醒！`;
    speakChinese(text, { rate: 1 });
  };

  // 播放防空警报效果（音量大、持续久、震撼）
  const playLoudAlarm = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume?.().catch(() => {});
      
      // 创建真正的防空警报效果
      const playAirRaidAlarm = () => {
        let currentTime = 0;
        const beeps = [];
        
        // 创建20组警报声（防空警报效果：长音+短音交替，持续14秒）
        for (let i = 0; i < 20; i++) {
          // 长音 - 高音（持续0.4秒）
          beeps.push({ freq: 900, start: currentTime, duration: 0.4, volume: 1.0 });
          // 短暂停顿
          beeps.push({ freq: 900, start: currentTime + 0.42, duration: 0.05, volume: 0.01 });
          // 短音 - 低音（持续0.3秒）
          beeps.push({ freq: 600, start: currentTime + 0.47, duration: 0.3, volume: 1.0 });
          // 停顿
          beeps.push({ freq: 600, start: currentTime + 0.77, duration: 0.08, volume: 0.01 });
          currentTime += 0.85;
        }
        
        // 播放所有警报声
        beeps.forEach(beep => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = beep.freq;
          oscillator.type = 'sawtooth'; // 锯齿波更像警报声
          
          // 音量设为最大
          gainNode.gain.setValueAtTime(beep.volume, audioContext.currentTime + beep.start);
          if (beep.volume > 0.1) {
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + beep.start + beep.duration);
          }
          
          oscillator.start(audioContext.currentTime + beep.start);
          oscillator.stop(audioContext.currentTime + beep.start + beep.duration);
        });
      };
      
      playAirRaidAlarm();
    } catch (error) {
      console.error('播放警报声失败:', error);
    }
  };

  useEffect(() => {
    loadAlerts();
    
    // 监听localStorage变化
    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith('notifications_')) {
        loadAlerts();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // 定期检查（每2秒）
    const interval = setInterval(loadAlerts, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [loadAlerts]);

  // 当有新通知时自动打开
  useEffect(() => {
    if (alerts.length > 0 && !currentAlert) {
      setCurrentAlert(alerts.find(item => item.id === selectedAlertId) || alerts[0]);
      setShowDetail(true);
      playAlertSound(alerts[0]);
      // 如果是SOS求助，播放响亮的警报声
      if (alerts[0].type === 'sos') {
        playLoudAlarm();
      }
      if (onOpen) onOpen();
    }
  }, [alerts, currentAlert, onOpen]);

  const handleMarkAsRead = async (alertId) => {
    if (handlingAlertId) return;
    setHandlingAlertId(alertId);
    if (remoteAlerts.some(alert => alert.id === alertId)) {
      try {
        await dataAdapter.markSOSHandled(alertId);
      } catch (error) {
        console.error('处理紧急求助失败:', error);
        alert('暂时无法标记为已处理，请稍后重试');
        setHandlingAlertId(null);
        return;
      }
    }
    const currentUser = getCurrentUser();
    const notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser}`) || '[]');
    const updatedNotifications = notifications.map(n => 
      n.id === alertId ? { ...n, read: true } : n
    );
    localStorage.setItem(`notifications_${currentUser}`, JSON.stringify(updatedNotifications));
    onHandled?.(alertId);
    
    // 更新本地状态
    const remainingAlerts = [...remoteAlerts.filter(n => n.id !== alertId), ...updatedNotifications.filter(n =>
      (n.type === 'sos' || n.type === 'missed') && !n.read
    )];
    setAlerts(remainingAlerts);
    
    if (remainingAlerts.length > 0) {
      setCurrentAlert(remainingAlerts[0]);
    } else {
      setCurrentAlert(null);
      setShowDetail(false);
      if (onClose) onClose();
    }
    setHandlingAlertId(null);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setIsHolding(false);
  };

  const startHold = event => {
    if (currentAlert.type !== 'sos' || handlingAlertId) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    cancelHold();
    setIsHolding(true);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setIsHolding(false);
      navigator.vibrate?.(45);
      handleMarkAsRead(currentAlert.id);
    }, 1200);
  };

  useEffect(() => () => {
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      await Promise.all(remoteAlerts.map(item => dataAdapter.markSOSHandled(item.id)));
    } catch (error) {
      console.error('批量处理求助失败:', error);
      alert('部分求助尚未处理，请逐条确认');
      return;
    }
    const currentUser = getCurrentUser();
    const notifications = JSON.parse(localStorage.getItem(`notifications_${currentUser}`) || '[]');
    const updatedNotifications = notifications.map(n => 
      (n.type === 'sos' || n.type === 'missed') ? { ...n, read: true } : n
    );
    localStorage.setItem(`notifications_${currentUser}`, JSON.stringify(updatedNotifications));
    alerts.forEach(item => onHandled?.(item.id));
    setAlerts([]);
    setCurrentAlert(null);
    setShowDetail(false);
    if (onClose) onClose();
  };

  const getGoogleMapsUrl = (location) => {
    if (location && location.latitude && location.longitude) {
      return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    }
    return null;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString('zh-CN');
  };

  if (!showDetail || !currentAlert) {
    return null;
  }

  // 根据类型获取不同的样式和内容
  const getTypeSpecificInfo = () => {
    if (currentAlert.type === 'sos') {
      return {
        bgColor: 'bg-red-500',
        hoverBgColor: 'hover:bg-red-600',
        headerBg: 'bg-red-50',
        headerBorder: 'border-red-200',
        textColor: 'text-red-700',
        lightTextColor: 'text-red-600',
        icon: AlertTriangle,
        title: '紧急求助',
        description: '发送了紧急求助信号！',
        countText: '条未读求助信息',
        allText: '条求助信息'
      };
    } else {
      return {
        bgColor: 'bg-orange-500',
        hoverBgColor: 'hover:bg-orange-600',
        headerBg: 'bg-orange-50',
        headerBorder: 'border-orange-200',
        textColor: 'text-orange-700',
        lightTextColor: 'text-orange-600',
        icon: Pill,
        title: '药品漏服提醒',
        description: currentAlert.message,
        countText: '条未读漏服提醒',
        allText: '条漏服提醒'
      };
    }
  };

  const typeInfo = getTypeSpecificInfo();
  const TypeIcon = typeInfo.icon;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
        <div className={`${typeInfo.bgColor} text-white p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TypeIcon size={32} className="animate-pulse" />
              <div>
                <h2 className="text-xl font-bold">{typeInfo.title}</h2>
                <p className={`${typeInfo.textColor.replace('700', '100')} text-sm`}>{alerts.length} {typeInfo.countText}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setShowDetail(false);
                if (onClose) onClose();
              }}
              className={`p-2 ${typeInfo.hoverBgColor} rounded-full`}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className={`${typeInfo.headerBg} ${typeInfo.headerBorder} rounded-lg p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className={typeInfo.lightTextColor} />
              <span className={`text-sm ${typeInfo.lightTextColor}`}>{formatTime(currentAlert.timestamp)}</span>
            </div>
            <h3 className={`font-bold text-lg ${typeInfo.textColor}`}>{currentAlert.elderlyName}</h3>
            <p className={`${typeInfo.lightTextColor} mt-1`}>{typeInfo.description}</p>
          </div>

          {currentAlert.type === 'sos' && currentAlert.location && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-orange-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-orange-700">求助位置</p>
                  <p className="text-sm text-orange-600 mt-1">
                    纬度: {currentAlert.location.latitude?.toFixed(6)}<br />
                    经度: {currentAlert.location.longitude?.toFixed(6)}<br />
                    精度: {currentAlert.location.accuracy?.toFixed(0)} 米
                  </p>
                  {getGoogleMapsUrl(currentAlert.location) && (
                    <a 
                      href={getGoogleMapsUrl(currentAlert.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-orange-600 hover:underline"
                    >
                      在地图中查看 <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentAlert.type === 'missed' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Pill size={20} className="text-amber-500 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-amber-700">漏服药品详情</p>
                  <p className="text-sm text-amber-600 mt-1">
                    药品名称: {currentAlert.medicationName}<br />
                    服药时间: {currentAlert.medicationTime}<br />
                    请及时提醒老人服药！
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentAlert.type === 'sos' && currentAlert.voiceMessage && (
            <div className="bg-orange-100 border border-orange-200 rounded-lg p-4">
              <p className="font-medium text-orange-700 mb-2">语音留言</p>
              <audio 
                src={currentAlert.voiceMessage} 
                controls 
                className="w-full" 
              />
            </div>
          )}

          <div className="sos-action-row">
            <button
              type="button"
              onClick={() => { if (currentAlert.type !== 'sos') handleMarkAsRead(currentAlert.id); }}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onPointerLeave={cancelHold}
              onContextMenu={event => event.preventDefault()}
              disabled={Boolean(handlingAlertId)}
              className={`sos-hold-button ${isHolding ? 'is-holding' : ''}`}
            >
              <Check size={20} className="inline mr-2" />
              {handlingAlertId === currentAlert.id ? '正在处理…' : currentAlert.type === 'sos' ? (isHolding ? '继续按住…' : '长按-标记已处理') : '已知晓，标记已处理'}
            </button>
            <button type="button" onClick={onClose} className="sos-later-button">稍后处理</button>
          </div>

          {alerts.length > 1 && (
            <button
              onClick={handleMarkAllAsRead}
              className={`w-full py-3 ${typeInfo.headerBg} ${typeInfo.textColor} rounded-lg font-medium hover:opacity-80 transition`}
            >
              处理全部 {alerts.length} {typeInfo.allText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SOSNotification;
