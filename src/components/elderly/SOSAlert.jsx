import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Phone, MapPin, Mic, X, Check } from 'lucide-react';
import { useCrossWindowSync, SYNC_EVENTS } from '../../hooks/useCrossWindowSync';

const SOSAlert = ({ isOpen, onClose, onConfirm, elderlyInfo }) => {
  const [countdown, setCountdown] = useState(10);
  const [isActivated, setIsActivated] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [voiceMessage, setVoiceMessage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null); // 存储定时器引用

  const { sendMessage } = useCrossWindowSync();

  useEffect(() => {
    if (isOpen) {
      getLocation();
      loadEmergencyContacts();
      startCountdown();
    }
    return () => {
      stopRecording();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen]);

  const getLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          setLocationError(null);
        },
        (error) => {
          setLocationError(error.message);
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      setLocationError('浏览器不支持定位功能');
    }
  };

  const loadEmergencyContacts = () => {
    const elderlyId = localStorage.getItem('currentElderlyId');
    if (elderlyId) {
      const family = JSON.parse(localStorage.getItem(`family_${elderlyId}`) || '[]');
      setEmergencyContacts(family);
    }
  };

  const startCountdown = () => {
    setCountdown(10);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          // 倒计时结束，自动发送SOS
          if (!isActivated) {
            handleActivateSOS();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleActivateSOS = () => {
    setIsActivated(true);
    // 长者端只播放人声，不播放警报声
    sendSOSAlert();
  };

  const handleCancelSOS = () => {
    stopRecording();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onClose();
  };

  const sendSOSAlert = () => {
    const elderlyId = localStorage.getItem('currentElderlyId');
    const elderlyName = localStorage.getItem('elderlyName') || '未知老人';

    const sosAlert = {
      id: Date.now(),
      elderlyId,
      elderlyName,
      location,
      timestamp: new Date().toISOString(),
      voiceMessage,
      status: 'pending',
      type: 'sos',
      message: `紧急求助：${elderlyName} 发送了紧急求助信号！`,
      read: false,
      receivedAt: new Date().toISOString()
    };

    // 存储到全局SOS列表（用于调试）
    const alerts = JSON.parse(localStorage.getItem('sosAlerts') || '[]');
    alerts.push(sosAlert);
    localStorage.setItem('sosAlerts', JSON.stringify(alerts));

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance();
      utterance.text = `紧急求助已发出，正在通知您的家人和紧急联系人`;
      utterance.lang = 'zh-CN';
      utterance.volume = 1;
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    }

    notifyChildren(sosAlert);

    // 发送跨窗口同步消息
    sendMessage(SYNC_EVENTS.SOS_ALERT, sosAlert);

    // 发送数据刷新通知
    sendMessage(SYNC_EVENTS.DATA_REFRESH, { type: 'sos', timestamp: new Date().toISOString() });
  };

  const notifyChildren = (sosAlert) => {
    // 通知所有家庭成员
    if (emergencyContacts.length > 0) {
      emergencyContacts.forEach(contact => {
        const contactKey = `notifications_${contact.username}`;
        const notifications = JSON.parse(localStorage.getItem(contactKey) || '[]');
        notifications.push(sosAlert);
        localStorage.setItem(contactKey, JSON.stringify(notifications));
      });
    } else {
      // 如果没有绑定的家庭成员，发送给测试账号
      const testKey = 'notifications_testchild';
      const notifications = JSON.parse(localStorage.getItem(testKey) || '[]');
      notifications.push(sosAlert);
      localStorage.setItem(testKey, JSON.stringify(notifications));
    }

    // 同时也存储到统一的长者子女绑定关系中
    const boundElderlyKey = 'boundElderly';
    const boundElderly = localStorage.getItem(boundElderlyKey);
    if (boundElderly) {
      const boundData = JSON.parse(boundElderly);
      const childUsername = boundData.childUsername;
      const notificationsKey = `notifications_${childUsername}`;
      const notifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]');
      notifications.push(sosAlert);
      localStorage.setItem(notificationsKey, JSON.stringify(notifications));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // 将 Blob 转换为 Base64 以便存储
        const reader = new FileReader();
        reader.onload = () => {
          setVoiceMessage(reader.result); // Base64 字符串
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, 10000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleConfirmSOS = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onConfirm();
    onClose();
  };

  const getGoogleMapsUrl = () => {
    if (location) {
      return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
        {!isActivated ? (
          <>
            <div className="bg-red-500 text-white p-6 text-center">
              <AlertTriangle size={48} className="mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-bold mb-2">紧急求助</h2>
              <p className="text-red-100">将在 {countdown} 秒后自动发送求助信号</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-center font-medium">
                  如需取消，请点击"取消求助"按钮
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">当前位置</p>
                    {location ? (
                      <p className="text-sm text-gray-600">
                        纬度: {location.latitude.toFixed(6)}<br />
                        经度: {location.longitude.toFixed(6)}
                      </p>
                    ) : locationError ? (
                      <p className="text-sm text-red-500">{locationError}</p>
                    ) : (
                      <p className="text-sm text-gray-500">正在获取位置...</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone size={20} className="text-primary mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium">紧急联系人</p>
                    {emergencyContacts.length > 0 ? (
                      <p className="text-sm text-gray-600">
                        {emergencyContacts.map(c => c.username).join(', ')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">暂无紧急联系人</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={startRecording}
                  disabled={isRecording}
                  className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Mic size={24} />
                  {isRecording ? '正在录制语音...' : '录制紧急语音留言（可选）'}
                </button>

                {voiceMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check size={16} className="text-green-500" />
                      <span className="text-sm text-green-700">语音留言已录制</span>
                    </div>
                    <audio src={voiceMessage} controls className="h-8" />
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancelSOS}
                  className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition"
                >
                  <X size={20} className="inline mr-2" />
                  取消求助
                </button>
                <button
                  onClick={handleActivateSOS}
                  className="flex-1 py-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition animate-pulse"
                >
                  <AlertTriangle size={20} className="inline mr-2" />
                  立即求助
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-red-500 text-white p-6 text-center">
              <AlertTriangle size={64} className="mx-auto mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold mb-2">求助信号已发送！</h2>
              <p className="text-red-100">正在通知您的家人和紧急联系人</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <MapPin size={20} className="text-red-500 mt-1 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-700">您的位置已发送</p>
                    {location ? (
                      <p className="text-sm text-red-600 mt-1">
                        纬度: {location.latitude.toFixed(6)}<br />
                        经度: {location.longitude.toFixed(6)}
                        {getGoogleMapsUrl() && (
                          <a 
                            href={getGoogleMapsUrl()} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-block mt-2 text-blue-600 hover:underline"
                          >
                            在地图中查看
                          </a>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm text-red-500">正在获取位置...</p>
                    )}
                  </div>
                </div>
              </div>

              {voiceMessage && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="font-medium text-orange-700 mb-2">您的语音留言</p>
                  <audio src={voiceMessage} controls className="w-full" />
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <strong>已通知：</strong>
                  {elderlyInfo?.name || '您的家人'}
                  {emergencyContacts.length > 0 && `、${emergencyContacts.map(c => c.username).join('、')}`}
                </p>
              </div>

              <button
                onClick={handleConfirmSOS}
                className="w-full py-4 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 transition"
              >
                <Check size={20} className="inline mr-2" />
                我已安全，确认收到
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SOSAlert;
