import React, { useState } from 'react';
import ElderlyApp from './pages/ElderlyApp';
import ChildDashboard from './pages/ChildDashboard';
import AuthGateway from './components/auth/AuthGateway';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
      const token = localStorage.getItem('authToken');
      return token && ['parent', 'child'].includes(storedUser?.role) ? storedUser : null;
    } catch (_error) {
      return null;
    }
  });

  if (!currentUser) return <AuthGateway onAuthenticated={setCurrentUser} />;

  const handleLogout = () => setCurrentUser(null);
  return currentUser.role === 'child'
    ? <ChildDashboard onLogout={handleLogout} />
    : <ElderlyApp onLogout={handleLogout} />;
}

export default App;
