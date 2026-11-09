import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ChevronRight, Menu, MessageSquarePlus, Mic, MicOff, Pill, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { requestAICompletion } from '../../services/ai';
import MedicineScanner from './MedicineScanner';
import XiaoNuan from '../XiaoNuan';
import { brandAsset } from '../../utils/assets';
import { cleanAIText } from '../../utils/text';
import { speakChinese, stopSpeech } from '../../utils/speech';

const suggestions = ['这几种药能一起吃吗？', '忘记吃药该怎么办？', '用药期间要注意什么？'];
const emptyMessages = [];
const getChatStorageKey = () => {
  try {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return `xiaonuanChats_${user.id || localStorage.getItem('userId') || 'guest'}`;
  } catch (_error) {
    return 'xiaonuanChats_guest';
  }
};
const loadChats = key => {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    const conversations = Array.isArray(stored.conversations) ? stored.conversations.filter(item => item?.id && Array.isArray(item.messages)) : [];
    return { conversations, activeId: conversations.some(item => item.id === stored.activeId) ? stored.activeId : null };
  } catch (_error) {
    return { conversations: [], activeId: null };
  }
};
const dateGroup = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '更早';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = item => `${item.getFullYear()}-${item.getMonth()}-${item.getDate()}`;
  return key(date) === key(today) ? '今天' : key(date) === key(yesterday) ? '昨天' : '更早';
};

