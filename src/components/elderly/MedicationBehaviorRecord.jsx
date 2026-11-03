import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Activity, Pill } from 'lucide-react';

const MedicationBehaviorRecord = ({ isOpen, onClose, medications = [] }) => {
  const [dateRange, setDateRange] = useState('week');
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (isOpen) {
      generateReport();
    }
  }, [isOpen, dateRange, medications]);

  const generateReport = () => {
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

    const totalScheduled = getScheduledCount(startDate, now);
    const totalTaken = filteredMedications.filter(m => m.status === 'taken').length;
    const totalMissed = filteredMedications.filter(m => m.status === 'missed').length;
    const totalPending = filteredMedications.filter(m => m.status === 'pending').length;

    const complianceRate = totalScheduled > 0 ? Math.round((totalTaken / totalScheduled) * 100) : 0;

    const averageTakenTime = calculateAverageTakenTime(filteredMedications);
    const onTimeRate = calculateOnTimeRate(filteredMedications);

    const drugConsistency = calculateDrugConsistency(filteredMedications);
    const riskLevel = calculateRiskLevel(complianceRate, onTimeRate);

    setReportData({
      totalScheduled,
      totalTaken,
      totalMissed,
      totalPending,
      complianceRate,
      averageTakenTime,
      onTimeRate,
      drugConsistency,
      riskLevel,
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    });
  };

  const getScheduledCount = (startDate, endDate) => {
    let count = 0;
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    medications.forEach(med => {
      if (med.time) {
        count += days;
      }
    });
    
    return count;
  };

  const calculateAverageTakenTime = (takenMedications) => {
    if (takenMedications.length === 0) return null;
    
    let totalMinutes = 0;
    takenMedications.forEach(med => {
      if (med.actualTakenTime) {
        const [hours, minutes] = med.actualTakenTime.split(':').map(Number);
        totalMinutes += hours * 60 + minutes;
      }
    });
    
    const avgMinutes = Math.round(totalMinutes / takenMedications.length);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const calculateOnTimeRate = (takenMedications) => {
    if (takenMedications.length === 0) return 0;
    
    let onTimeCount = 0;
    takenMedications.forEach(med => {
      if (med.scheduledTime && med.actualTakenTime) {
        const [schedHour, schedMin] = med.scheduledTime.split(':').map(Number);
        const [actualHour, actualMin] = med.actualTakenTime.split(':').map(Number);
        
        const schedTotalMin = schedHour * 60 + schedMin;
        const actualTotalMin = actualHour * 60 + actualMin;
        
        if (actualTotalMin - schedTotalMin <= 30) {
          onTimeCount++;
        }
      }
    });
    
    return Math.round((onTimeCount / takenMedications.length) * 100);
  };

  const calculateDrugConsistency = (takenMedications) => {
    if (takenMedications.length < 2) return 100;
    
    const drugCounts = {};
    takenMedications.forEach(med => {
      const name = med.name || '未知';
      drugCounts[name] = (drugCounts[name] || 0) + 1;
    });
    
    const counts = Object.values(drugCounts);
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    
    return Math.round((minCount / maxCount) * 100);
  };

  const calculateRiskLevel = (complianceRate, onTimeRate) => {
    if (complianceRate >= 90 && onTimeRate >= 90) return 'low';
    if (complianceRate >= 70 && onTimeRate >= 70) return 'medium';
    return 'high';
  };

  const getRiskLevelText = (level) => {
    switch (level) {
      case 'low': return '低风险';
      case 'medium': return '中等风险';
      case 'high': return '高风险';
      default: return '未知';
    }
  };

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendIcon = (current, previous) => {
    if (current > previous) return <TrendingUp className="text-green-500" />;
    if (current < previous) return <TrendingDown className="text-red-500" />;
    return <Activity className="text-gray-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto mx-4">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-full">
                <Activity size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">服药行为记录与报告</h2>
                <p className="text-blue-100">详细记录每一次服药情况</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full min-h-[56px] min-w-[56px] flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => setDateRange('today')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === 'today' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                今日
              </button>
              <button
                onClick={() => setDateRange('week')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                近7天
              </button>
              <button
                onClick={() => setDateRange('month')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                近30天
              </button>
            </div>
          </div>

          {reportData && (
            <>
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Activity className="text-blue-600" />
                  服药行为报告
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle size={20} className="text-blue-600" />
                      <p className="text-sm text-blue-600 font-medium">已服用</p>
                    </div>
                    <p className="text-3xl font-bold text-blue-700">{reportData.totalTaken}</p>
                    <p className="text-xs text-blue-500 mt-1">次</p>
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle size={20} className="text-red-600" />
                      <p className="text-sm text-red-600 font-medium">漏服</p>
                    </div>
                    <p className="text-3xl font-bold text-red-700">{reportData.totalMissed}</p>
                    <p className="text-xs text-red-500 mt-1">次</p>
                  </div>

                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={20} className="text-yellow-600" />
                      <p className="text-sm text-yellow-600 font-medium">待服用</p>
                    </div>
                    <p className="text-3xl font-bold text-yellow-700">{reportData.totalPending}</p>
                    <p className="text-xs text-yellow-500 mt-1">次</p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={20} className="text-purple-600" />
                      <p className="text-sm text-purple-600 font-medium">风险等级</p>
                    </div>
                    <p className={`text-2xl font-bold ${getRiskLevelColor(reportData.riskLevel).split(' ')[0]}`}>
                      {getRiskLevelText(reportData.riskLevel)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">遵医嘱率</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-blue-600">{reportData.complianceRate}%</p>
                      {getTrendIcon(reportData.complianceRate, 80)}
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all" 
                        style={{ width: `${reportData.complianceRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">准时率</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-green-600">{reportData.onTimeRate}%</p>
                      {getTrendIcon(reportData.onTimeRate, 85)}
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all" 
                        style={{ width: `${reportData.onTimeRate}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 border-2 border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">药品一致性</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-indigo-600">{reportData.drugConsistency}%</p>
                      {getTrendIcon(reportData.drugConsistency, 90)}
                    </div>
                    <div className="mt-2 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full transition-all" 
                        style={{ width: `${reportData.drugConsistency}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Pill className="text-blue-600" />
                  药品服药明细
                </h3>
                
                <div className="space-y-3">
                  {medications.map((med) => (
                    <div key={med.id} className="bg-white rounded-xl p-4 border-2 border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${
                          med.status === 'taken' ? 'bg-green-100' : 
                          med.status === 'missed' ? 'bg-red-100' : 'bg-yellow-100'
                        }`}>
                          {med.status === 'taken' ? (
                            <CheckCircle size={24} className="text-green-600" />
                          ) : med.status === 'missed' ? (
                            <XCircle size={24} className="text-red-600" />
                          ) : (
                            <Clock size={24} className="text-yellow-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-lg">{med.name}</p>
                          <p className="text-sm text-gray-500">
                            应服时间: {med.time} | 剂量: {med.dosage || '标准'}
                          </p>
                          {med.takenTime && (
                            <p className="text-sm text-green-600">
                              实服时间: {med.takenTime}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        med.status === 'taken' ? 'bg-green-100 text-green-700' :
                        med.status === 'missed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {med.status === 'taken' ? '已服用' : 
                         med.status === 'missed' ? '漏服' : '待服用'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-bold mb-3">健康建议</h3>
                <div className="space-y-2 text-sm">
                  {reportData.complianceRate < 80 && (
                    <p className="text-yellow-700 flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                      您的服药遵医嘱率偏低，建议设置服药提醒或与医生讨论调整用药时间。
                    </p>
                  )}
                  {reportData.onTimeRate < 80 && (
                    <p className="text-orange-700 flex items-start gap-2">
                      <Clock size={16} className="mt-0.5 flex-shrink-0" />
                      您的准时服药率有提升空间，建议提前准备好药品，养成按时服药的习惯。
                    </p>
                  )}
                  {reportData.drugConsistency < 80 && (
                    <p className="text-purple-700 flex items-start gap-2">
                      <Pill size={16} className="mt-0.5 flex-shrink-0" />
                      各药品服用频次差异较大，请确保按时服用所有需要的药品。
                    </p>
                  )}
                  {reportData.complianceRate >= 90 && reportData.onTimeRate >= 90 && (
                    <p className="text-green-700 flex items-start gap-2">
                      <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                      您的服药习惯非常好！继续保持，您对健康的重视值得表扬。
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationBehaviorRecord;
