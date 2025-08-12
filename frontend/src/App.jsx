import { useState } from 'react';
import './App.css';
import AdminLogin from './AdminLogin.jsx';
import AdminMenu from './AdminMenu.jsx';

const App = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="content">
      {token ? (
        <AdminMenu token={token} onLogout={handleLogout} />
      ) : (
        <AdminLogin onLogin={setToken} />
      )}
    </div>
  );
};

export default App;