const AIMedicationAdvisor = ({ isOpen, onClose, currentMedications = [], pageMode = false }) => {
  const storageKey = useRef(getChatStorageKey()).current;
  const [chatState, setChatState] = useState(() => loadChats(storageKey));
  const [processingIds, setProcessingIds] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [historyStorageError, setHistoryStorageError] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [mascotVideoFailed, setMascotVideoFailed] = useState(false);
  const [mascotReplayToken, setMascotReplayToken] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const conversationRef = useRef(null);
  const mascotVideoRef = useRef(null);
  const lastPlayedReplayTokenRef = useRef(0);
  const activeConversation = chatState.conversations.find(item => item.id === chatState.activeId);
  const messages = activeConversation?.messages || emptyMessages;
  const isProcessing = processingIds.includes(chatState.activeId);
  const sortedConversations = [...chatState.conversations].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(chatState));
      setHistoryStorageError(false);
    } catch (_error) {
      setHistoryStorageError(true);
    }
  }, [chatState, storageKey]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return undefined;
    const update = () => setReduceMotion(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      stopSpeech();
      setIsListening(false);
      setSpeakingId(null);
      setPickerOpen(false);
      setScannerOpen(false);
      setDrawerOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!pickerOpen && !scannerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [pickerOpen, scannerOpen]);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages, isProcessing]);

  const stopSpeaking = () => {
    stopSpeech();
    setSpeakingId(null);
  };

  const replayMascot = useCallback(() => {
    if (reduceMotion || mascotVideoFailed) return;
    const video = mascotVideoRef.current;
    if (!video) return;
    video.pause();
    try { video.currentTime = 0; } catch (_error) { /* 视频尚未载入时，play 会从起点开始。 */ }
    video.play().catch(() => {});
  }, [reduceMotion, mascotVideoFailed]);

  useEffect(() => {
    if (mascotReplayToken > lastPlayedReplayTokenRef.current && isOpen && !drawerOpen) {
      lastPlayedReplayTokenRef.current = mascotReplayToken;
      replayMascot();
    }
  }, [mascotReplayToken, isOpen, drawerOpen, replayMascot]);

  const toggleSpeaking = message => {
    if (speakingId === message.id) {
      stopSpeaking();
      return;
    }
    if (!window.speechSynthesis) {
      setNotice('当前浏览器暂不支持语音播报。');
      return;
    }
    stopSpeaking();
    setSpeakingId(message.id);
    const started = speakChinese(cleanAIText(message.content), {
      onEnd: () => setSpeakingId(null),
      onError: () => { setSpeakingId(null); setNotice('语音播报暂时失败，请再点一次。'); },
    });
    if (!started) setSpeakingId(null);
  };

  const toggleListening = async () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotice('当前浏览器未开放语音识别，请使用系统键盘的麦克风输入。');
      inputRef.current?.focus({ preventScroll: false });
      return;
    }
    stopSpeaking();
    setNotice('');
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (_error) {
      setNotice('请允许麦克风权限后再试。');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = event => {
      const transcript = Array.from(event.results || []).map(result => result?.[0]?.transcript || '').join('').trim();
      if (transcript) setInputText(cleanAIText(transcript));
    };
    recognition.onerror = event => {
      if (event.error !== 'aborted') setNotice('没有听清，请再试一次或打字提问。');
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (_error) {
      recognitionRef.current = null;
      setNotice('语音输入暂时无法启动，请打字提问。');
    }
  };

  const sendMessage = async question => {
    const text = question.trim();
    if (!text || isProcessing) return;
    const conversationId = chatState.activeId || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    recognitionRef.current?.stop();
    stopSpeaking();
    setNotice('');
    setInputText('');
    setProcessingIds(previous => [...previous, conversationId]);
    const nextMessages = [...messages, { id: `${conversationId}-user-${Date.now()}`, role: 'user', content: selectedMedication ? `【${selectedMedication.name}】${text}` : text }];
    setChatState(previous => {
      const exists = previous.conversations.some(item => item.id === conversationId);
      return {
        activeId: conversationId,
        conversations: exists
          ? previous.conversations.map(item => item.id === conversationId ? { ...item, messages: nextMessages, updatedAt: now } : item)
          : [...previous.conversations, { id: conversationId, title: text.slice(0, 32), createdAt: now, updatedAt: now, messages: nextMessages }],
      };
    });

    try {
      const medicationNames = currentMedications.filter(med => med.is_active !== false).map(med => med.name || med).filter(Boolean).join('、');
      const selectedContext = selectedMedication ? `本次选中的药品：${selectedMedication.name}。${selectedMedication.usage ? `识别或记录的用法用量：${selectedMedication.usage}。` : ''}${selectedMedication.frequency ? `服用频率：${selectedMedication.frequency}。` : ''}以上信息可能不完整或识别有误，先提醒用户核对药盒。` : '';
      const data = await requestAICompletion({
        messages: [
          { role: 'system', content: `你是面向长者的用药咨询助手“小暖”。用简短、清楚的中文回答，每次先回答问题，再给必要的提醒。不要自行诊断、决定停药或调整处方剂量；涉及严重症状或用药风险时建议及时联系医生或药师。用户当前记录的药品：${medicationNames || '未提供'}。${selectedContext}药品清单可能不完整，不能仅凭清单断言药物同服安全。` },
          ...nextMessages.map(message => ({ role: message.role, content: message.content })),
        ],
        temperature: 0.2,
      });
      const answer = cleanAIText(data.choices?.[0]?.message?.content);
      if (!answer) throw new Error('AI 返回内容为空');
      setChatState(previous => ({ ...previous, conversations: previous.conversations.map(item => item.id === conversationId ? { ...item, updatedAt: new Date().toISOString(), messages: [...item.messages, { id: `${conversationId}-assistant-${Date.now()}`, role: 'assistant', content: answer }] } : item) }));
    } catch (error) {
      console.error('用药咨询失败:', error);
      setChatState(previous => ({ ...previous, conversations: previous.conversations.map(item => item.id === conversationId ? { ...item, updatedAt: new Date().toISOString(), messages: [...item.messages, { id: `${conversationId}-error-${Date.now()}`, role: 'assistant', content: '暂时无法回答，请稍后再试。急需用药帮助时请联系医生或药师。' }] } : item) }));
    } finally {
      setProcessingIds(previous => previous.filter(id => id !== conversationId));
    }
  };

  const startNewConversation = () => {
    stopSpeaking();
    recognitionRef.current?.stop();
    setChatState(previous => ({ ...previous, activeId: null }));
    setSelectedMedication(null);
    setInputText('');
    setNotice('');
    setDrawerOpen(false);
    setMascotReplayToken(previous => previous + 1);
  };

  const openConversation = id => {
    stopSpeaking();
    recognitionRef.current?.stop();
    setChatState(previous => ({ ...previous, activeId: id }));
    setSelectedMedication(null);
    setInputText('');
    setNotice('');
    setDrawerOpen(false);
  };

  if (!isOpen) return null;
  const hasConversation = messages.length > 0;

  return (
    <div className={pageMode ? 'feature-page feature-page--advisor' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4'}>
      <div className={`${pageMode ? 'feature-page__surface feature-page__surface--advisor' : 'mx-auto flex max-h-[95vh] min-h-[600px] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white'} advisor-page ${hasConversation ? 'is-chat' : 'is-welcome'}`}>
        <header className="feature-page__header advisor-page__header">
          <div className="advisor-page__header-controls">
            {pageMode && <button type="button" className="advisor-page__back-button" onClick={onClose} aria-label="返回今日用药"><ArrowLeft size={26} /></button>}
            <button type="button" className="advisor-page__menu-button" onClick={() => setDrawerOpen(true)} aria-label="打开对话记录" aria-expanded={drawerOpen} aria-controls="advisor-history-drawer"><Menu size={24} /></button>
          </div>
          <div className="advisor-page__identity">
            <div className="advisor-page__identity-copy">
              {hasConversation ? (
                <><h2 className="advisor-page__chat-title">问小暖</h2><p>您的用药小助手</p></>
              ) : (
                <><h2><span className="advisor-page__intro">您好，我是</span><span className="advisor-page__mascot-name"><picture><source srcSet={brandAsset('yaoxiaonuan-wordmark.webp')} type="image/webp" /><img src={brandAsset('yaoxiaonuan-wordmark.png')} alt="药小暖" width="420" height="148" decoding="async" fetchPriority="high" /></picture></span></h2><p>陪您认药、查药，有疑问随时问我</p></>
              )}
            </div>
            <button type="button" className="advisor-page__mascot-button" onClick={replayMascot} disabled={reduceMotion || mascotVideoFailed} aria-label={reduceMotion || mascotVideoFailed ? '药小暖静态形象' : '重播药小暖动画'}>{reduceMotion || mascotVideoFailed ? <img src={brandAsset('yaoxiaonuan-wave-poster.jpg')} alt="" /> : <video ref={mascotVideoRef} autoPlay muted playsInline preload="auto" poster={brandAsset('yaoxiaonuan-wave-poster.jpg')} onError={() => setMascotVideoFailed(true)}><source src={brandAsset('yaoxiaonuan-wave.mp4')} type="video/mp4" /></video>}</button>
          </div>
          {!pageMode && <button type="button" onClick={onClose} className="advisor-page__close" aria-label="关闭问小暖"><X size={24} /></button>}
        </header>

        <div className="advisor-page__medication-tools">
          {!hasConversation && <h3><Sparkles size={22} /> 告诉我想查询的药品</h3>}
          <div className="advisor-page__tool-options">
            <button type="button" className="advisor-page__scan-cta" onClick={() => { setPickerOpen(false); setScannerOpen(true); }}><Camera size={29} /><span><strong>拍药盒</strong><small>拍清药名</small></span><ChevronRight size={23} /></button>
            <button type="button" className="advisor-page__medication-picker" onClick={() => setPickerOpen(true)}><Pill size={24} /><span><strong>{selectedMedication ? selectedMedication.name : '选择当前用药'}</strong><small>{selectedMedication ? '更换药品' : `已记录 ${currentMedications.filter(med => med.is_active !== false).length} 种`}</small></span><ChevronRight size={18} /></button>
          </div>
        </div>

        <div className="advisor-page__conversation" ref={conversationRef} role="log" aria-label="与小暖的对话">
          {!hasConversation && <div className="advisor-page__welcome"><h3>试着问</h3><div className="advisor-page__suggestions">{suggestions.map(question => <button type="button" key={question} onClick={() => sendMessage(question)}>{question}</button>)}</div></div>}
          {messages.map(message => <div key={message.id} className={`advisor-message-row ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>{message.role === 'assistant' && <XiaoNuan size="tiny" pose="smile" className="advisor-message-avatar" />}<div className="advisor-message"><p>{cleanAIText(message.content)}</p>{message.role === 'assistant' && <button type="button" onClick={() => toggleSpeaking(message)} aria-label={speakingId === message.id ? '停止播报回答' : '播报回答'}>{speakingId === message.id ? <VolumeX size={20} /> : <Volume2 size={20} />}</button>}</div></div>)}
          {isProcessing && <div className="advisor-message-row is-assistant"><div className="advisor-message advisor-message--thinking">小暖正在想…</div></div>}
        </div>

        <div className="advisor-composer">
          {notice && <p className="advisor-composer__notice" role="status">{notice}</p>}
          {!hasConversation && <button type="button" className="advisor-composer__quick-select" onClick={() => setPickerOpen(true)}><Pill size={19} />选择药品</button>}
          <form className="advisor-composer__row" onSubmit={event => { event.preventDefault(); sendMessage(inputText); }}>
            <button type="button" onClick={toggleListening} className={`advisor-composer__voice ${isListening ? 'is-listening' : ''}`} aria-label={isListening ? '停止语音输入' : '语音提问'}>{isListening ? <MicOff size={25} /> : <Mic size={25} />}</button>
            <input ref={inputRef} type="text" value={inputText} onChange={event => setInputText(event.target.value)} placeholder={isListening ? '正在听您说话…' : '输入用药问题'} className="advisor-composer__input" aria-label="输入用药问题" enterKeyHint="send" autoComplete="off" />
            <button type="submit" disabled={!inputText.trim() || isProcessing} className="advisor-composer__send" aria-label="发送问题"><Send size={24} /></button>
          </form>
          <div className="advisor-composer__footer">{selectedMedication && <div className="advisor-composer__selected"><Pill size={17} /><span>已选药品：{selectedMedication.name}</span><button type="button" onClick={() => setSelectedMedication(null)} aria-label="取消选药"><X size={18} /></button></div>}<p className="advisor-composer__hint">回答仅供参考，用药请遵医嘱。</p></div>
        </div>
        {pickerOpen && <div className="advisor-picker-backdrop" onClick={() => setPickerOpen(false)}><section className="advisor-picker" role="dialog" aria-modal="true" aria-label="选择药品" onClick={event => event.stopPropagation()}><header><div><h3>当前用药</h3><p>选一款药，再向小暖提问</p></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="关闭药品列表"><X size={23} /></button></header><div className="advisor-picker__list">{currentMedications.filter(med => med.is_active !== false).length ? currentMedications.filter(med => med.is_active !== false).map((med, index) => <button type="button" key={med.id || index} onClick={() => { setSelectedMedication(typeof med === 'string' ? { name: med } : med); setPickerOpen(false); }}><Pill size={20} /><span><strong>{med.name || med}</strong><small>{[med.time, med.dosage].filter(Boolean).join(' · ') || '点击选择'}</small></span><ChevronRight size={19} /></button>) : <p className="advisor-picker__empty">还没有记录用药，可以拍药盒识别。</p>}</div><button type="button" className="advisor-picker__scan" onClick={() => { setPickerOpen(false); setScannerOpen(true); }}><Camera size={21} />拍照识药</button></section></div>}
        {drawerOpen && <div className="advisor-history-layer" onClick={() => setDrawerOpen(false)}>
          <aside id="advisor-history-drawer" className="advisor-history-drawer" role="dialog" aria-modal="true" aria-label="问小暖对话记录" onClick={event => event.stopPropagation()}>
            <div className="advisor-history-drawer__header"><div><strong>问小暖</strong><span>对话记录</span></div><button type="button" onClick={() => setDrawerOpen(false)} aria-label="关闭对话记录"><X size={23} /></button></div>
            <button type="button" className="advisor-history-drawer__new" onClick={startNewConversation}><MessageSquarePlus size={24} /> 开启新对话</button>
            <div className="advisor-history-drawer__list">
              <h3>对话记录</h3>
              {sortedConversations.length ? ['今天', '昨天', '更早'].map(group => {
                const items = sortedConversations.filter(item => dateGroup(item.updatedAt || item.createdAt) === group);
                return items.length ? <section key={group} className="advisor-history-drawer__group"><h4>{group}</h4>{items.map(item => <button type="button" key={item.id} className={item.id === chatState.activeId ? 'is-active' : ''} onClick={() => openConversation(item.id)} aria-current={item.id === chatState.activeId ? 'page' : undefined}>{item.title || '新对话'}</button>)}</section> : null;
              }) : <p className="advisor-history-drawer__empty">还没有对话记录。可以开启新对话，或直接点击问题提问。</p>}
            </div>
            <p className="advisor-history-drawer__note" role={historyStorageError ? 'alert' : undefined}>{historyStorageError ? '浏览器暂时无法保存对话记录，请检查存储空间。' : '对话记录保存在当前浏览器中。'}</p>
          </aside>
        </div>}
      </div>
      {scannerOpen && <MedicineScanner isOpen pageMode overlayMode backLabel="返回问小暖" onClose={() => setScannerOpen(false)} onSelectMedicine={medicine => { setSelectedMedication(medicine); setScannerOpen(false); }} />}
    </div>
  );
};

export default AIMedicationAdvisor;
