import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, AlertTriangle, Activity, Pill, User, Download, Share, X } from 'lucide-react';

const MedicationReport = ({ isOpen, onClose, boundElderly }) => {
  const [dateRange, setDateRange] = useState('week');
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHasError(false);
      loadReportData();
    }
  }, [isOpen, dateRange, boundElderly]);

  const loadReportData = () => {
    try {
      setIsLoading(true);
      
      const elderlyId = boundElderly?.elderlyId || localStorage.getItem('currentElderlyId');
      const storedMedications = localStorage.getItem(`medications_${elderlyId}`);
      const medications = storedMedications ? JSON.parse(storedMedications) : [];

      const now = new Date();
      let startDate = new Date();
      
      switch (dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      const filteredMedications = medications.filter(med => {
        if (!med.takenTime) return false;
        const takenDate = new Date(med.takenTime);
        return takenDate >= startDate;
      });

      const totalScheduled = calculateScheduledCount(medications, startDate, now);
      const totalTaken = filteredMedications.filter(m => m.status === 'taken').length;
      const totalMissed = filteredMedications.filter(m => m.status === 'missed').length;
      const totalPending = filteredMedications.filter(m => m.status === 'pending').length;

      const complianceRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;
      const onTimeRate = calculateOnTimeRate(filteredMedications);
      const averageTakenTime = calculateAverageTakenTime(filteredMedications);

      const weeklyData = generateWeeklyData(medications, now);
      const drugAnalysis = analyzeDrugs(medications);

      let riskLevel = 'low';
      if (complianceRate < 70 || onTimeRate < 70) {
        riskLevel = 'high';
      } else if (complianceRate < 85 || onTimeRate < 85) {
        riskLevel = 'medium';
      }

      setReportData({
        elderlyName: boundElderly?.realName || localStorage.getItem('elderlyName') || '长者',
        elderlyId,
        totalScheduled,
        totalTaken,
        totalMissed,
        totalPending,
        complianceRate,
        onTimeRate,
        averageTakenTime,
        riskLevel,
        weeklyData,
        drugAnalysis,
        generatedAt: now.toISOString(),
        dateRange
      });
    } catch (error) {
      console.error('加载报告数据出错:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateScheduledCount = (medications, startDate, endDate) => {
    let count = 0;
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    medications.forEach(med => {
      if (med.time) {
        count += days;
      }
    });
    
    return count;
  };

  const calculateOnTimeRate = (takenMedications) => {
    if (takenMedications.length === 0) return 100;
    
    let onTimeCount = 0;
    takenMedications.forEach(med => {
      if (med.scheduledTime && med.actualTakenTime) {
        const [schedHour, schedMin] = med.scheduledTime.split(':').map(Number);
        const [actualHour, actualMin] = med.actualTakenTime.split(':').map(Number);
        
        const schedTotalMin = schedHour * 60 + schedMin;
        const actualTotalMin = actualHour * 60 + actualMin;
        
        if (actualTotalMin - schedTotalMin <= 30 && actualTotalMin >= schedTotalMin) {
          onTimeCount++;
        }
      }
    });
    
    return Math.round((onTimeCount / takenMedications.length) * 100);
  };

  const calculateAverageTakenTime = (takenMedications) => {
    if (takenMedications.length === 0) return '--:--';
    
    let totalMinutes = 0;
    let count = 0;
    takenMedications.forEach(med => {
      if (med.actualTakenTime) {
        const [hours, minutes] = med.actualTakenTime.split(':').map(Number);
        totalMinutes += hours * 60 + minutes;
        count++;
      }
    });
    
    if (count === 0) return '--:--';
    
    const avgMinutes = Math.round(totalMinutes / count);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const generateWeeklyData = (medications, now) => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayMeds = medications.filter(m => {
        if (!m.takenTime) return false;
        const medDate = new Date(m.takenTime).toISOString().split('T')[0];
        return medDate === dateStr;
      });
      
      const taken = dayMeds.filter(m => m.status === 'taken').length;
      const total = dayMeds.length || medications.length > 0 ? medications.length : 0;
      
      days.push({
        date: dateStr,
        dayName: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
        taken,
        total: total || medications.length,
        rate: total > 0 ? Math.round((taken / total) * 100) : 0
      });
    }
    return days;
  };

  const analyzeDrugs = (medications) => {
    const drugStats = {};
    
    medications.forEach(med => {
      const name = med.name || '未知';
      if (!drugStats[name]) {
        drugStats[name] = { taken: 0, missed: 0, pending: 0, total: 0 };
      }
      drugStats[name].total++;
      if (med.status === 'taken') drugStats[name].taken++;
      else if (med.status === 'missed') drugStats[name].missed++;
      else drugStats[name].pending++;
    });
    
    return Object.entries(drugStats).map(([name, stats]) => ({
      name,
      ...stats,
      rate: stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0
    }));
  };

  const getRiskLevelInfo = (level) => {
    switch (level) {
      case 'low':
        return { text: '低风险', color: 'text-green-600 bg-green-100', icon: CheckCircle };
      case 'medium':
        return { text: '中等风险', color: 'text-yellow-600 bg-yellow-100', icon: AlertTriangle };
      case 'high':
        return { text: '高风险', color: 'text-red-600 bg-red-100', icon: XCircle };
      default:
        return { text: '未知', color: 'text-gray-600 bg-gray-100', icon: Activity };
    }
  };

  const handleExportReport = () => {
    if (!reportData) return;
    
    const reportText = `
========================================
      服药行为报告
========================================
报告对象: ${reportData.elderlyName}
报告生成时间: ${new Date(reportData.generatedAt).toLocaleString('zh-CN')}
报告周期: ${dateRange === 'today' ? '今日' : dateRange === 'week' ? '近7天' : '近30天'}

【服药统计】
- 应服药次数: ${reportData.totalScheduled}
- 已服药次数: ${reportData.totalTaken}
- 漏服次数: ${reportData.totalMissed}
- 待服药次数: ${reportData.totalPending}

【服药指标】
- 遵医嘱率: ${reportData.complianceRate}%
- 准时服药率: ${reportData.onTimeRate}%
- 平均服药时间: ${reportData.averageTakenTime}

【风险等级】
${reportData.riskLevel === 'low' ? '✅ 低风险 - 服药情况良好' : 
  reportData.riskLevel === 'medium' ? '⚠️ 中等风险 - 建议关注服药情况' : 
  '🚨 高风险 - 需要立即关注和干预'}

【健康建议】
${reportData.complianceRate < 80 ? '• 服药遵医嘱率偏低，建议与长者沟通了解原因\n' : ''}
${reportData.onTimeRate < 80 ? '• 准时服药率有提升空间，建议设置更多提醒\n' : ''}
${reportData.complianceRate >= 90 ? '• 服药习惯非常好，请继续保持！\n' : ''}

========================================
      药记得 - 您的智能用药助手
========================================
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `服药报告_${reportData.elderlyName}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareReport = () => {
    if (!reportData || !navigator.share) return;
    
    navigator.share({
      title: `${reportData.elderlyName}的服药报告`,
      text: `${reportData.elderlyName}的服药报告：遵医嘱率${reportData.complianceRate}%，准时率${reportData.onTimeRate}%，风险等级${getRiskLevelInfo(reportData.riskLevel).text}`,
      url: window.location.href
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto mx-4">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <Activity size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">服药行为报告</h2>
                <p className="text-green-100">
                  {boundElderly?.name || localStorage.getItem('elderlyName') || '长者'}的服药记录
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleExportReport}
                className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full min-h-[56px] min-w-[56px] flex items-center justify-center"
                title="导出报告"
              >
                <Download size={24} />
              </button>
              <button 
                onClick={onClose}
                className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full min-h-[56px] min-w-[56px] flex items-center justify-center"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setDateRange('today')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === 'today' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                今日
              </button>
              <button
                onClick={() => setDateRange('week')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === 'week' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                近7天
              </button>
              <button
                onClick={() => setDateRange('month')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === 'month' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                近30天
              </button>
            </div>

            {reportData && (
              <div className="flex gap-2">
                <button
                  onClick={handleExportReport}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition flex items-center gap-2"
                >
                  <Download size={18} />
                  导出
                </button>
                <button
                  onClick={handleShareReport}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-2"
                >
                  <Share size={18} />
                  分享
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">加载报告数据中...</p>
            </div>
          ) : hasError ? (
            <div className="text-center py-12 text-red-500">
              <AlertTriangle size={64} className="mx-auto mb-4" />
              <p className="text-xl font-bold">加载报告失败</p>
              <p className="text-sm mt-2">请确保已绑定长者账号</p>
              <button 
                onClick={loadReportData}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg"
              >
                重试
              </button>
            </div>
          ) : reportData ? (
            <>
              <div className="mb-6">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <User className="text-green-600" />
                      {reportData.elderlyName}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskLevelInfo(reportData.riskLevel).color}`}>
                      {getRiskLevelInfo(reportData.riskLevel).text}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-green-600">{reportData.complianceRate}%</p>
                      <p className="text-sm text-gray-600 mt-1">遵医嘱率</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-blue-600">{reportData.onTimeRate}%</p>
                      <p className="text-sm text-gray-600 mt-1">准时率</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-purple-600">{reportData.totalTaken}</p>
                      <p className="text-sm text-gray-600 mt-1">已服药(次)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-bold text-red-600">{reportData.totalMissed}</p>
                      <p className="text-sm text-gray-600 mt-1">漏服(次)</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Calendar className="text-blue-600" />
                    近7日服药趋势
                  </h3>
                  <div className="grid grid-cols-7 gap-2">
                    {reportData.weeklyData.map((day, index) => (
                      <div key={index} className="text-center">
                        <p className="text-xs text-gray-500 mb-2">周{day.dayName}</p>
                        <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                          <div 
                            className={`absolute bottom-0 w-full transition-all ${
                              day.rate >= 90 ? 'bg-green-500' :
                              day.rate >= 70 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ height: `${day.rate}%` }}
                          ></div>
                        </div>
                        <p className="text-xs font-medium mt-2">{day.rate}%</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Pill className="text-purple-600" />
                    药品服药分析
                  </h3>
                  {reportData.drugAnalysis.length > 0 ? (
                    <div className="space-y-3">
                      {reportData.drugAnalysis.map((drug, index) => (
                        <div key={index} className="bg-white rounded-xl p-4 border-2 border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-bold text-lg">{drug.name}</p>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              drug.rate >= 90 ? 'bg-green-100 text-green-700' :
                              drug.rate >= 70 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {drug.rate}%
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>已服: {drug.taken}</span>
                            <span>漏服: {drug.missed}</span>
                            <span>待服: {drug.pending}</span>
                          </div>
                          <div className="mt-2 bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all ${
                                drug.rate >= 90 ? 'bg-green-500' :
                                drug.rate >= 70 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${drug.rate}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                      <Pill size={48} className="mx-auto mb-3 text-gray-300" />
                      <p>暂无药品数据</p>
                    </div>
                  )}
                </div>

                <div className={`rounded-xl p-6 border-2 ${
                  reportData.riskLevel === 'low' ? 'bg-green-50 border-green-200' :
                  reportData.riskLevel === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <AlertTriangle size={24} className={
                      reportData.riskLevel === 'low' ? 'text-green-600' :
                      reportData.riskLevel === 'medium' ? 'text-yellow-600' :
                      'text-red-600'
                    } />
                    健康建议
                  </h3>
                  <div className="space-y-2">
                    {reportData.complianceRate < 70 && (
                      <p className="text-red-700">
                        ⚠️ {reportData.elderlyName}的服药遵医嘱率偏低（{reportData.complianceRate}%），建议及时沟通了解原因，必要时寻求医生帮助。
                      </p>
                    )}
                    {reportData.complianceRate >= 70 && reportData.complianceRate < 85 && (
                      <p className="text-yellow-700">
                        ⚡ {reportData.elderlyName}的服药情况有改善空间，遵医嘱率为{reportData.complianceRate}%，建议适当增加提醒。
                      </p>
                    )}
                    {reportData.complianceRate >= 85 && (
                      <p className="text-green-700">
                        ✅ {reportData.elderlyName}的服药情况良好，遵医嘱率为{reportData.complianceRate}%，继续保持！
                      </p>
                    )}
                    {reportData.totalMissed > 5 && (
                      <p className="text-red-700 mt-2">
                        🚨 近{dateRange === 'today' ? '今日' : dateRange === 'week' ? '7天' : '30天'}漏服次数达{reportData.totalMissed}次，建议重点关注。
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Activity size={64} className="mx-auto mb-4 text-gray-300" />
              <p className="text-xl">暂无报告数据</p>
              <p className="text-sm mt-2">请确保已绑定长者账号</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationReport;
