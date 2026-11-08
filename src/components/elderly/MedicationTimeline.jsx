import React, { useState } from 'react';
import { CheckCircle, Clock, AlertCircle, Trash2, Info } from 'lucide-react';

const MedicationTimeline = ({ medications, onToggleStatus, onDelete }) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpanded = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getTimeValue = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return 0;
  };

  const sortedMedications = [...medications].sort((a, b) => {
    return getTimeValue(a.time) - getTimeValue(b.time);
  });

  return (
    <div className="w-full care-card">
      <div className="space-y-3">
        {sortedMedications.map((med) => (
          <div 
            key={med.id} 
            className={`overflow-hidden rounded-2xl border ${med.status === 'taken' ? 'border-green-200 bg-green-50/60' : med.status === 'missed' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'}`}
          >
            <div className="flex items-center flex-wrap gap-3 p-4 sm:p-5">
              <button
                type="button"
                aria-label={`更新${med.name}的服药状态`}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center min-h-[56px] min-w-[56px] ${med.status === 'taken' ? 'bg-green-600 text-white' : med.status === 'missed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
                onClick={() => onToggleStatus(med.id)}
              >
                {med.status === 'taken' ? (
                  <CheckCircle size={30} />
                ) : med.status === 'missed' ? (
                  <AlertCircle size={30} />
                ) : (
                  <Clock size={30} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-2xl sm:text-3xl font-black tracking-tight">{med.time}</p>
                <p className="text-lg sm:text-xl font-bold text-gray-900 truncate">{med.name}</p>
                {med.dosage && (
                  <p className="text-base text-gray-600 mt-1">每次 {med.dosage}</p>
                )}
              </div>
              <div className="flex items-center gap-1 mt-2 sm:mt-0">
                <div className={`px-4 py-2 rounded-full text-base font-bold mr-1 text-center ${
                  med.status === 'taken' ? 'bg-green-100 text-green-800' :
                  med.status === 'missed' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {med.status === 'taken' ? '已服用' :
                   med.status === 'missed' ? '未服用' :
                   '待服用'}
                </div>
                <button 
                  onClick={() => toggleExpanded(med.id)}
                  className="p-3 text-orange-700 hover:bg-white rounded-full min-h-[48px] min-w-[48px] flex items-center justify-center"
                  title="查看详情"
                >
                  <Info size={20} sm:size={24} />
                </button>
                <button 
                  onClick={() => onDelete(med.id)}
                  className="p-3 text-gray-500 hover:text-red-700 hover:bg-white rounded-full min-h-[48px] min-w-[48px] flex items-center justify-center"
                  aria-label={`删除${med.name}`}
                >
                  <Trash2 size={20} sm:size={24} />
                </button>
              </div>
            </div>
            
            {expandedId === med.id && (
              <div className="border-t border-current/10 bg-white/70 p-4 sm:p-5">
                <div className="space-y-2">
                  {med.status === 'taken' && med.takenTime && (
                    <div className="flex items-start gap-2">
                      <CheckCircle size={16} className="text-secondary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">完成时间</p>
                        <p className="text-sm text-gray-600">{med.takenTime}</p>
                      </div>
                    </div>
                  )}
                  {med.dosage && (
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">剂量</p>
                        <p className="text-sm text-gray-600">{med.dosage}</p>
                      </div>
                    </div>
                  )}
                  {med.usage && (
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">用法用量</p>
                        <p className="text-sm text-gray-600">{med.usage}</p>
                      </div>
                    </div>
                  )}
                  {med.effect && (
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">主要功效</p>
                        <p className="text-sm text-gray-600">{med.effect}</p>
                      </div>
                    </div>
                  )}
                  {med.frequency && (
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">服用频率</p>
                        <p className="text-sm text-gray-600">{med.frequency}</p>
                      </div>
                    </div>
                  )}
                  {med.notes && (
                    <div className="flex items-start gap-2">
                      <Info size={16} className="text-orange-500 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">备注</p>
                        <p className="text-sm text-gray-600">{med.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedicationTimeline;
