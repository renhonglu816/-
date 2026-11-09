import React, { useEffect, useRef } from 'react';
import { Check, Clock, Pill, X } from 'lucide-react';
import XiaoNuan from '../XiaoNuan';
import { speakChinese, stopSpeech } from '../../utils/speech';

const MedicationReminder = ({ isOpen, onClose, medication, onConfirm, onSnooze }) => {
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const melodyTimerRef = useRef(null);
  const speechTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      playSoothingMusic();
      speakReminder();
    }
    return () => {
      stopAllAudio();
    };
  }, [isOpen, medication]);

  const playSoothingMusic = () => {
    // 创建音频上下文
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.().catch(() => {});
    audioContextRef.current = ctx;
    
    // 创建 oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    // 设置舒缓的参数
    osc.frequency.setValueAtTime(440, ctx.currentTime); // A4 音符
    osc.type = 'sine';
    
    // 音量控制 - 更柔和
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    
    // 创建舒缓的旋律
    osc.frequency.exponentialRampToValueAtTime(493.88, ctx.currentTime + 1); // B4
    osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 2); // C5
    osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 3); // D5
    osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 4); // C5
    osc.frequency.exponentialRampToValueAtTime(493.88, ctx.currentTime + 5); // B4
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 6); // A4
    
    // 音量渐变
    gain.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 6);
    
    // 播放声音
    osc.start(ctx.currentTime);
    
    // 7秒后停止
    melodyTimerRef.current = setTimeout(() => {
      try {
        osc.stop(ctx.currentTime + 1);
      } catch (_error) {
        // 音频可能已在弹窗关闭时停止。
      }
    }, 7000);
    
    oscillatorRef.current = osc;
  };

  const speakReminder = () => {
    speechTimerRef.current = setTimeout(() => {
      speakChinese(`您好，现在是服药时间，请服用${medication?.name || '药品'}，剂量为${medication?.dosage || '标准剂量'}。`);
    }, 1000);
  };

  const stopAllAudio = () => {
    // 停止音频
    if (melodyTimerRef.current) {
      clearTimeout(melodyTimerRef.current);
      melodyTimerRef.current = null;
    }
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (_error) {
        // 已停止的振荡器再次停止会抛出异常，可安全忽略。
      }
      oscillatorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    // 停止语音
    stopSpeech();
    
  };

  if (!isOpen) return null;

  return (
    <div className="medication-reminder-layer">
      <section className="medication-reminder-modal animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="medication-reminder-title">
        <header className="medication-reminder-header">
          <span className="medication-reminder-header__icon" aria-hidden="true"><Clock size={26} /></span>
          <div><p>按时服药，安心每一天</p><h2 id="medication-reminder-title">服药提醒</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭服药提醒"><X size={23} /></button>
        </header>

        <div className="medication-reminder-body">
          <div className="medication-reminder-intro">
            <XiaoNuan size="small" pose="guide" />
            <div><strong>到服药时间啦</strong><span>请先核对药名和剂量</span></div>
            <span className="medication-reminder-time"><Clock size={17} />{medication?.time || '现在'}</span>
          </div>

          <section className="medication-reminder-medicine" aria-label="本次服药信息">
            <span className="medication-reminder-medicine__icon"><Pill size={30} /></span>
            <div><span>本次需要服用</span><h3>{medication?.name || '未知药品'}</h3></div>
            <div className="medication-reminder-dose"><span>剂量</span><strong>{medication?.dosage || '请查看药盒'}</strong></div>
          </section>

          <p className="medication-reminder-note">服用前请确认药盒与医嘱；如有疑问，请先咨询家人或医生。</p>

          <div className="medication-reminder-actions">
            <button
              onClick={() => {
                stopAllAudio();
                onConfirm();
              }}
              className="medication-reminder-confirm"
            >
              <Check size={24} />
              确认已服
            </button>

            <button
              onClick={() => {
                stopAllAudio();
                onSnooze();
              }}
              className="medication-reminder-snooze"
            >
              <Clock size={22} />
              5分钟后提醒
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MedicationReminder;
