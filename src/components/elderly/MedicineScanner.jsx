import React, { useState } from 'react';
import XiaoNuan from '../XiaoNuan';
import { ArrowLeft, Camera, CheckCircle, RefreshCw, Plus, Volume2, VolumeX, X, Image, Package } from 'lucide-react';
import { requestAICompletion } from '../../services/ai';
import { cleanAIText } from '../../utils/text';
import { speakChinese, stopSpeech } from '../../utils/speech';

const MedicineScanner = ({ isOpen, onClose, onAddMedication, onSelectMedicine, isLoggedIn, pageMode = false, overlayMode = false, backLabel = '返回今日用药' }) => {
  const [step, setStep] = useState('init');
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const speakText = (text) => {
    const started = speakChinese(cleanAIText(text), {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
    if (!started) setIsSpeaking(false);
  };

  const stopSpeaking = () => {
    stopSpeech();
    setIsSpeaking(false);
  };

  const recognizeMedicineWithAI = async (imageData) => {
    try {
      // 这里将图片数据转换为 base64
      const base64Image = imageData.split(',')[1];
      
      const data = await requestAICompletion({
        messages: [
            {
              role: "system",
              content: '识别药品。返回格式：药品名称：|用法用量：|主要功效：|服用频率：|'
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "识别药盒"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                    detail: "low"
                  }
                }
              ]
            }
        ],
        temperature: 0.1,
        max_tokens: 300,
      });
      const aiResponse = cleanAIText(data.choices?.[0]?.message?.content);
      if (!aiResponse) throw new Error('AI 返回内容为空');
      
      // 解析 AI 响应，提取药品信息 - 优化版
      const result = {
        name: "",
        usage: "",
        effect: "",
        frequency: ""
      };

      const match = (str, key) => {
        const regex = new RegExp(`${key}：(.+?)(?=$|药品名称|用法用量|主要功效|服用频率)`);
        const found = str.match(regex);
        return found ? found[1].trim() : '';
      };

      result.name = match(aiResponse, '药品名称');
      result.usage = match(aiResponse, '用法用量');
      result.effect = match(aiResponse, '主要功效');
      result.frequency = match(aiResponse, '服用频率');

      // 如果上面没找到，尝试用换行分隔
      if (!result.name) {
        const lines = aiResponse.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          if (line.includes('药品名称')) result.name = line.split(/[：:]/)[1]?.trim() || '';
          if (line.includes('用法用量')) result.usage = line.split(/[：:]/)[1]?.trim() || '';
          if (line.includes('主要功效')) result.effect = line.split(/[：:]/)[1]?.trim() || '';
          if (line.includes('服用频率')) result.frequency = line.split(/[：:]/)[1]?.trim() || '';
        });
      }

      if (!result.name) {
        throw new Error('无法识别药品信息');
      }

      return result;
    } catch (error) {
      console.error('AI 识别失败:', error);
      throw error;
    }
  };

  const handleFileSelect = (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMessage('请选择药盒照片。');
      return;
    }

    stopSpeaking();
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
      setStep('preview');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const recognizeMedicine = async () => {
    try {
      setErrorMessage('');
      setStep('loading');
      const result = await recognizeMedicineWithAI(previewUrl);
      setRecognitionResult(result);
      setShowDetails(false);
      setStep('result');
    } catch (err) {
      console.error('识别失败:', err);
      setErrorMessage('识别失败，请重新拍摄或稍后重试。请勿根据未确认的信息服药。');
      setStep('preview');
    }
  };

  const restartScanning = () => {
    stopSpeaking();
    setRecognitionResult(null);
    setPreviewUrl(null);
    setShowDetails(false);
    setErrorMessage('');
    setStep('init');
  };

  const handleAddToMedication = () => {
    if (onSelectMedicine) {
      onSelectMedicine(recognitionResult);
      return;
    }
    if (onAddMedication) {
      onAddMedication(recognitionResult, previewUrl);
    }
    // 注意：弹窗关闭由父组件决定（登录状态下关闭，未登录状态下不关闭）
  };

  const handleClose = () => {
    stopSpeaking();
    setStep('init');
    setRecognitionResult(null);
    setPreviewUrl(null);
    setShowDetails(false);
    setErrorMessage('');
    if (onClose) onClose();
  };

  if (!isOpen) return null;
  const pageRootClass = overlayMode ? 'feature-page feature-page--scanner-overlay' : 'feature-page';
  const pageBack = pageMode && <button type="button" onClick={handleClose} className="scanner-page__back" aria-label={backLabel}><ArrowLeft size={24} /></button>;

  if (step === 'init') {
    return (
      <div className={pageMode ? pageRootClass : 'scanner-modal fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'}>
        <div className={`${pageMode ? 'feature-page__surface' : 'bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden'} scanner-page`}>
          <div className="feature-page__header scanner-page__header">
            <div>
              {pageBack}
              <h2>拍药盒</h2>
            </div>
            {!pageMode && (
              <button onClick={handleClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={24} />
              </button>
            )}
          </div>

          <div className="scanner-page__content scanner-page__content--capture">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`scanner-capture-stage ${isDragging ? 'is-dragging' : ''}`}
            >
              <span className="scanner-capture-stage__corners" aria-hidden="true" />
              <span className="scanner-capture-stage__box" aria-hidden="true"><Package size={64} strokeWidth={1.5} /></span>
              <strong>对准药盒正面，拍清药名</strong>
              <div className="scanner-mascot-tip"><XiaoNuan size="small" pose="guide" /><span>请让药名完整入镜。</span></div>
            </div>
            {errorMessage && <p role="alert" className="scanner-error">{errorMessage}</p>}
            <div className="scanner-page__actions scanner-page__actions--capture">
              <label className="scanner-primary-button scanner-file-button" htmlFor="scanner-camera-input"><Camera size={23} /> 拍照</label>
              <input id="scanner-camera-input" type="file" accept="image/*" capture="environment" onChange={handleFileInputChange} className="sr-only" />
              <label className="scanner-secondary-button scanner-file-button" htmlFor="scanner-album-input"><Image size={22} /> 从相册选择</label>
              <input id="scanner-album-input" type="file" accept="image/*" onChange={handleFileInputChange} className="sr-only" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className={pageMode ? pageRootClass : 'scanner-modal fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'}>
        <div className={`${pageMode ? 'feature-page__surface' : 'bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden'} scanner-page`}>
          <div className="feature-page__header scanner-page__header scanner-page__header--compact">
            <div>
              {pageBack}
              <h2>确认照片</h2>
            </div>
            {!pageMode && (
              <button onClick={handleClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={24} />
              </button>
            )}
          </div>

          <div className="scanner-page__content">
            <div className="scanner-preview-card">
              <img
                src={previewUrl}
                alt="药盒预览"
                className="w-full h-auto max-h-64 sm:max-h-96 object-contain"
              />
            </div>

            {errorMessage && (
              <p role="alert" className="scanner-error">
                <XiaoNuan size="tiny" pose="worried" /> {errorMessage}
              </p>
            )}

            <div className="scanner-page__actions">
              <button
                onClick={recognizeMedicine}
                className="scanner-primary-button"
              >
                <CheckCircle size={22} />
                开始识别
              </button>

              <button
                onClick={restartScanning}
                className="scanner-secondary-button"
              >
                重新拍
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className={pageMode ? `${pageRootClass} feature-page--loading scanner-loading flex flex-col items-center justify-center` : 'fixed inset-0 bg-primary flex flex-col items-center justify-center z-50'}>
        <div className="scanner-loading__card" role="status" aria-live="polite">
          <div className="scanner-loading__visual" aria-hidden="true">
            <span className="scanner-loading__corner scanner-loading__corner--tl" />
            <span className="scanner-loading__corner scanner-loading__corner--tr" />
            <span className="scanner-loading__corner scanner-loading__corner--bl" />
            <span className="scanner-loading__corner scanner-loading__corner--br" />
            <Package size={54} strokeWidth={1.8} />
            <span className="scanner-loading__beam" />
          </div>
          <div className="scanner-loading__copy">
            <p className="scanner-loading__eyebrow">AI 智能识别</p>
            <h2>正在识别药盒</h2>
            <p>正在读取药名和规格，请稍候</p>
          </div>
          <div className="scanner-loading__progress" aria-hidden="true"><span /></div>
          <div className="scanner-loading__companion">
            <XiaoNuan size="small" pose="wait" />
            <div><strong>小暖正在认真核对</strong><span>请保持页面开启，很快就好</span></div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'result' && recognitionResult) {
    return (
      <div className={pageMode ? `${pageRootClass} scanner-result-page` : 'scanner-modal scanner-result-page fixed inset-0 bg-light flex items-center justify-center z-50 p-4'}>
        <div className={`${pageMode ? 'feature-page__surface' : 'bg-white rounded-2xl w-full max-w-lg overflow-hidden mx-4'} scanner-page scanner-result-page__surface`}>
          <div className="feature-page__header scanner-page__header scanner-page__header--compact scanner-result-header">
            <div>
              {pageBack}
              <div><h2>识别结果</h2><p>请核对后再添加到用药计划</p></div>
            </div>
            {!pageMode && (
              <button onClick={handleClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X size={24} />
              </button>
            )}
          </div>

          <div className="scanner-page__content scanner-result-content">
            <section className="scanner-result-hero" aria-label="识别已完成">
              <div className="scanner-result-hero__preview">
                {previewUrl ? <img src={previewUrl} alt="刚刚拍摄的药盒" /> : <Package size={34} />}
                <span><CheckCircle size={17} /></span>
              </div>
              <div><span>识别完成</span><strong>已读取药盒信息</strong><small>请对照实物逐项确认</small></div>
            </section>
            <section className="scanner-result-card" aria-label="识别出的药品信息">
              <div className="scanner-result-card__name"><div><span>识别到的药品</span><h3>{recognitionResult.name}</h3></div><button type="button" onClick={() => {
                if (isSpeaking) stopSpeaking();
                else speakText(`药品名称：${recognitionResult.name}。用法用量：${recognitionResult.usage || '未识别'}。服用频率：${recognitionResult.frequency || '未识别'}。`);
              }} aria-label={isSpeaking ? '停止语音播报' : '播报药品信息'} title={isSpeaking ? '停止播报' : '语音播报'}>{isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}</button></div>
              <div className="scanner-result-card__fields">
                <div className="scanner-result-card__field"><span>用法用量</span><strong>{recognitionResult.usage || '未识别，请查看药盒'}</strong></div>
                <div className="scanner-result-card__field"><span>服用频率</span><strong>{recognitionResult.frequency || '未识别，请查看药盒'}</strong></div>
              </div>
              {recognitionResult.effect && <><button type="button" className="scanner-result-card__details-toggle" onClick={() => setShowDetails(!showDetails)} aria-expanded={showDetails}>{showDetails ? '收起详细信息' : '查看详细信息'}</button>{showDetails && <div className="scanner-result-card__field"><span>主要功效</span><strong>{recognitionResult.effect}</strong></div>}</>}
            </section>
            <p className="scanner-result-warning"><CheckCircle size={20} /><span><strong>添加前请核对</strong>AI 识别内容仅供参考，请以药盒和医嘱为准。</span></p>

            <div className="scanner-page__actions">
              <button onClick={handleAddToMedication} className="scanner-primary-button"><Plus size={22} />{onSelectMedicine ? '用这款药提问' : isLoggedIn ? '核对后添加用药' : '登录后添加用药'}</button>

              <button onClick={restartScanning} className="scanner-secondary-button"><RefreshCw size={21} />重新拍摄</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MedicineScanner;
