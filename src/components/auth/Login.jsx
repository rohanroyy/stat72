import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function Login({ onLoginSuccess, onGoToRegister }) {
  const [regNum, setRegNum] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedRegNum = regNum.trim();
    const trimmedPassword = password.trim();

    if (!trimmedRegNum || !trimmedPassword) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isSupabaseConfigured()) {
        // Query email for the given registration number
        const { data, error: fetchError } = await supabase
          .from('students')
          .select('email')
          .eq('registration_number', trimmedRegNum)
          .maybeSingle();

        if (fetchError) {
          let msg = fetchError.message;
          if (msg.includes('public.students') || msg.includes('schema cache') || msg.includes('relation "students" does not exist')) {
            throw new Error("Database setup incomplete: Please execute the SQL queries from the 'supabase/schema.sql' file in your Supabase Dashboard SQL Editor to create the 'students' table, then reload and try again.");
          }
          throw new Error('Database error: ' + msg);
        }

        if (!data) {
          setError('Registration number is not registered.');
          setLoading(false);
          return;
        }

        // Authenticate via Supabase Auth using the email and password
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: trimmedPassword,
        });

        if (authError) {
          setError('Invalid registration number or password.');
          setLoading(false);
          return;
        }

        // Fetch student profile
        const { data: student, error: profileError } = await supabase
          .from('students')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profileError) {
          throw new Error('Failed to load profile: ' + profileError.message);
        }

        onLoginSuccess(student);
      } else {
        // Offline / local storage mock flow
        const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
        const mockStudents = JSON.parse(rawMock);
        const student = mockStudents.find((s) => s.registration_number === trimmedRegNum);

        if (!student) {
          setError('Registration number is not registered (offline mode).');
          setLoading(false);
          return;
        }

        if (student.password !== trimmedPassword) {
          setError('Invalid registration number or password.');
          setLoading(false);
          return;
        }

        // Save session locally
        localStorage.setItem('bahattor_logged_in_student', JSON.stringify(student));
        onLoginSuccess(student);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-screen auth-theme">
      <div className="setup-logo">Bahattor</div>

      <div className="setup-card glassmorphic-auth">
        <h2>Student Login</h2>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="setup-input-group">
            <label className="setup-label" htmlFor="login-regnum">
              Registration Number
            </label>
            <input
              id="login-regnum"
              className="setup-input"
              type="text"
              value={regNum}
              onChange={(e) => setRegNum(e.target.value)}
              placeholder="eg: 2022123123"
              required
              disabled={loading}
            />
          </div>

          <div className="setup-input-group">
            <label className="setup-label" htmlFor="login-pass">
              Password
            </label>
            <input
              id="login-pass"
              className="setup-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="setup-submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <button type="button" className="auth-link-btn" onClick={onGoToRegister}>
            Register here
          </button>
        </div>
      </div>
    </div>
  );
}
