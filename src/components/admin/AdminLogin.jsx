import React, { useState } from 'react';

export default function AdminLogin({ onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const envUser = import.meta.env.VITE_ADMIN_USER || 'admin';
    const envPass = import.meta.env.VITE_ADMIN_PASS || 'studydock2026';

    if (userId === envUser && password === envPass) {
      onLoginSuccess();
    } else {
      setError('Invalid Admin ID or Password');
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-logo">Bahattor Admin</div>
      <div className="setup-card">
        <h2>Admin Authentication</h2>
        <p>Access is restricted to authorized administrators only. Enter your credentials below to log in.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="setup-input-group">
            <label className="setup-label" htmlFor="admin-id-input">Admin ID</label>
            <input
              id="admin-id-input"
              className="setup-input"
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter Admin ID"
              autoComplete="username"
              required
            />
          </div>

          <div className="setup-input-group">
            <label className="setup-label" htmlFor="admin-pass-input">Password</label>
            <input
              id="admin-pass-input"
              className="setup-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button type="submit" className="setup-submit" disabled={!userId || !password}>
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
