import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Camera,
  ChevronRight,
  Heart,
  Leaf,
  MessageCircleHeart,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  SunMedium,
  X,
} from 'lucide-react';
import dataAdapter from '../../services/dataAdapter';
import XiaoNuan from '../XiaoNuan';

const todayKey = () => new Date().toISOString().slice(0, 10);

const completion = (medications = []) => {
  const total = medications.length;
  const taken = medications.filter(item => item.status === 'taken').length;
  return { total, taken, percent: total ? Math.round((taken / total) * 100) : 0 };
};

export const AssuranceRing = ({ medications = [], personName = '您' }) => {
  const { total, taken, percent } = completion(medications);
  const remaining = Math.max(total - taken, 0);
  return (
    <section className="care-card assurance-card" aria-label="今日用药完成情况">
      <div className="assurance-ring" style={{ '--progress': `${percent * 3.6}deg` }}>
        <div className="assurance-ring__inside">
          <strong>{total ? `${taken}/${total}` : '—'}</strong>
          <span>今日用药</span>
        </div>
      </div>
      <div className="assurance-copy">
        <span className="care-eyebrow"><SunMedium size={18} /> 一天一颗安心</span>
        <h2>{!total ? '今天还没有用药计划' : remaining ? `今天还剩 ${remaining} 次用药` : '今天的用药都完成了'}</h2>
        <p>{!total ? '添加第一种药后，这里会为您整理全天计划。' : remaining ? `完成后，${personName}和家人都会更安心。` : '做得很好，家人也能看到这份安心。'}</p>
      </div>
    </section>
  );
};

const periods = [
  { label: '早晨', range: [0, 11], symbol: '晨' },
  { label: '中午', range: [11, 14], symbol: '午' },
  { label: '下午', range: [14, 18], symbol: '下' },
  { label: '晚上', range: [18, 24], symbol: '晚' },
];

const pillPatternOrder = ['round', 'capsule', 'purple', 'yellow', 'blue-capsule', 'pink', 'green'];

const buildPillSlots = (medications = []) => periods.map(period => {
  const medicines = medications.filter(item => {
    const hour = Number.parseInt(item.time?.split(':')[0] || '0', 10);
    return hour >= period.range[0] && hour < period.range[1];
  });
  return { ...period, medicines };
});

