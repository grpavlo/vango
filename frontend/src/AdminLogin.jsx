import { useState } from 'react';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setMessage('Вхід виконано');
        setMessageType('success');
      } else {
        setMessage(data.message || 'Помилка входу');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('Помилка з’єднання з сервером');
      setMessageType('error');
    }
  };

  return (
    <div className="login-container">
      <h2 className="login-title">Вхід адміністратора</h2>
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          className="login-input"
          placeholder="Ім'я користувача"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
        <input
          className="login-input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button className="login-button" type="submit">Увійти</button>
      </form>
      {message && <p className={`login-message ${messageType}`}>{message}</p>}
    </div>
  );
};

export default AdminLogin;
