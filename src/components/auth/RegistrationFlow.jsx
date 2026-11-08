import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import XiaoNuan from '../XiaoNuan';
import Logo from '../Logo';

const RegistrationFlow = ({
  role,
  setRole,
  username,
  setUsername,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  realName = '',
  setRealName,
  error,
  onSubmit,
  onLogin,
  onExplore,
}) => {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isParent = role === 'parent';
  const passwordChecks = useMemo(() => ([
    password.length >= 8,
    /[A-Za-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]), [password]);
  const passwordStrength = passwordChecks.filter(Boolean).length;

  const goNext = () => {
    if (username.trim().length < 3) {
      setLocalError('用户名至少需要 3 个字符');
      return;
    }
    if (!passwordChecks[0] || !passwordChecks[1] || !passwordChecks[2]) {
      setLocalError('密码至少 8 位，并同时包含字母和数字');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('两次输入的密码不一致');
      return;
    }
    setLocalError('');
    setStep(2);
  };

  const submit = async () => {
    if (isParent && !realName.trim()) {
      setLocalError('请填写希望家人看到的称呼');
      return;
    }
    if (!acceptedTerms) {
      setLocalError('请先确认用户协议与隐私说明');
      return;
    }

    setLocalError('');
    setIsSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  const strengthLabel = ['尚未设置', '较弱', '一般', '安全', '很强'][passwordStrength];
  const visibleError = localError || error;

  return (
    <div className="w-full max-w-lg mx-3 sm:mx-4 overflow-hidden rounded-[28px] bg-white shadow-2xl border border-orange-100">
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 px-6 py-7 text-white">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 right-20 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative">
          <div className="mb-4 flex items-center justify-between">
            <div className="registration-brand"><Logo size="small" /><span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur">{isParent ? '长者账号' : '家属账号'}</span></div>
            <span className="text-sm text-orange-50">第 {step} 步，共 2 步</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {step === 1 ? '创建你的账号' : isParent ? '怎么称呼您？' : '准备连接家人'}
          </h1>
          <p className="mt-2 text-sm sm:text-base text-orange-50">
            {step === 1
              ? '先设置登录信息，其他资料以后再完善'
              : isParent
                ? '这个称呼会显示在家人的照护页面中'
                : '注册完成后，使用邀请码即可加入家庭'}
          </p>
          <div className="registration-mascot-tip"><XiaoNuan size="small" pose={step === 1 ? 'guide' : 'nod'} /><span>{step === 1 ? '先设置账号，再选择身份。' : '最后确认一下，就完成了。'}</span></div>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-7">
        <div className="mb-6 flex gap-2" aria-label="注册进度">
          {[1, 2].map(item => (
            <div
              key={item}
              className={`h-2 flex-1 rounded-full transition-colors ${item <= step ? 'bg-orange-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        {visibleError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {visibleError}
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-5">
            {setRole && (
              <fieldset>
                <legend className="mb-2 block font-semibold text-gray-800">这个账号由谁使用？</legend>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setRole('parent')} className={`rounded-2xl border-2 p-4 text-left transition ${role === 'parent' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'}`}>
                    <UserRound className="mb-2" size={25} />
                    <span className="block font-bold">我是长者</span>
                    <span className="mt-1 block text-xs">管理自己的用药</span>
                  </button>
                  <button type="button" onClick={() => setRole('child')} className={`rounded-2xl border-2 p-4 text-left transition ${role === 'child' ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200'}`}>
                    <UsersRound className="mb-2" size={25} />
                    <span className="block font-bold">我是家属</span>
                    <span className="mt-1 block text-xs">协助家人管理用药</span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">账号类型创建后不可在前端自行切换</p>
              </fieldset>
            )}
            <div>
              <label className="mb-2 block font-semibold text-gray-800">用户名</label>
              <div className="relative">
                <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={21} />
                <input
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={event => setUsername(event.target.value)}
                  placeholder="例如：sunny2026"
                  className="min-h-[54px] w-full rounded-2xl border-2 border-gray-200 bg-gray-50 pl-12 pr-4 text-base outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">至少 3 个字符，之后可用于登录</p>
            </div>

            <div>
              <label className="mb-2 block font-semibold text-gray-800">设置密码</label>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={21} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="至少 8 位，包含字母和数字"
                  className="min-h-[54px] w-full rounded-2xl border-2 border-gray-200 bg-gray-50 pl-12 pr-12 text-base outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(value => !value)}
                  className="absolute right-3 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 rounded-full text-gray-500 hover:bg-gray-100"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                >
                  {showPassword ? <EyeOff className="mx-auto" size={20} /> : <Eye className="mx-auto" size={20} />}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex flex-1 gap-1.5">
                  {[1, 2, 3, 4].map(item => (
                    <div
                      key={item}
                      className={`h-1.5 flex-1 rounded-full ${item <= passwordStrength ? 'bg-orange-500' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="w-12 text-right text-xs text-gray-500">{strengthLabel}</span>
              </div>
            </div>

            <div>
              <label className="mb-2 block font-semibold text-gray-800">确认密码</label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                placeholder="再输入一次密码"
                className="min-h-[54px] w-full rounded-2xl border-2 border-gray-200 bg-gray-50 px-4 text-base outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <button
              type="button"
              onClick={goNext}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-lg font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-[0.99]"
            >
              继续
              <ArrowRight size={22} />
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {isParent ? (
              <div>
                <label className="mb-2 block font-semibold text-gray-800">家人如何称呼您</label>
                <div className="relative">
                  <HeartHandshake className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" size={22} />
                  <input
                    autoFocus
                    value={realName}
                    onChange={event => setRealName(event.target.value)}
                    placeholder="例如：王阿姨、李叔叔"
                    className="min-h-[56px] w-full rounded-2xl border-2 border-gray-200 bg-gray-50 pl-12 pr-4 text-lg outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>
                <div className="mt-4 flex gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                  <ShieldCheck className="mt-0.5 shrink-0" size={20} />
                  <p>首次注册不收集身份证。需要实名认证时，我们会单独说明用途并征得您的同意。</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                <UsersRound className="mb-3 text-orange-500" size={34} />
                <h2 className="text-lg font-bold text-gray-900">注册后只需一个邀请码</h2>
                <p className="mt-2 leading-6 text-gray-600">请向家中长者获取家庭邀请码。绑定后即可查看用药计划、接收漏服与 SOS 提醒。</p>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={event => setAcceptedTerms(event.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 accent-orange-500"
              />
              <span>我已阅读并同意用户协议与隐私说明，了解账号用于同步个人及家庭用药信息。</span>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setLocalError(''); setStep(1); }}
                className="flex min-h-[54px] items-center justify-center gap-1 rounded-2xl border-2 border-gray-200 px-5 font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft size={20} />
                上一步
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting}
                className="flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-lg font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
              >
                {isSubmitting ? '正在创建…' : '创建账号'}
                {!isSubmitting && <Check size={22} />}
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-gray-100 pt-5 text-center">
          <button type="button" onClick={onLogin} className="font-semibold text-orange-600 hover:text-orange-700">
            已有账号？直接登录
          </button>
          {onExplore && (
            <button type="button" onClick={onExplore} className="mt-3 block w-full text-sm text-gray-500 hover:text-gray-700">
              先看看应用，再决定是否注册
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegistrationFlow;
