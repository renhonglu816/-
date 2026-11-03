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
    <div className="w-full glass rounded-2xl p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {sortedMedications.map((med) => (
          <div 
            key={med.id} 
            className={`rounded-xl overflow-hidden ${med.status === 'pending' ? 'ambient-glow pink-glow' : ''}`}
          >
            <div className="glass flex items-center flex-wrap p-3 sm:p-4">
              <div 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mr-4 sm:mr-6 cursor-pointer min-h-[44px] min-w-[44px]"
                onClick={() => onToggleStatus(med.id)}
              >
                {med.status === 'taken' ? (
                  <CheckCircle size={28} sm:size={32} className="text-secondary" />
                ) : med.status === 'missed' ? (
                  <AlertCircle size={28} sm:size={32} className="text-danger" />
                ) : (
                  <Clock size={28} sm:size={32} className="text-warning" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="elderly-text font-bold truncate">{med.time}</p>
                <p className="elderly-text font-semibold text-primary truncate">{med.name}</p>
                {med.dosage && (
                  <p className="text-sm text-gray-600 mt-1">剂量：{med.dosage}</p>
                )}
              </div>
              <div className="flex items-center mt-2 sm:mt-0">
                <div className={`px-4 sm:px-6 py-2 sm:py-3 rounded-full elderly-text font-medium mr-3 sm:mr-4 text-center ${
                  med.status === 'taken' ? 'bg-green-100/60 text-secondary' :
                  med.status === 'missed' ? 'bg-red-100/60 text-danger' :
                  'bg-yellow-100/60 text-warning'
                }`}>
                  {med.status === 'taken' ? '已服用' :
                   med.status === 'missed' ? '未服用' :
                   '待服用'}
                </div>
                <button 
                  onClick={() => toggleExpanded(med.id)}
                  className="p-3 text-primary hover:bg-orange-50/60 rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center mr-2"
                  title="查看详情"
                >
                  <Info size={20} sm:size={24} />
                </button>
                <button 
                  onClick={() => onDelete(med.id)}
                  className="p-3 text-gray-400 hover:text-danger min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 size={20} sm:size={24} />
                </button>
              </div>
            </div>
            
            {expandedId === med.id && (
              <div className="glass border-t border-white/30 p-4 sm:p-5">
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
