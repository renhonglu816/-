import React, { useState } from 'react';
import ElderlyApp from './pages/ElderlyApp';
import ChildDashboard from './pages/ChildDashboard';
import Logo from './components/Logo';

function App() {
  const [currentView, setCurrentView] = useState('elderly'); // 'elderly' 或 'child'

  return (
    <div className="w-full min-h-screen bg-light">
      {/* 顶部Logo和导航栏 */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Logo size="small" />
        
        {/* 页面切换按钮 - 移动端适配 */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView('elderly')}
            className={`px-3 py-2 rounded-lg font-medium text-sm min-h-[40px] transition-all ${currentView === 'elderly' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            长者端
          </button>
          <button
            onClick={() => setCurrentView('child')}
            className={`px-3 py-2 rounded-lg font-medium text-sm min-h-[40px] transition-all ${currentView === 'child' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            子女端
          </button>
        </div>
      </div>

      {/* 根据当前视图渲染对应页面 */}
      <div className="pt-2">
        {currentView === 'elderly' ? <ElderlyApp /> : <ChildDashboard />}
      </div>
    </div>
  );
}

export default App;