export const DailyPillBox = ({ medications = [], onToggle }) => {
  const slots = buildPillSlots(medications);

  return (
    <section className="care-card">
      <div className="care-section-heading">
        <div><span className="care-eyebrow">今日药盒</span><h2>按时间打开，一眼就能看明白</h2></div>
        <span className="care-hint">点药格可确认服用</span>
      </div>
      <div className="pill-box-grid">
        {slots.map(slot => {
          const main = slot.medicines[0];
          const allTaken = slot.medicines.length > 0 && slot.medicines.every(item => item.status === 'taken');
          return (
            <button key={slot.label} type="button" disabled={!main} onClick={() => main && onToggle?.(main.id)} className={`pill-slot ${allTaken ? 'is-taken' : main ? 'is-pending' : 'is-empty'}`}>
              <span className="pill-slot__symbol">{allTaken ? <Check size={25} /> : slot.symbol}</span>
              <strong>{slot.label}</strong>
              {main ? <><span>{main.time}</span><b>{main.name}</b><small>{allTaken ? '已服用' : '待确认'}</small></> : <small>今天不用吃</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export const TodayMedicationCard = ({ medications = [], onToggle, onAddMedication, onScanMedication, emergencyAction }) => {
  const { total, taken, percent } = completion(medications);
  const remaining = Math.max(total - taken, 0);
  const slots = buildPillSlots(medications);
  const [openSlotLabel, setOpenSlotLabel] = useState(null);
  const openSlot = slots.find(slot => slot.label === openSlotLabel);

  const handleSlotClick = slot => {
    setOpenSlotLabel(current => current === slot.label ? null : slot.label);
  };

  return (
    <section className="care-card today-medication-card" aria-label="今日用药与药盒">
      <div className="today-medication-summary">
        <div className="assurance-ring" style={{ '--progress': `${percent * 3.6}deg` }}>
          <div className="assurance-ring__inside">
            <strong>{total ? `${taken}/${total}` : '—'}</strong>
            <span>今日用药</span>
          </div>
        </div>
        <div className="assurance-copy">
          <div className="xiaonuan-care-status" role="status"><XiaoNuan size="small" className="xiaonuan--summary" pose={!total ? 'smile' : remaining ? medications.some(item => item.status === 'missed') ? 'worried' : 'smile' : 'nod'} /><strong>{!total ? '今天还没有用药计划' : remaining ? `还剩 ${remaining} 次用药，按计划来。` : '今天的用药都完成了'}</strong></div>
        </div>
        {emergencyAction && <div className="today-medication-emergency">{emergencyAction}</div>}
      </div>

      <div className="today-pill-box">
        <div className="today-pill-box__heading">
          <strong>今天的药盒</strong>
          <div className="today-pill-box__actions">
            <span>点药格可确认服用</span>
            <button type="button" onClick={onScanMedication} className="scan-medication-button">
              <Camera size={21} />
              拍药盒
            </button>
            <button type="button" onClick={onAddMedication} className="add-medication-button">
              <Plus size={22} />
              添加用药
            </button>
          </div>
        </div>
        <div className="physical-pill-box" role="group" aria-label="今日实体药盒">
          {slots.map(slot => {
            const hasMedicine = slot.medicines.length > 0;
            const allTaken = slot.medicines.length > 0 && slot.medicines.every(item => item.status === 'taken');
            const hasMissed = slot.medicines.some(item => item.status === 'missed');
            return (
              <button
                key={slot.label}
                type="button"
                onClick={() => handleSlotClick(slot)}
                className={`physical-compartment ${allTaken ? 'is-taken' : hasMissed ? 'is-missed' : hasMedicine ? 'is-pending' : 'is-empty'} ${openSlotLabel === slot.label ? 'is-open' : ''}`}
                aria-label={`${slot.label}，${!hasMedicine ? '今天不用吃' : allTaken ? '已全部服用' : `${slot.medicines.length}种药待确认`}`}
              >
                <span className="physical-compartment__hinge" aria-hidden="true" />
                <span className="physical-compartment__lid">
                  <span className="physical-compartment__label">{slot.label}</span>
                  {hasMedicine && (
                    <>
                      <span className={`physical-pills physical-pills--count-${Math.min(slot.medicines.length, 7)} ${slot.medicines.length > 3 ? 'is-crowded' : ''}`} aria-hidden="true">
                        {slot.medicines.slice(0, 7).map((medicine, index) => (
                          <i key={medicine.id} className={`physical-pill physical-pill--${pillPatternOrder[index]}`} />
                        ))}
                        {slot.medicines.length > 7 && <em>+{slot.medicines.length - 7}</em>}
                      </span>
                      <span className={`physical-compartment__status ${allTaken ? 'is-done' : hasMissed ? 'is-alert' : ''}`}>
                        {allTaken && <Check size={22} />}
                        {allTaken ? '已服用' : hasMissed ? '需要关注' : '待服用'}
                      </span>
                    </>
                  )}
                </span>
                <span className="physical-compartment__latch" aria-hidden="true" />
              </button>
            );
          })}
          <span className="physical-pill-box__main-latch" aria-hidden="true" />
        </div>
        {openSlot && (
          <div className="pill-compartment-overlay" onClick={() => setOpenSlotLabel(null)}>
            <div className="pill-compartment-sheet" role="dialog" aria-modal="true" aria-label={`${openSlot.label}药品清单`} onClick={(event) => event.stopPropagation()}>
              <div className="pill-compartment-sheet__heading">
                <div>
                  <div className="pill-compartment-sheet__title-row">
                    <strong>{openSlot.label}药品</strong>
                    {openSlot.medicines.length > 0 && (
                      <button
                        type="button"
                        className="confirm-all-medications"
                        disabled={openSlot.medicines.every(medicine => medicine.status === 'taken')}
                        onClick={() => openSlot.medicines
                          .filter(medicine => medicine.status !== 'taken')
                          .forEach(medicine => onToggle?.(medicine.id))}
                      >
                        <CheckCircle2 size={17} />
                        {openSlot.medicines.every(medicine => medicine.status === 'taken') ? '已全部服用' : '一键确认全部'}
                      </button>
                    )}
                  </div>
                  <span>{openSlot.medicines.length ? '请逐项确认，避免漏服' : '该时间段还没有安排用药'}</span>
                </div>
                <button type="button" onClick={() => setOpenSlotLabel(null)} aria-label="关闭药品清单"><X size={22} /></button>
              </div>
              {openSlot.medicines.length ? (
                <div className="pill-compartment-sheet__list">
                  {openSlot.medicines.map(medicine => (
                    <button key={medicine.id} type="button" onClick={() => onToggle?.(medicine.id)} className={medicine.status === 'taken' ? 'is-taken' : ''}>
                      <span><b>{medicine.name}</b><small>{medicine.time}{medicine.dosage ? ` · ${medicine.dosage}` : ''}</small></span>
                      <strong>{medicine.status === 'taken' ? <><Check size={20} /> 已服用</> : '确认服用'}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="pill-compartment-sheet__empty">
                  <p>这个药格现在是空的</p>
                  <button type="button" onClick={() => {
                    setOpenSlotLabel(null);
                    onAddMedication?.();
                  }}><Plus size={20} /> 添加用药</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const encouragements = ['今天做得很好', '记得多喝水', '我晚点给您打电话', '我们一直陪着您'];

export const FamilyNote = ({ editable = false, recipientId, compact = false, senderName = '家人' }) => {
  const [note, setNote] = useState(() => localStorage.getItem('familyEncouragement') || '今天按计划吃药就好，别着急，我们一直陪着您。');
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await dataAdapter.getMessages();
        const notes = (res.data?.messages || []).filter(message => message.type === 'encouragement');
        if (!cancelled && notes.length) setNote(notes[0].content);
      } catch (_error) { /* 离线时继续显示本地便签 */ }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  useEffect(() => {
    const sync = event => event.key === 'familyEncouragement' && setNote(event.newValue || '我们一直陪着您。');
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const save = async value => {
    setNote(value);
    localStorage.setItem('familyEncouragement', value);
    if (recipientId) {
      try { await dataAdapter.sendMessage(recipientId, value, 'encouragement'); } catch (_error) { /* 本地保存，联网后仍可手动重发 */ }
    }
  };
  if (compact) {
    return <div className="compact-family-note"><strong>{senderName}：</strong><span>{note}</span></div>;
  }
  return (
    <section className="family-note">
      <MessageCircleHeart size={26} />
      <div className="family-note__copy"><span>家人的一句话</span><p>“{note}”</p></div>
      {editable && <div className="family-note__actions">{encouragements.map(item => <button type="button" key={item} onClick={() => save(item)}>{item}</button>)}</div>}
    </section>
  );
};

export const DailyCheckIn = ({ readOnly = false, recipientId, compact = false }) => {
  const [status, setStatus] = useState(() => {
    const records = JSON.parse(localStorage.getItem('dailyCheckins') || '{}');
    return records[todayKey()] || '';
  });
  const [showOptions, setShowOptions] = useState(false);
  const choose = async value => {
    const records = JSON.parse(localStorage.getItem('dailyCheckins') || '{}');
    records[todayKey()] = value;
    localStorage.setItem('dailyCheckins', JSON.stringify(records));
    setStatus(value);
    setShowOptions(false);
    if (recipientId) {
      try { await dataAdapter.sendMessage(recipientId, labels[value], 'checkin'); } catch (_error) { /* 离线状态已保存在本机 */ }
    }
  };
  useEffect(() => {
    const sync = event => {
      if (event.key !== 'dailyCheckins') return;
      const records = JSON.parse(event.newValue || '{}');
      setStatus(records[todayKey()] || '');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    if (!readOnly) return undefined;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await dataAdapter.getMessages();
        const checkin = (res.data?.messages || []).find(message => message.type === 'checkin');
        if (!cancelled && checkin) {
          const matched = Object.entries(labels).find(([, label]) => label === checkin.content);
          if (matched) setStatus(matched[0]);
        }
      } catch (_error) { /* 离线时展示最后一次本地状态 */ }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [readOnly]);
  const labels = { good: '今天一切都好', uneasy: '有一点不舒服', call: '希望家人联系我' };
  if (readOnly) {
    return <section className="checkin-card"><Heart size={25} /><div><span>今日报平安</span><strong>{status ? labels[status] : '今天还没有报平安'}</strong></div>{status === 'call' && <Phone size={22} />}</section>;
  }
  if (compact) {
    return (
      <div className="compact-checkin">
        <button type="button" onClick={() => setShowOptions(value => !value)} className={status ? 'has-status' : ''} aria-expanded={showOptions} title={status ? labels[status] : '选择今天的状态'}>
          <Heart size={19} />
          {status ? '已报平安' : '报平安'}
        </button>
        {showOptions && (
          <div className="compact-checkin__menu" role="dialog" aria-label="选择报平安状态">
            {Object.entries(labels).map(([value, label]) => (
              <button type="button" key={value} onClick={() => choose(value)} className={status === value ? 'is-selected' : ''}>
                {status === value && <CheckCircle2 size={18} />}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <section className="care-card checkin-panel">
      <div className="care-section-heading"><div><span className="care-eyebrow">一分钟报平安</span><h2>今天感觉怎么样？</h2></div><Heart size={28} /></div>
      <div className="checkin-options">
        {Object.entries(labels).map(([value, label]) => <button type="button" key={value} onClick={() => choose(value)} className={status === value ? 'is-selected' : ''}>{status === value && <CheckCircle2 size={20} />}{label}</button>)}
      </div>
      {status && <p className="checkin-result">已告诉家人：{labels[status]}</p>}
    </section>
  );
};

export const PeaceTree = ({ medications = [], records, daysCount = 7 }) => {
  const { percent } = completion(medications);
  const checkins = useMemo(() => JSON.parse(localStorage.getItem('dailyCheckins') || '{}'), []);
  const days = Array.from({ length: daysCount }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (daysCount - 1 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayRecords = records?.filter(record => record.date === key) || [];
    const active = records ? dayRecords.length > 0 && dayRecords.every(record => record.status === 'taken') : key === todayKey() ? percent >= 75 : Boolean(checkins[key]);
    return { key, label: `${date.getMonth() + 1}/${date.getDate()}`, active };
  });
  return (
    <section className="care-card peace-tree">
      <div className="care-section-heading"><div><span className="care-eyebrow">时光药历</span><h2>{daysCount === 30 ? '近30天的安心树' : '这一周的安心树'}</h2></div><Sparkles size={25} /></div>
      <div className={`leaf-row ${daysCount === 30 ? 'leaf-row--month' : ''}`}>{days.map(day => <div key={day.key} className={day.active ? 'leaf-day is-grown' : 'leaf-day'}><Leaf size={daysCount === 30 ? 23 : 30} /><span>{day.label}</span></div>)}</div>
      <p>{records ? '绿色表示当天记录的用药已全部服用。' : '每一个认真照顾自己的日子，都会长出一片新叶子。'}</p>
    </section>
  );
};

export const CareRelay = ({ medications = [] }) => {
  const pending = medications.filter(item => item.status === 'pending').length;
  const missed = medications.filter(item => item.status === 'missed').length;
  const steps = [
    { title: '长者端提醒', done: medications.length > 0, detail: medications.length ? '今日计划已经送达' : '等待添加用药计划' },
    { title: '服药确认', done: pending === 0 && medications.length > 0, detail: pending ? `还有 ${pending} 次等待确认` : '当前没有待确认事项' },
    { title: '家属接力', done: missed === 0, detail: missed ? `${missed} 次异常需要关注` : '无需额外打扰家人' },
  ];
  return (
    <section className="care-card relay-card">
      <div className="care-section-heading"><div><span className="care-eyebrow">家庭接力提醒</span><h2>提醒有顺序，关心不打扰</h2></div><ShieldCheck size={28} /></div>
      <div className="relay-line">{steps.map((step, index) => <div className={`relay-step ${step.done ? 'is-done' : ''}`} key={step.title}><span>{step.done ? <Check size={18} /> : index + 1}</span><div><strong>{step.title}</strong><small>{step.detail}</small></div>{index < steps.length - 1 && <ChevronRight size={18} />}</div>)}</div>
    </section>
  );
};

export const ElderConnectionCard = ({ familyRecipientId, familyMembers = [], currentUserId, onOpenMessages }) => {
  const [familyMessages, setFamilyMessages] = useState([]);
  useEffect(() => {
    if (!currentUserId) return undefined;
    let active = true;
    const load = async () => {
      try {
        const response = await dataAdapter.getMessages();
        const messages = (response.data?.messages || [])
          .filter(message => message.to_user_id === currentUserId && ['text', 'encouragement'].includes(message.type || 'text'))
          .sort((a, b) => new Date(b.created_at || b.timestamp) - new Date(a.created_at || a.timestamp));
        if (active) setFamilyMessages(messages.slice(0, 2));
      } catch (_error) { /* 暂时保留已加载的留言 */ }
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [currentUserId]);

  return (
    <section className="care-card elder-family-connection" aria-label="家人留言与报平安">
      <div className="elder-family-connection__messages">
        <div className="elder-family-connection__heading"><h3>家人留言</h3><button type="button" onClick={onOpenMessages}>查看全部 <ChevronRight size={18} /></button></div>
        {familyMessages.length ? familyMessages.map(message => {
          const sender = familyMembers.find(member => member.id === message.from_user_id);
          return <p key={message.id} className="elder-family-connection__message"><strong>{sender?.name || '家人'}：</strong>{message.content}</p>;
        }) : <p className="elder-family-connection__empty">还没有家人留言</p>}
      </div>
      <div className="elder-family-connection__checkin"><span>今天感觉怎么样？</span><DailyCheckIn compact recipientId={familyRecipientId} /></div>
    </section>
  );
};

export const ElderCreativeDashboard = ({ medications, onToggle, onAddMedication, onScanMedication, emergencyAction }) => (
  <div className="creative-dashboard">
    <TodayMedicationCard medications={medications} onToggle={onToggle} onAddMedication={onAddMedication} onScanMedication={onScanMedication} emergencyAction={emergencyAction} />
  </div>
);

export const FamilyCreativeDashboard = ({ medications, personName, elderlyId }) => (
  <div className="creative-dashboard family-dashboard">
    <AssuranceRing medications={medications} personName={personName || '家人'} />
    <div className="care-grid-2"><DailyCheckIn readOnly /><FamilyNote editable recipientId={elderlyId} /></div>
    <CareRelay medications={medications} />
    <PeaceTree medications={medications} />
  </div>
);
