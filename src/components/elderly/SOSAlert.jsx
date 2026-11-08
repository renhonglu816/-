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
    <div className="sos-alert-layer">
      <section className={`sos-alert-modal ${isActivated ? 'is-sent' : 'is-pending'}`} role="dialog" aria-modal="true" aria-labelledby="sos-alert-title">
        {!isActivated ? (
          <>
            <header className="sos-alert-hero">
              <span className="sos-alert-hero__icon"><AlertTriangle size={36} /></span>
              <div><h2 id="sos-alert-title">紧急求助</h2><p>确认后将立即通知家人与紧急联系人</p></div>
              <strong className="sos-alert-countdown"><b>{countdown}</b><small>秒后发送</small></strong>
            </header>

            <div className="sos-alert-body">
              <p className="sos-alert-cancel-note">如果是误触，请在倒计时结束前取消求助。</p>

              <div className="sos-alert-status-list">
                <article className="sos-alert-status-card">
                  <span><MapPin size={23} /></span>
                  <div><strong>当前位置</strong>
                    {location ? (
                      <small>定位已获取，将随求助信息发送</small>
                    ) : locationError ? (
                      <small className="is-error">暂时无法获取定位：{locationError}</small>
                    ) : (
                      <small>正在获取位置…</small>
                    )}
                  </div>
                </article>

                <article className="sos-alert-status-card">
                  <span><Phone size={23} /></span>
                  <div><strong>通知对象</strong>
                    {emergencyContacts.length > 0 ? (
                      <small>{emergencyContacts.map(c => c.username).join('、')}</small>
                    ) : (
                      <small>家人与默认紧急联系人</small>
                    )}
                  </div>
                </article>
              </div>

              <div className="sos-alert-voice">
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isRecording}
                  className={isRecording ? 'is-recording' : ''}
                >
                  <Mic size={24} />
                  {isRecording ? '正在录制语音…' : '录制语音留言（可选）'}
                </button>

                {voiceMessage && (
                  <div className="sos-alert-voice__ready">
                    <span><Check size={17} />语音留言已录制</span>
                    <audio src={voiceMessage} controls className="h-8" />
                  </div>
                )}
              </div>

              <footer className="sos-alert-actions">
                <button
                  type="button"
                  onClick={handleCancelSOS}
                  className="sos-alert-actions__cancel"
                >
                  <X size={21} />
                  取消求助
                </button>
                <button
                  type="button"
                  onClick={handleActivateSOS}
                  className="sos-alert-actions__send"
                >
                  <AlertTriangle size={21} />
                  立即求助
                </button>
              </footer>
            </div>
          </>
        ) : (
          <>
            <header className="sos-alert-hero sos-alert-hero--sent">
              <span className="sos-alert-hero__icon"><Check size={38} /></span>
              <div><p className="sos-alert-hero__eyebrow">求助信息发送成功</p><h2 id="sos-alert-title">家人正在收到通知</h2><p>请保持手机畅通，并留在安全的位置</p></div>
            </header>

            <div className="sos-alert-body">
              <div className="sos-alert-sent-summary"><AlertTriangle size={23} /><p><strong>求助信号已发送</strong><small>系统正在联系您的家人与紧急联系人</small></p></div>

              <div className="sos-alert-status-list">
                <article className="sos-alert-status-card is-sent">
                  <span><MapPin size={23} /></span>
                  <div><strong>位置状态</strong>
                    {location ? (
                      <small>
                        定位已发送
                        {getGoogleMapsUrl() && (
                          <a 
                            href={getGoogleMapsUrl()} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="sos-alert-map-link"
                          >
                            查看地图
                          </a>
                        )}
                      </small>
                    ) : (
                      <small>正在获取并补充定位…</small>
                    )}
                  </div>
                </article>

                <article className="sos-alert-status-card is-sent">
                  <span><Phone size={23} /></span>
                  <div><strong>已通知</strong><small>{elderlyInfo?.name || '您的家人'}{emergencyContacts.length > 0 && `、${emergencyContacts.map(c => c.username).join('、')}`}</small></div>
                </article>
              </div>

              {voiceMessage && (
                <div className="sos-alert-sent-voice">
                  <strong>已附上语音留言</strong>
                  <audio src={voiceMessage} controls className="w-full" />
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmSOS}
                className="sos-alert-safe-button"
              >
                <Check size={22} />
                我已安全，确认收到
              </button>
              <p className="sos-alert-stay-note">如果仍处于危险中，请不要关闭此页面。</p>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default SOSAlert;
