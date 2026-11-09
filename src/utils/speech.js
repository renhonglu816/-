import { cleanAIText } from './text';

const getChineseVoice = synthesis => {
  const voices = synthesis.getVoices?.() || [];
  return voices.find(voice => /^zh[-_](CN|Hans)/i.test(voice.lang))
    || voices.find(voice => /^zh/i.test(voice.lang))
    || null;
};

export const stopSpeech = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
};

export const speakChinese = (text, options = {}) => {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  const content = cleanAIText(text);
  if (!content) return false;
  const synthesis = window.speechSynthesis;
  synthesis.cancel();
  const utterance = new window.SpeechSynthesisUtterance(content);
  utterance.lang = 'zh-CN';
  utterance.rate = options.rate ?? 0.92;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;
  utterance.voice = getChineseVoice(synthesis);
  utterance.onstart = options.onStart || null;
  utterance.onend = options.onEnd || null;
  utterance.onerror = options.onError || null;
  synthesis.resume?.();
  window.setTimeout(() => {
    synthesis.resume?.();
    synthesis.speak(utterance);
  }, 30);
  return true;
};
