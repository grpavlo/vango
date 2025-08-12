import { useState } from 'react';

const AdminMenu = ({ token, onLogout }) => {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  const sendPush = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('Повідомлення надіслано');
        setText('');
      } else {
        setStatus(data.error || 'Помилка надсилання');
      }
    } catch {
      setStatus('Помилка сервера');
    }
  };

  return (
    <div className="menu-container">
      <h2>Адмін панель</h2>
      <form className="push-form" onSubmit={sendPush}>
        <textarea
          className="push-input"
          placeholder="Текст push-повідомлення"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="push-button" type="submit">Надіслати push</button>
      </form>
      {status && <p className="push-status">{status}</p>}
      <button className="logout-button" onClick={onLogout}>Вийти</button>
    </div>
  );
};

export default AdminMenu;
