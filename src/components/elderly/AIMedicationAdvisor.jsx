import React, { useState, useEffect } from 'react';
import { Mic, MicOff, X, Send, User, Bot, Volume2, VolumeX, Activity, Pill, AlertTriangle, Info, CheckCircle, Shield } from 'lucide-react';
import { requestAICompletion } from '../../services/ai';

const AIMedicationAdvisor = ({ isOpen, onClose, currentMedications = [] }) => {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState(null);
  const [showDrugInteraction, setShowDrugInteraction] = useState(false);
  const [interactionResults, setInteractionResults] = useState([]);

  const drugDatabase = {
    '阿司匹林': { 
      category: '解热镇痛抗炎药', 
      interactions: ['华法林', '布洛芬', '甲氨蝶呤'],
      sideEffects: ['胃肠道出血', '出血倾向', '过敏反应'],
      warnings: ['出血性疾病患者禁用', '手术前停药7天']
    },
    '华法林': { 
      category: '抗凝药', 
      interactions: ['阿司匹林', '布洛芬', '维生素K', '甲硝唑'],
      sideEffects: ['出血', '骨质疏松', '皮肤坏死'],
      warnings: ['需定期监测INR', '避免大量维生素K摄入']
    },
    '布洛芬': { 
      category: '解热镇痛抗炎药', 
      interactions: ['阿司匹林', '华法林', '甲氨蝶呤', '地高辛'],
      sideEffects: ['胃肠道不适', '肾功能损害', '心血管风险'],
      warnings: ['胃溃疡患者禁用', '长期使用需监测肾功能']
    },
    '甲氨蝶呤': { 
      category: '免疫抑制剂', 
      interactions: ['阿司匹林', '布洛芬', '青霉素', '磺胺类'],
      sideEffects: ['骨髓抑制', '肝毒性', '肺毒性'],
      warnings: ['孕妇禁用', '需定期监测血常规和肝功能']
    },
    '二甲双胍': { 
      category: '降糖药', 
      interactions: ['造影剂', '酒精', 'ACE抑制剂'],
      sideEffects: ['胃肠道反应', '维生素B12缺乏', '乳酸酸中毒'],
      warnings: ['严重肝肾功能不全禁用', '造影剂使用前后停药']
    },
    '氨氯地平': { 
      category: '降压药', 
      interactions: ['辛伐他汀', '西柚汁', '酮康唑'],
      sideEffects: ['外周水肿', '头痛', '面部潮红'],
      warnings: ['严重主动脉狭窄禁用', '突然停药可致心绞痛']
    },
    '辛伐他汀': { 
      category: '降脂药', 
      interactions: ['氨氯地平', '红霉素', '酮康唑', '葡萄柚汁'],
      sideEffects: ['肌痛', '肝功能异常', '横纹肌溶解'],
      warnings: ['避免与氨氯地平合用高剂量', '定期监测肌酸激酶']
    },
    '地高辛': { 
      category: '强心药', 
      interactions: ['布洛芬', '奎尼丁', '胺碘酮', '螺内酯'],
      sideEffects: ['心律失常', '恶心', '视觉异常'],
      warnings: ['低钾血症禁用', '需监测血药浓度']
    }
  };

  const speakText = (text, messageId) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(voice => 
        voice.lang.includes('zh') && (voice.name.includes('女') || voice.name.includes('Female'))
      );
      if (femaleVoice) {
        utterance.voice = femaleVoice;
      }
      
      setIsSpeaking(true);
      setCurrentSpeakingId(messageId);
      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setCurrentSpeakingId(null);
      };
      window.speechSynthesis.speak(utterance);
    }
  };
  
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentSpeakingId(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const welcomeId = Date.now();
      setMessages([
        {
          id: welcomeId,
          role: "assistant",
          content: "您好！我是您的AI用药顾问。我不仅可以回答您的用药问题，还可以帮您分析药物之间的相互作用，确保您的用药安全。请随时问我任何关于药品的问题！"
        }
      ]);
      
      setTimeout(() => {
        speakText("您好！我是您的AI用药顾问。我不仅可以回答您的用药问题，还可以帮您分析药物之间的相互作用，确保您的用药安全。请随时问我任何关于药品的问题！", welcomeId);
      }, 800);
    } else {
      stopSpeaking();
    }
  }, [isOpen]);

  const checkDrugInteractions = (drugName) => {
    const drug = drugDatabase[drugName];
    if (!drug) return null;

    const interactions = [];
    
    currentMedications.forEach(med => {
      const medName = med.name || med;
      if (drug.interactions.includes(medName)) {
        interactions.push({
          drug1: drugName,
          drug2: medName,
          severity: 'high',
          description: `${drugName}与${medName}合用可能增加${drug.sideEffects[0]}的风险。`
        });
      }
    });

    Object.keys(drugDatabase).forEach(otherDrug => {
      if (otherDrug !== drugName && drug.interactions.includes(otherDrug)) {
        const otherDrugInfo = drugDatabase[otherDrug];
        if (!interactions.some(i => i.drug2 === otherDrug)) {
          interactions.push({
            drug1: drugName,
            drug2: otherDrug,
            severity: 'medium',
            description: `${drugName}与${otherDrug}可能存在相互作用。${otherDrugInfo.warnings[0]}。`
          });
        }
      }
    });

    return interactions;
  };

  const analyzeCurrentMedications = () => {
    const results = [];
    
    currentMedications.forEach((med) => {
      const medName = med.name || med;
      const drug = drugDatabase[medName];
      
      if (drug) {
        const interactions = checkDrugInteractions(medName);
        if (interactions && interactions.length > 0) {
          results.push(...interactions);
        }
      }
    });

    return results;
  };

  const handleAnalyzeInteractions = () => {
    const results = analyzeCurrentMedications();
    setInteractionResults(results);
    setShowDrugInteraction(true);

    const analysisMessage = results.length > 0
      ? `我分析了您当前的用药情况，发现了${results.length}个需要注意的药物相互作用问题。`
      : `我分析了您当前的用药情况，没有发现明显的药物相互作用问题。但请遵医嘱用药。`;

    const messageId = Date.now();
    setMessages(prev => [...prev, {
      id: messageId,
      role: 'assistant',
      content: analysisMessage
    }]);
    
    setTimeout(() => speakText(analysisMessage, messageId), 500);
  };

  const handleQueryDrug = (drugName) => {
    const drug = drugDatabase[drugName];
    const messageId = Date.now();

    if (drug) {
      const info = `【${drugName}】\n\n药品类别：${drug.category}\n\n主要副作用：\n${drug.sideEffects.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n注意事项：\n${drug.warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\n常见相互作用：\n${drug.interactions.slice(0, 3).join('、')}等`;

      setMessages(prev => [...prev, {
        id: messageId,
        role: 'assistant',
        content: info
      }]);
      
      setTimeout(() => speakText(info, messageId), 500);
    } else {
      const notFound = `抱歉，我在数据库中没有找到"${drugName}"的详细信息。这个药可能是新药或者不在我的数据库中。建议您咨询医生或药师获取更准确的信息。`;
      setMessages(prev => [...prev, {
        id: messageId,
        role: 'assistant',
        content: notFound
      }]);
      
      setTimeout(() => speakText(notFound, messageId), 500);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;
    
    const userMessage = inputText.trim().toLowerCase();
    setInputText('');
    setIsProcessing(true);
    
    const updatedMessages = [...messages, { id: Date.now(), role: 'user', content: userMessage }];
    setMessages(updatedMessages);

    let quickResponse = null;
    
    if (userMessage.includes('相互作用') || userMessage.includes('分析')) {
      handleAnalyzeInteractions();
      setIsProcessing(false);
      return;
    }

    if (userMessage.includes('查询') || userMessage.includes('信息')) {
      const drugNames = Object.keys(drugDatabase);
      for (const name of drugNames) {
        if (userMessage.includes(name.toLowerCase())) {
          handleQueryDrug(name);
          setIsProcessing(false);
          return;
        }
      }
    }

    Object.keys(drugDatabase).forEach(drugName => {
      if (userMessage.includes(drugName.toLowerCase())) {
        handleQueryDrug(drugName);
        setIsProcessing(false);
        quickResponse = 'found';
      }
    });

    if (quickResponse) return;

    try {
      const apiMessages = [
        { role: "system", content: "你是一名服务中老年人的资深AI数智人药师。要求：1. 语言必须极度通俗易懂（大白话），语气像对待长辈一样温暖。2. 如果用户提供了年龄、病史等信息，请结合这些信息给出专业的用药解答，不要再重复询问基本信息。3. 绝不私自建议患者修改处方药剂量，遇高危症状立即建议就医。4. 如果用户询问的是常用药物（如阿司匹林、华法林等），可以结合药品数据库给出更专业的回答。5. 建议用户定期体检和监测相关指标。" },
        ...updatedMessages.map(msg => ({ role: msg.role, content: msg.content }))
      ];
      
      const data = await requestAICompletion({
        messages: apiMessages,
        temperature: 0.2,
      });
      const aiResponse = data.choices?.[0]?.message?.content;
      if (!aiResponse) throw new Error('AI 返回内容为空');
      const aiId = Date.now();

      setMessages(prev => [...prev, { id: aiId, role: 'assistant', content: aiResponse }]);
      setTimeout(() => speakText(aiResponse, aiId), 500);
      
    } catch (error) {
      console.error('API 调用失败:', error);
      setMessages(prev => [...prev, { 
        id: Date.now(),
        role: 'assistant', 
        content: '抱歉，网络暂时不稳定，请稍后再试。您也可以尝试说"分析药物相互作用"来检查您当前的用药安全。'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      stopSpeaking();
      setIsListening(true);
      setTimeout(() => {
        setInputText('帮我分析药物相互作用');
        setIsListening(false);
      }, 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col mx-auto" style={{ maxHeight: '95vh', height: 'auto', minHeight: '600px' }}>
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-5 sm:p-6 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-full">
              <Activity size={28} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">AI用药顾问</h2>
              <p className="text-sm sm:text-base opacity-90">药物相互作用分析 · 专业用药咨询</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full min-h-[56px] min-w-[56px] flex items-center justify-center transition-all">
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-gradient-to-b from-orange-50 to-white">
          {currentMedications.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Pill size={20} className="text-orange-600" />
                <p className="font-semibold text-orange-800">当前用药（{currentMedications.length}种）</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentMedications.map((med, idx) => (
                  <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {med.name || med}
                  </span>
                ))}
              </div>
              <button
                onClick={handleAnalyzeInteractions}
                className="mt-3 w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center justify-center gap-2"
              >
                <Shield size={18} />
                分析药物相互作用
              </button>
            </div>
          )}

          {showDrugInteraction && interactionResults.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={20} className="text-red-600" />
                <p className="font-semibold text-red-800">发现{interactionResults.length}个相互作用</p>
              </div>
              <div className="space-y-3">
                {interactionResults.map((result, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-red-100">
                    <p className="font-medium text-red-700">{result.drug1} + {result.drug2}</p>
                    <p className="text-sm text-red-600 mt-1">{result.description}</p>
                    <p className="text-xs text-red-500 mt-1">风险等级: {result.severity === 'high' ? '高' : '中'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showDrugInteraction && interactionResults.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} className="text-green-600" />
                <p className="font-semibold text-green-800">未发现明显相互作用</p>
              </div>
              <p className="text-sm text-green-600 mt-2">您的当前用药组合相对安全，但仍需遵医嘱用药。</p>
            </div>
          )}

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info size={20} className="text-orange-600" />
              <p className="font-semibold text-orange-800">支持的药品查询</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(drugDatabase).map(drug => (
                <button
                  key={drug}
                  onClick={() => handleQueryDrug(drug)}
                  className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200 transition"
                >
                  {drug}
                </button>
              ))}
            </div>
          </div>

          {messages.map((msg) => {
            if (msg.role === 'system' && !msg.isWarning) {
              return null;
            }
            return (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.isWarning ? 'justify-center' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-4 sm:p-5 rounded-3xl relative shadow-md ${msg.role === 'user' ? 'bg-orange-500 text-white' : msg.isWarning ? 'bg-yellow-100 text-yellow-900 w-full' : 'bg-white text-gray-800 border-2 border-orange-100'}`}>
                  <div className="flex items-start gap-3">
                    {msg.role === 'assistant' && !msg.isWarning && (
                      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-2 rounded-full flex-shrink-0">
                        <Bot size={24} />
                      </div>
                    )}
                    {msg.role === 'user' && (
                      <div className="bg-orange-400 text-white p-2 rounded-full flex-shrink-0">
                        <User size={24} />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="whitespace-pre-line text-base sm:text-lg leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                  
                  {msg.role === 'assistant' && !msg.isWarning && (
                    <button
                      onClick={() => {
                        if (isSpeaking && currentSpeakingId === msg.id) {
                          stopSpeaking();
                        } else {
                          speakText(msg.content, msg.id);
                        }
                      }}
                      className={`absolute -bottom-3 -right-3 p-3 rounded-full shadow-lg min-h-[52px] min-w-[52px] flex items-center justify-center transition-all ${isSpeaking && currentSpeakingId === msg.id ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-green-500 text-white hover:bg-green-600 hover:scale-105'}`}
                    >
                      {isSpeaking && currentSpeakingId === msg.id ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-white p-5 rounded-3xl shadow-md border-2 border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <p className="text-lg text-gray-600">AI药师正在分析...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 bg-white border-t-4 border-purple-200">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={toggleListening} className={`p-4 sm:p-5 rounded-full shadow-lg transition-all duration-300 min-h-[64px] min-w-[64px] flex items-center justify-center flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse scale-110' : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white hover:scale-105 hover:shadow-xl'}`}>
              {isListening ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
            
            <div className="flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="输入用药问题，或点击话筒直接说话..."
                className="w-full p-4 text-lg sm:text-xl border-3 border-purple-200 rounded-2xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-200 min-h-[60px]"
              />
            </div>
            
            <button onClick={handleSendMessage} disabled={!inputText.trim() || isProcessing} className="p-4 sm:p-5 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl shadow-lg disabled:opacity-50 disabled:shadow-none min-h-[64px] min-w-[64px] flex items-center justify-center hover:scale-105 transition-all disabled:hover:scale-100 flex-shrink-0">
              <Send size={28} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIMedicationAdvisor;
