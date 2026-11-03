import React, { useState, useRef } from 'react';
import { Camera, Loader, CheckCircle, RefreshCw, Plus, Volume2, VolumeX, X, Upload, Image } from 'lucide-react';
import { requestAICompletion } from '../../services/ai';

const MedicineScanner = ({ isOpen, onClose, onAddMedication, isLoggedIn }) => {
  const [step, setStep] = useState('init');
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const currentTextRef = useRef(null);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      currentTextRef.current = text;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
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
      const aiResponse = data.choices?.[0]?.message?.content;
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
      alert('请选择图片文件');
      return;
    }

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const recognizeMedicine = async () => {
    try {
      setErrorMessage('');
      setStep('loading');
      const result = await recognizeMedicineWithAI(previewUrl);
      setRecognitionResult(result);
      setStep('result');
      setTimeout(() => {
        speakText(`识别成功！药品名称：${result.name}。用法用量：${result.usage}。主要功效：${result.effect}`);
      }, 500);
    } catch (err) {
      console.error('识别失败:', err);
      setErrorMessage('识别服务暂时不可用，请稍后重试或咨询药师。请勿根据未确认的信息服药。');
      setStep('preview');
    }
  };

  const restartScanning = () => {
    setRecognitionResult(null);
    setPreviewUrl(null);
    setStep('init');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddToMedication = () => {
    if (onAddMedication) {
      onAddMedication(recognitionResult, previewUrl);
    }
    // 注意：弹窗关闭由父组件决定（登录状态下关闭，未登录状态下不关闭）
  };

  const handleClose = () => {
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }
    setStep('init');
    setRecognitionResult(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  if (step === 'init') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="bg-primary text-white p-4 flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold">上传药盒图片</h2>
            <button onClick={handleClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X size={24} />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <div className="text-center mb-4 sm:mb-6">
              <Image className="w-16 sm:w-20 h-16 sm:h-20 text-primary mx-auto mb-3 sm:mb-4" />
              <h3 className="text-lg sm:text-xl font-bold text-dark mb-2">识别药品信息</h3>
              <p className="text-gray-600">上传药盒照片，AI将自动识别药品</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleUploadClick}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition ${
                isDragging
                  ? 'border-primary bg-orange-50'
                  : 'border-gray-300 hover:border-primary hover:bg-orange-50'
              }`}
            >
              <Upload className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-base sm:text-lg font-medium text-gray-700 mb-2">
                点击或拖拽上传药盒图片
              </p>
              <p className="text-sm text-gray-500">
                支持 JPG、PNG 格式
              </p>
            </div>

            <div className="mt-4 sm:mt-6 space-y-3">
              <div className="bg-yellow-50 rounded-xl p-3 sm:p-4">
                <p className="text-sm text-yellow-800">
                  <strong>温馨提示：</strong>请上传药盒正面照片，确保药名和用法清晰可见，这样识别更准确！
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 sm:p-4">
                <p className="text-sm text-orange-800">
                  <strong>隐私说明：</strong>您上传的图片仅用于药品识别，不会被存储或用于其他目的
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 mt-4 text-gray-500 text-lg min-h-[44px]"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
          <div className="bg-primary text-white p-4 flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold">确认图片</h2>
            <button onClick={handleClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X size={24} />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6 rounded-xl overflow-hidden bg-gray-100">
              <img
                src={previewUrl}
                alt="药盒预览"
                className="w-full h-auto max-h-64 sm:max-h-96 object-contain"
              />
            </div>

            <p className="text-center text-gray-600 mb-4 sm:mb-6">
              图片已上传，确认后开始识别
            </p>

            {errorMessage && (
              <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <div className="space-y-3">
              <button
                onClick={recognizeMedicine}
                className="w-full py-4 bg-primary text-white text-lg sm:text-xl font-bold rounded-xl flex items-center justify-center min-h-[44px]"
              >
                <Camera className="mr-2" />
                开始识别
              </button>

              <button
                onClick={restartScanning}
                className="w-full py-3 bg-gray-100 text-gray-700 text-lg rounded-xl min-h-[44px]"
              >
                重新上传
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="fixed inset-0 bg-primary flex flex-col items-center justify-center z-50">
        <div className="text-center text-white p-4">
          <Loader className="w-12 sm:w-16 h-12 sm:h-16 mx-auto mb-4 sm:mb-6 animate-spin" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">药师正在努力识别中...</h2>
          <p className="text-lg sm:text-xl mb-2">正在分析药盒信息</p>
          <p className="text-white/80">请稍候...</p>
        </div>
      </div>
    );
  }

  if (step === 'result' && recognitionResult) {
    return (
      <div className="fixed inset-0 bg-light flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden mx-4">
          <div className="bg-primary text-white p-4 flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold">识别结果</h2>
            <button onClick={handleClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X size={24} />
            </button>
          </div>

          <div className="p-4 sm:p-6">
            <div className="text-center mb-4 sm:mb-6">
              <CheckCircle className="w-12 sm:w-16 h-12 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
              <h3 className="text-xl sm:text-2xl font-bold">识别成功！</h3>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div className="bg-orange-50 p-3 sm:p-4 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">药品名称</p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{recognitionResult.name}</p>
              </div>

              <div className="bg-orange-100 p-3 sm:p-4 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">用法用量</p>
                <p className="text-lg sm:text-xl font-bold text-dark">{recognitionResult.usage}</p>
              </div>

              <div className="bg-orange-50 p-3 sm:p-4 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">主要功效</p>
                <p className="text-base sm:text-lg text-dark">{recognitionResult.effect}</p>
              </div>

              <div className="bg-orange-100 p-3 sm:p-4 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">服用频率</p>
                <p className="text-base sm:text-lg text-dark">{recognitionResult.frequency}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 sm:mb-6 bg-yellow-50 p-3 rounded-xl">
              <p className="text-sm text-gray-600">{isSpeaking ? '正在播报中...' : '点击播放语音播报'}</p>
              <button
                onClick={() => {
                  const text = `药品名称：${recognitionResult.name}。用法用量：${recognitionResult.usage}。主要功效：${recognitionResult.effect}。服用频率：${recognitionResult.frequency}`;
                  if (isSpeaking) {
                    stopSpeaking();
                  } else {
                    speakText(text);
                  }
                }}
                className={`p-3 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center transition-all ${isSpeaking ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white hover:bg-primary/90'}`}
              >
                {isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}
              </button>
            </div>

            <div className="space-y-3">
              {isLoggedIn && (
                <button
                  onClick={handleAddToMedication}
                  className="w-full py-4 bg-primary text-white text-lg sm:text-xl font-bold rounded-xl flex items-center justify-center min-h-[44px]"
                >
                  <Plus className="mr-2" />
                  加入用药提醒
                </button>
              )}

              <button
                onClick={restartScanning}
                className="w-full py-3 bg-gray-100 text-gray-700 text-lg rounded-xl flex items-center justify-center min-h-[44px]"
              >
                <RefreshCw className="mr-2" />
                继续扫描其他药盒
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default MedicineScanner;
