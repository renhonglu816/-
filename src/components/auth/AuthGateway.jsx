import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, LogIn, UserRound } from 'lucide-react';
import Logo from '../Logo';
import RegistrationFlow from './RegistrationFlow';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const AuthGateway = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('parent');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storeSession = ({ user, token }) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    localStorage.removeItem(user.role === 'parent' ? 'childToken' : 'elderlyToken');
    localStorage.setItem(user.role === 'parent' ? 'elderlyToken' : 'childToken', token);
    if (user.role === 'parent') {
      localStorage.setItem('currentElderlyId', user.id);
      localStorage.setItem('elderlyName', user.real_name || user.username);
    } else {
      localStorage.removeItem('currentElderlyId');
      localStorage.removeItem('elderlyName');
    }
    onAuthenticated(user);
  };

  const request = async (path, body) => {
    const response = await fetch(`${API_URL}/auth/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error || '操作失败，请稍后重试');
    }
    return result.data;
  };

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const data = await request('login', { username: username.trim(), password });
      storeSession(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    try {
      const data = await request('register', {
        username: username.trim(),
        password,
        real_name: role === 'parent' ? realName.trim() : username.trim(),
        role,
      });
      storeSession(data);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  if (mode === 'register') {
    return (
      <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 py-8 flex items-center justify-center">
        <RegistrationFlow
          role={role}
          setRole={setRole}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          realName={realName}
          setRealName={setRealName}
          error={error}
          onSubmit={handleRegister}
          onLogin={() => { setError(''); setMode('login'); }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md rounded-[28px] border border-orange-100 bg-white p-6 shadow-2xl sm:p-8">
        <div className="auth-full-logo"><Logo size="large" full /></div>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="space-y-5">
          <div>
            <label className="mb-2 block font-semibold text-gray-800">用户名</label>
            <div className="relative">
              <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={21} />
              <input
                autoFocus
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && handleLogin()}
                className="min-h-[54px] w-full rounded-2xl border-2 border-gray-200 bg-gray-50 pl-12 pr-4 outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                placeholder="请输入用户名"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block font-semibold text-gray-800">密码</label>
            <div className="relative">
              <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={21} />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && handleLogin()}
                className="min-h-[54px] w-full rounded-2xl border-2 border-gray-200 bg-gray-50 pl-12 pr-12 outline-none focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                placeholder="请输入密码"
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 text-gray-500" aria-label={showPassword ? '隐藏密码' : '显示密码'}>
                {showPassword ? <EyeOff className="mx-auto" size={20} /> : <Eye className="mx-auto" size={20} />}
              </button>
            </div>
          </div>
          <button type="button" onClick={handleLogin} disabled={isSubmitting} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-lg font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 disabled:opacity-60">
            <LogIn size={21} />{isSubmitting ? '正在登录…' : '登录'}
          </button>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-5 text-center text-gray-600">
          还没有账号？
          <button type="button" onClick={() => { setError(''); setMode('register'); }} className="ml-1 font-bold text-orange-600 hover:text-orange-700">立即注册</button>
        </div>
      </div>
    </main>
  );
};

export default AuthGateway;
