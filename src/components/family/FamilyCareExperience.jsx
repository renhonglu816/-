import React, { useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Bell, Camera, Check, ChevronRight,
  ClipboardList, Clock, FileText, Heart, Info, Link, LogOut, MessageCircleHeart, Pill,
  Plus, User, Users, X,
} from 'lucide-react';
import MessageBoard from '../message/MessageBoard';
import MedicationReport from './MedicationReport';
import XiaoNuan from '../XiaoNuan';
import Logo from '../Logo';
import { DailyCheckIn, FamilyNote } from '../care/CareExperience';
import { authAPI } from '../../services/api';

const periods = [
  { label: '早晨', from: 0, to: 11 },
  { label: '中午', from: 11, to: 14 },
  { label: '下午', from: 14, to: 18 },
  { label: '晚上', from: 18, to: 24 },
];
const pillPatterns = ['round', 'capsule', 'purple', 'yellow', 'blue-capsule', 'pink', 'green'];
const formatTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const FamilyCareExperience = ({
  boundElderly, isLoadingCircle, medications, canManageMedication, onJoinCircle,
  onAddMedication, onEditMedication, currentUserId,
  messageUnreadCount, onUnreadCountChange, alerts, reminders,
  onOpenSOS,
  onLogout, lastSyncedAt, dataSource,
}) => {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch (_error) { return {}; }
  })();
  const [activeTab, setActiveTab] = useState('today');
  const [mySection, setMySection] = useState('');
  const [openSlot, setOpenSlot] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState(() => localStorage.getItem('familyProfileAvatar') || '');
  const [profileUsername, setProfileUsername] = useState(user.username || '家属');
  const [usernameDraft, setUsernameDraft] = useState(user.username || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileDetails, setProfileDetails] = useState(() => {
    try {
      return { gender: '', birthday: '', hometown: '', residence: '', tags: '', ...JSON.parse(localStorage.getItem('familyProfileDetails') || '{}') };
    } catch (_error) {
      return { gender: '', birthday: '', hometown: '', residence: '', tags: '' };
    }
  });
  const avatarInputRef = useRef(null);
  const slots = periods.map(period => ({
    ...period,
    medicines: medications.filter(medicine => {
      const hour = Number.parseInt(String(medicine.time || '').split(':')[0], 10);
      return Number.isFinite(hour) && hour >= period.from && hour < period.to;
    }),
  }));
  const total = medications.length;
  const taken = medications.filter(medicine => medicine.status === 'taken').length;
  const pending = medications.filter(medicine => medicine.status !== 'taken').length;
  const percent = total ? Math.round(taken / total * 100) : 0;
  const selectedSlot = slots.find(slot => slot.label === openSlot);
  const urgentAlerts = alerts.filter(item => item.type === 'sos' && item.status !== 'resolved' && !item.read);
  const missedAlerts = alerts.filter(item => item.type === 'missed' && !item.read);
  const alertCount = urgentAlerts.length + missedAlerts.length + reminders.length;

  const openProfileEditor = () => {
    const latestUser = (() => {
      try { return JSON.parse(localStorage.getItem('currentUser') || '{}'); } catch (_error) { return {}; }
    })();
    setProfileUsername(latestUser.username || profileUsername || '家属');
    setUsernameDraft(latestUser.username || profileUsername || '');
    setProfileAvatar(localStorage.getItem('familyProfileAvatar') || '');
    try {
      setProfileDetails({ gender: '', birthday: '', hometown: '', residence: '', tags: '', ...JSON.parse(localStorage.getItem('familyProfileDetails') || '{}') });
    } catch (_error) {
      setProfileDetails({ gender: '', birthday: '', hometown: '', residence: '', tags: '' });
    }
    setProfileMessage('');
    setShowProfileEditor(true);
  };

  const handleAvatarUpload = event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMessage('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage('头像图片不能超过2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const avatar = String(reader.result || '');
        localStorage.setItem('familyProfileAvatar', avatar);
        setProfileAvatar(avatar);
        setProfileMessage('头像已保存');
      } catch (_error) {
        setProfileMessage('头像保存失败，请选择更小的图片');
      }
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async event => {
    event.preventDefault();
    const nextUsername = usernameDraft.trim();
    if (!nextUsername) {
      setProfileMessage('用户名不能为空');
      return;
    }
    setIsSavingProfile(true);
    setProfileMessage('');
    try {
      if (nextUsername !== profileUsername) {
        const response = await authAPI.updateProfile({ username: nextUsername });
        if (!response.success) throw new Error(response.error || '修改失败');
        setProfileUsername(response.data.user.username);
        setUsernameDraft(response.data.user.username);
      }
      localStorage.setItem('familyProfileDetails', JSON.stringify(profileDetails));
      setProfileMessage('资料已保存');
      setShowProfileEditor(false);
    } catch (error) {
      setProfileMessage(error.response?.data?.error || error.message || '暂时无法保存资料');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const navItems = [
    { id: 'today', label: '今日照护', icon: Pill, className: 'medication' },
    { id: 'contact', label: '联系家人', icon: MessageCircleHeart, className: 'scanner', badge: alertCount + messageUnreadCount },
    { id: 'my', label: '我的', icon: User, className: 'my' },
  ];

  return (
    <div className="family-app">
      <main className="family-app__main" key={`${activeTab}-${mySection}`}>
        {activeTab === 'today' && (
          <div className="family-app__content">
            <header className="family-page-title">
              <div><span className="care-eyebrow">家庭照护中心</span><h1>今日照护</h1></div>
              <button type="button" className="family-header-alert" onClick={() => setActiveTab('contact')} aria-label={`前往联系家人查看提醒${alertCount ? `，${alertCount}条` : ''}`}>
                <Bell size={24} />{alertCount > 0 && <span>{alertCount > 9 ? '9+' : alertCount}</span>}
              </button>
            </header>

            {!boundElderly ? (
              <section className="care-card family-empty-card">
                <XiaoNuan size="medium" pose="wave" />
                <h2>{isLoadingCircle ? '正在同步照护圈' : '先和家人连起来'}</h2>
                <p>{isLoadingCircle ? '请稍候，正在读取您加入的照护圈。' : '输入长者分享的 6 位邀请码，即可查看今日用药与报平安。'}</p>
                {!isLoadingCircle && <button type="button" className="family-primary-button" onClick={onJoinCircle}><Link size={20} /> 加入照护圈</button>}
              </section>
            ) : (
              <>
                <div className="family-person-line"><span>正在照护</span><strong>{boundElderly.realName}</strong><em>{boundElderly.relationship}</em></div>
                <section className="care-card today-medication-card family-medication-card" aria-label={`${boundElderly.realName}今日用药`}>
                  <div className="today-medication-summary">
                    <div className="assurance-ring" style={{ '--progress': `${percent * 3.6}deg` }}>
                      <div className="assurance-ring__inside"><strong>{total ? `${taken}/${total}` : '—'}</strong><span>今日用药</span></div>
                    </div>
                    <div className="assurance-copy"><h2>{!total ? '今天还没有用药计划' : pending ? `今天还剩 ${pending} 次用药` : '今天的用药都完成了'}</h2>{total > 0 && !pending && <span className="family-complete-mascot"><XiaoNuan size="tiny" pose="nod" /> 已完成</span>}</div>
                  </div>
                  <div className="today-pill-box">
                    <div className="today-pill-box__heading">
                      <strong>今天的药盒</strong>
                      {canManageMedication && <button type="button" className="add-medication-button" onClick={onAddMedication}><Plus size={21} /> 添加用药</button>}
                    </div>
                    <div className="physical-pill-box" role="group" aria-label="今日四时段药盒">
                      {slots.map(slot => {
                        const hasMedicine = slot.medicines.length > 0;
                        const allTaken = hasMedicine && slot.medicines.every(medicine => medicine.status === 'taken');
                        const hasMissed = slot.medicines.some(medicine => medicine.status === 'missed');
                        return (
                          <button key={slot.label} type="button" onClick={() => setOpenSlot(slot.label)}
                            className={`physical-compartment ${allTaken ? 'is-taken' : hasMissed ? 'is-missed' : hasMedicine ? 'is-pending' : 'is-empty'}`}
                            aria-label={`${slot.label}，${!hasMedicine ? '没有安排用药' : allTaken ? '全部已服用' : `${slot.medicines.length}种药，点击查看`}`}>
                            <span className="physical-compartment__hinge" aria-hidden="true" />
                            <span className="physical-compartment__lid">
                              <span className="physical-compartment__label">{slot.label}</span>
                              {hasMedicine && <>
                                <span className={`physical-pills physical-pills--count-${Math.min(slot.medicines.length, 7)} ${slot.medicines.length > 3 ? 'is-crowded' : ''}`} aria-hidden="true">
                                  {slot.medicines.slice(0, 7).map((medicine, index) => <i key={medicine.id || index} className={`physical-pill physical-pill--${pillPatterns[index]}`} />)}
                                  {slot.medicines.length > 7 && <em>+{slot.medicines.length - 7}</em>}
                                </span>
                                <span className={`physical-compartment__status ${allTaken ? 'is-done' : hasMissed ? 'is-alert' : ''}`}>
                                  {allTaken && <Check size={21} />}{allTaken ? '已服用' : hasMissed ? '需要关注' : '待服用'}
                                </span>
                              </>}
                            </span>
                            <span className="physical-compartment__latch" aria-hidden="true" />
                          </button>
                        );
                      })}
                      <span className="physical-pill-box__main-latch" aria-hidden="true" />
                    </div>
                    {selectedSlot && <div className="pill-compartment-overlay" onClick={() => setOpenSlot(null)}>
                      <div className="pill-compartment-sheet" role="dialog" aria-modal="true" aria-label={`${selectedSlot.label}药品`} onClick={event => event.stopPropagation()}>
                        <div className="pill-compartment-sheet__heading"><div><strong>{selectedSlot.label}药品</strong><span>家属可查看状态，服药由长者本人确认</span></div><button type="button" onClick={() => setOpenSlot(null)} aria-label="关闭药品清单"><X size={22} /></button></div>
                        {selectedSlot.medicines.length ? <div className="family-slot-list">{selectedSlot.medicines.map(medicine => <div className="family-slot-medicine" key={medicine.id}>
                          <div><strong>{medicine.name}</strong><span>{medicine.time}{medicine.dosage ? ` · ${medicine.dosage}` : ''}</span></div>
                          <b className={medicine.status === 'taken' ? 'is-taken' : medicine.status === 'missed' ? 'is-missed' : ''}>{medicine.status === 'taken' ? '已服用' : medicine.status === 'missed' ? '漏服' : '待服用'}</b>
                          {canManageMedication && <button type="button" onClick={() => { setOpenSlot(null); onEditMedication(medicine); }}>编辑计划</button>}
                        </div>)}</div> : <p className="family-slot-empty">这个时间段还没有安排用药。</p>}
                      </div>
                    </div>}
                  </div>
                </section>
                <div className="family-sync-note">{dataSource === 'local' ? '当前显示本机缓存' : lastSyncedAt ? `最近同步 ${formatTime(lastSyncedAt)}` : '正在同步用药状态'}</div>
              </>
            )}
          </div>
        )}

        {activeTab === 'contact' && <div className="family-app__content family-contact-page">
          <header className="family-contact-header">
            <div><h1>联系家人</h1><p>{boundElderly ? `与${boundElderly.realName}保持联系` : '关心一直在'}</p></div>
            {alertCount > 0 && <span className="family-contact-header__badge"><Bell size={17} />{alertCount > 9 ? '9+' : alertCount}</span>}
          </header>
          {boundElderly ? <>
            <section className="family-contact-overview" aria-label="今日联系">
              <div className="family-contact-overview__heading"><Heart size={22} /><strong>今日联系</strong></div>
              <DailyCheckIn readOnly />
              <FamilyNote editable recipientId={boundElderly.elderlyId} />
            </section>
            {alertCount > 0 && <section className="family-contact-alerts" aria-label="需要处理的提醒">
              <div className="family-contact-alerts__heading"><h2>需要处理</h2><strong>{alertCount > 9 ? '9+' : alertCount}</strong></div>
              <div className="family-alert-list">
                {urgentAlerts.map(alert => <button key={alert.id} type="button" className="family-alert-card is-sos" onClick={() => onOpenSOS(alert)}><AlertTriangle size={28} /><span><strong>{boundElderly.realName}发起紧急求助</strong><small>{formatTime(alert.created_at || alert.timestamp)} · 点击查看详情</small></span><ChevronRight size={20} /></button>)}
                {missedAlerts.map(alert => <button key={alert.id} type="button" className="family-alert-card is-missed" onClick={() => onOpenSOS(alert)}><Clock size={27} /><span><strong>{alert.message || '有药品未按计划服用'}</strong><small>{formatTime(alert.created_at || alert.timestamp)} · 点击查看</small></span><ChevronRight size={20} /></button>)}
                {reminders.map(reminder => <div key={reminder.id} className="family-alert-card"><Bell size={25} /><span><strong>{reminder.message}</strong><small>{formatTime(reminder.timestamp)}</small></span></div>)}
              </div>
            </section>}
            <section className="family-message-section family-message-section--compact"><MessageBoard compact userType="child" userId={currentUserId} recipientId={boundElderly.elderlyId} onUnreadCountChange={onUnreadCountChange} /></section>
          </> : <section className="care-card family-empty-card"><Users size={34} /><h2>加入照护圈后联系家人</h2><button type="button" className="family-primary-button" onClick={onJoinCircle}>加入照护圈</button></section>}
        </div>}

        {activeTab === 'my' && <div className="family-my-page family-my-page--elder-style">
          {!mySection ? <header className="my-page__header"><h1>我的</h1></header> : mySection !== 'report' && <header className="family-page-title family-my-page__subheader"><button type="button" className="family-back-button" onClick={() => setMySection('')} aria-label="返回我的"><ArrowLeft size={24} /></button><div><h1>{{ circle: '照护圈', about: '关于我们', privacy: '隐私政策' }[mySection]}</h1></div></header>}
          <div className="my-page__content">
            {!mySection ? <>
              <button type="button" className="my-profile-card my-profile-card--entry" onClick={openProfileEditor} aria-label="编辑个人资料">
                <span className="my-profile-card__avatar"><img src={profileAvatar || '/brand/default-profile-avatar.png'} alt={profileAvatar ? '我的头像' : '默认头像'} /></span>
                <div className="my-profile-card__identity"><strong>{profileUsername || '家属'}</strong>{profileMessage && <p className="my-profile-card__message">{profileMessage}</p>}</div>
                <ChevronRight size={24} className="my-profile-card__chevron" />
              </button>
              <section className="my-menu-card" aria-label="我的功能">
                {[
                  { id: 'circle', label: '照护圈', icon: Users, iconClass: 'family' },
                  { id: 'report', label: '用药报告', icon: ClipboardList, iconClass: 'record' },
                  { id: 'about', label: '关于我们', icon: Info, iconClass: 'about' },
                  { id: 'privacy', label: '隐私政策', icon: FileText, iconClass: 'privacy' },
                ].map(item => <button type="button" key={item.id} onClick={() => setMySection(item.id)}><span className={`my-menu-card__icon my-menu-card__icon--${item.iconClass}`}><item.icon size={24} /></span><strong>{item.label}</strong><ChevronRight size={22} /></button>)}
                <button type="button" onClick={() => setShowLogoutConfirm(true)}><span className="my-menu-card__icon my-menu-card__icon--logout"><LogOut size={24} /></span><strong>退出账号</strong><ChevronRight size={22} /></button>
              </section>
            </> : mySection === 'circle' ? <section className="care-card family-detail-card"><h2>{boundElderly ? boundElderly.realName : '尚未加入照护圈'}</h2>{boundElderly && <><p>与长者的关系：{boundElderly.relationship}</p><p>当前权限：{canManageMedication ? '可以管理用药计划' : '查看用药与接收提醒'}</p></>}<button type="button" className="family-primary-button" onClick={onJoinCircle}><Link size={19} />{boundElderly ? '更换照护圈' : '加入照护圈'}</button></section>
            : mySection === 'report' ? <MedicationReport isOpen pageMode medications={medications} boundElderly={boundElderly} onClose={() => setMySection('')} />
            : <section className="care-card family-detail-card">{mySection === 'about' && <Logo size="small" />}<h2>{mySection === 'about' ? '关于药记得' : '隐私政策'}</h2><p>{mySection === 'about' ? '药记得帮助长者记录每日用药，并让已加入照护圈的家人了解服药与报平安情况。' : '账号、用药和照护圈信息仅用于提供服务；用药信息仅向已绑定的照护圈成员展示。'}</p></section>}
          </div>
        </div>}
      </main>

      {showProfileEditor && <div className="profile-editor-page" role="dialog" aria-modal="true" aria-label="编辑资料">
        <header className="profile-editor-page__header"><button type="button" onClick={() => setShowProfileEditor(false)} aria-label="返回我的"><ArrowLeft size={25} /></button><h1>编辑资料</h1><span aria-hidden="true" /></header>
        <form className="profile-editor-page__content" onSubmit={saveProfile}>
          <div className="profile-editor-avatar"><button type="button" onClick={() => avatarInputRef.current?.click()} aria-label="更换头像"><img src={profileAvatar || '/brand/default-profile-avatar.png'} alt="当前头像" /><span><Camera size={18} />更换头像</span></button><input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} hidden /></div>
          <section className="profile-editor-fields" aria-label="个人资料">
            <label className="profile-editor-row"><span>用户名</span><input value={usernameDraft} onChange={event => setUsernameDraft(event.target.value.slice(0, 20))} placeholder="请输入用户名" /></label>
            <div className="profile-editor-row is-readonly"><span>账号ID</span><strong>{user.id || user.childId || user.child_id || '—'}</strong></div>
            <label className="profile-editor-row"><span>性别</span><select value={profileDetails.gender} onChange={event => setProfileDetails(current => ({ ...current, gender: event.target.value }))}><option value="">请选择</option><option value="男">男</option><option value="女">女</option><option value="保密">保密</option></select></label>
            <label className="profile-editor-row"><span>生日</span><input type="date" value={profileDetails.birthday} max={new Date().toISOString().slice(0, 10)} onChange={event => setProfileDetails(current => ({ ...current, birthday: event.target.value }))} /></label>
            <label className="profile-editor-row"><span>家乡</span><input value={profileDetails.hometown} onChange={event => setProfileDetails(current => ({ ...current, hometown: event.target.value.slice(0, 30) }))} placeholder="请输入家乡" /></label>
            <label className="profile-editor-row"><span>常居地</span><input value={profileDetails.residence} onChange={event => setProfileDetails(current => ({ ...current, residence: event.target.value.slice(0, 30) }))} placeholder="请输入常居地" /></label>
            <label className="profile-editor-row"><span>我的标签</span><input value={profileDetails.tags} onChange={event => setProfileDetails(current => ({ ...current, tags: event.target.value.slice(0, 40) }))} placeholder="例如：细心、常陪伴家人" /></label>
          </section>
          {profileMessage && <p className="profile-editor-message" role="status">{profileMessage}</p>}
          <button type="submit" className="profile-editor-save" disabled={isSavingProfile}>{isSavingProfile ? '保存中…' : '保存修改'}</button>
        </form>
      </div>}

      {showLogoutConfirm && <div className="logout-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="family-logout-confirm-title" onClick={() => setShowLogoutConfirm(false)}><section className="logout-confirm-dialog" onClick={event => event.stopPropagation()}><button type="button" className="logout-confirm-dialog__close" onClick={() => setShowLogoutConfirm(false)} aria-label="关闭退出确认"><X size={22} /></button><span className="logout-confirm-dialog__icon"><LogOut size={30} /></span><h2 id="family-logout-confirm-title">确认退出账号？</h2><p>退出后需要重新输入用户名和密码才能进入。</p><div className="logout-confirm-dialog__actions"><button type="button" onClick={() => setShowLogoutConfirm(false)}>取消</button><button type="button" className="is-danger" onClick={() => { setShowLogoutConfirm(false); onLogout(); }}>确认退出</button></div></section></div>}

      <nav className="care-bottom-nav family-bottom-nav glass" aria-label="家庭端主导航"><div className="care-bottom-nav__items family-bottom-nav__items">{navItems.map(item => <button type="button" key={item.id} onClick={() => { setActiveTab(item.id); setOpenSlot(null); setMySection(''); }} className={`care-nav-button ${activeTab === item.id ? 'is-active' : ''}`} aria-current={activeTab === item.id ? 'page' : undefined}><span className={`care-nav-button__icon care-nav-button__icon--${item.className}`}><item.icon size={24} /></span><strong>{item.label}</strong>{item.badge > 0 && <em>{item.badge > 9 ? '9+' : item.badge}</em>}</button>)}</div></nav>
    </div>
  );
};

export default FamilyCareExperience;
