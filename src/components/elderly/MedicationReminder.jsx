import React, { useEffect, useRef } from 'react';
import { Check, Clock, X } from 'lucide-react';

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
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance();
      utterance.text = `您好，现在是服药时间，请服用${medication?.name || '药品'}，剂量为${medication?.dosage || '标准剂量'}。`;
      utterance.lang = 'zh-CN';
      utterance.volume = 1;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      // 等待音乐开始后再播放语音
      speechTimerRef.current = setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 1000);
    }
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
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden mx-4 animate-fade-in">
        {/* 头部 */}
        <div className="bg-primary text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center">
            <Clock className="mr-3" size={28} />
            服药提醒
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={24} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-8">
          {/* 提醒图标 */}
          <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center animate-pulse">
              <Clock size={48} className="text-red-500" />
            </div>
          </div>

          {/* 药品信息 */}
          <div className="bg-gray-50 rounded-xl p-6 mb-8">
            <div className="text-center">
              <p className="text-gray-500 text-lg mb-2">药品名称</p>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">{medication?.name || '未知药品'}</h3>
              
              <p className="text-gray-500 text-lg mb-2">剂量</p>
              <p className="text-xl font-semibold text-gray-800">{medication?.dosage || '未知剂量'}</p>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-4">
            {/* 确认已服按钮 */}
            <button
              onClick={() => {
                stopAllAudio();
                onConfirm();
              }}
              className="w-full py-4 bg-green-500 text-white text-xl font-bold rounded-xl flex items-center justify-center min-h-[44px] hover:bg-green-600 transition-colors"
            >
              <Check className="mr-3" size={24} />
              确认已服
            </button>

            {/* 稍后提醒按钮 */}
            <button
              onClick={() => {
                stopAllAudio();
                onSnooze();
              }}
              className="w-full py-4 bg-gray-200 text-gray-700 text-xl font-bold rounded-xl flex items-center justify-center min-h-[44px] hover:bg-gray-300 transition-colors"
            >
              <Clock className="mr-3" size={24} />
              稍后提醒
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationReminder;
