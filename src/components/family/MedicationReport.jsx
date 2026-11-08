import React, { useState } from 'react';
import { ArrowLeft, CalendarDays, Check, ClipboardList, Clock, Download, X } from 'lucide-react';
import { PeaceTree } from '../care/CareExperience';
import XiaoNuan from '../XiaoNuan';

const localDate = date => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const statusLabel = status => status === 'taken' ? '已服用' : status === 'missed' ? '漏服' : '待服用';

const MedicationReport = ({ isOpen, onClose, boundElderly, medications = [], pageMode = false, title = '用药报告', showPeaceTree = false }) => {
  const [dateRange, setDateRange] = useState('today');
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  if (!isOpen) return null;

  const today = localDate(new Date());
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(`medicationHistory_${boundElderly?.elderlyId}`) || '[]');
    if (!Array.isArray(history)) history = [];
  } catch (_error) { history = []; }

  const days = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : 30;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const earlierRecords = history.filter(record => {
    const date = record.date || localDate(record.takenTime || record.timestamp);
    return date && date !== today && (dateRange === 'date' ? date === selectedDate : new Date(date) >= start);
  }).map(record => ({ ...record, date: record.date || localDate(record.takenTime || record.timestamp) }));
  const todayRecords = dateRange !== 'date' || selectedDate === today
    ? medications.map(medicine => ({ ...medicine, date: today })) : [];
  const records = [...todayRecords, ...earlierRecords].sort((a, b) => `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`));
  const taken = records.filter(record => record.status === 'taken').length;
  const missed = records.filter(record => record.status === 'missed').length;
  const pending = records.filter(record => record.status !== 'taken' && record.status !== 'missed').length;

  const exportReport = () => {
    const lines = [
      `${boundElderly?.realName || '家人'}的用药记录（${dateRange === 'today' ? '今日' : dateRange === 'week' ? '近7天' : dateRange === 'month' ? '近30天' : selectedDate}）`,
      `已服用 ${taken} 次，漏服 ${missed} 次，待服用 ${pending} 次`,
      ...records.map(record => `${record.date} ${record.time || ''}  ${record.name || '未命名药品'}  ${statusLabel(record.status)}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `用药记录_${dateRange === 'date' ? selectedDate : `${dateRange}_${today}`}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={pageMode ? 'family-report-page' : 'fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4'}>
      <div className={pageMode ? 'family-report-page__surface' : 'mx-auto max-w-2xl rounded-2xl bg-white'}>
        <header className={`family-report-page__header${pageMode ? ' is-page-mode' : ''}`}>
          {pageMode && <button type="button" className="family-back-button" onClick={onClose} aria-label="返回我的"><ArrowLeft size={24} /></button>}
          <div className="family-report-page__title"><span className="my-menu-card__icon my-menu-card__icon--record"><ClipboardList size={25} /></span><div><h2>{title}</h2></div></div>
          {!pageMode && <button type="button" onClick={onClose} aria-label="关闭报告"><X size={22} /></button>}
        </header>
        <div className="family-report-page__content">
          <div className="family-report-page__period" role="group" aria-label="报告时间范围">
            {[['today', '今日'], ['week', '近7天'], ['month', '近30天'], ['date', '按日期']].map(([value, label]) => <button key={value} type="button" onClick={() => setDateRange(value)} className={dateRange === value ? 'is-active' : ''} aria-pressed={dateRange === value}>{label}</button>)}
          </div>
          {dateRange === 'date' && <label className="family-report-page__date" htmlFor="family-report-date">选择日期<input id="family-report-date" type="date" value={selectedDate} max={today} onChange={event => setSelectedDate(event.target.value)} /></label>}
          {showPeaceTree && (dateRange === 'week' || dateRange === 'month') && <PeaceTree medications={medications} records={records} daysCount={dateRange === 'week' ? 7 : 30} />}
          <section className="care-card family-report-summary">
            <h3>服药状态</h3>
            <div><span><Check size={21} /><strong>{taken}</strong><small>已服用</small></span><span><Clock size={21} /><strong>{pending}</strong><small>待服用</small></span><span><CalendarDays size={21} /><strong>{missed}</strong><small>漏服</small></span></div>
          </section>
          <section className="care-card family-report-records">
            <div className="family-report-records__heading"><h3>记录明细</h3><button type="button" onClick={exportReport} disabled={!records.length}><Download size={18} /> 导出</button></div>
            {records.length ? records.map((record, index) => <div className="family-history-row" key={record.id ? `${record.date}-${record.id}` : index}><div><strong>{record.name || '未命名药品'}</strong><span>{record.date} {record.time || ''}{record.dosage ? ` · ${record.dosage}` : ''}</span></div><b className={record.status === 'taken' ? 'is-taken' : record.status === 'missed' ? 'is-missed' : ''}>{statusLabel(record.status)}</b></div>) : <div className="family-report-empty"><XiaoNuan size="small" pose="search" /><span>暂无用药记录</span></div>}
          </section>
          {dateRange !== 'today' && <p className="family-report-page__note">历史数据以本设备保存的记录为准；今天的状态来自当前照护圈。</p>}
        </div>
      </div>
    </div>
  );
};

export default MedicationReport;
