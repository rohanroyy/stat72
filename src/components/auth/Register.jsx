import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function Register({ onRegisterSuccess, onGoToLogin }) {
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'Male',
    classRoll: '',
    regNum: '',
    session: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const {
      name,
      dob,
      gender,
      classRoll,
      regNum,
      session,
      email,
      phone,
      password,
      confirmPassword,
    } = formData;

    // Basic required validation
    if (
      !name ||
      !dob ||
      !gender ||
      !classRoll ||
      !regNum ||
      !session ||
      !email ||
      !phone ||
      !password ||
      !confirmPassword
    ) {
      setError('All fields are required.');
      return;
    }

    // Email validation
    const emailLower = email.trim().toLowerCase();
    if (!emailLower.endsWith('@stat.du.ac.bd')) {
      setError("Enter correct registration number and educational mail");
      return;
    }

    // Extraction & comparison validation
    const emailPrefix = emailLower.split('@')[0];
    const emailDigits = (emailPrefix.match(/\d+/g) || []).join('');
    const regDigits = regNum.replace(/\D/g, ''); // Extract only digits from entered Registration Number

    if (!emailDigits) {
      setError("Enter correct registration number and educational mail");
      return;
    }

    if (emailDigits !== regDigits) {
      setError("Enter correct registration number and educational mail");
      return;
    }

    // Password validation
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (isSupabaseConfigured()) {
        // Sign up with Supabase Auth
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: emailLower,
          password: password,
        });

        if (signUpError) {
          throw new Error(signUpError.message);
        }

        if (!authData.user) {
          throw new Error('Registration failed. Please try again.');
        }

        // Insert student profile into students table
        const { error: profileError } = await supabase.from('students').insert([
          {
            id: authData.user.id,
            name: name.trim(),
            dob: dob,
            gender: gender,
            class_roll: classRoll.trim(),
            registration_number: regNum.trim(),
            session: session.trim(),
            email: emailLower,
            phone_number: phone.trim(),
          },
        ]);

        if (profileError) {
          let msg = profileError.message;
          if (msg.includes('public.students') || msg.includes('schema cache') || msg.includes('relation "students" does not exist')) {
            throw new Error("Database setup incomplete: Please execute the SQL queries from the 'supabase/schema.sql' file in your Supabase Dashboard SQL Editor to create the 'students' table, then reload and try again.");
          }
          throw new Error('Failed to create student profile: ' + msg);
        }

        // Load profile and trigger success
        const { data: student, error: fetchError } = await supabase
          .from('students')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (fetchError) throw fetchError;
        onRegisterSuccess(student);
      } else {
        // Mock offline registration
        const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
        const mockStudents = JSON.parse(rawMock);

        // Check if registration number or email is already taken
        if (mockStudents.some((s) => s.registration_number === regNum.trim())) {
          setError('Registration number is already registered.');
          setLoading(false);
          return;
        }

        if (mockStudents.some((s) => s.email === emailLower)) {
          setError('Email is already registered.');
          setLoading(false);
          return;
        }

        const newStudent = {
          id: 'mock-' + Math.random().toString(36).substr(2, 9),
          name: name.trim(),
          dob: dob,
          gender: gender,
          class_roll: classRoll.trim(),
          registration_number: regNum.trim(),
          session: session.trim(),
          email: emailLower,
          phone_number: phone.trim(),
          password: password, // Store plain password for mock authentication
          mood: null,
          mood_selected_at: null,
        };

        mockStudents.push(newStudent);
        localStorage.setItem('bahattor_mock_students', JSON.stringify(mockStudents));

        // Save session locally
        localStorage.setItem('bahattor_logged_in_student', JSON.stringify(newStudent));
        onRegisterSuccess(newStudent);
      }
    } catch (err) {
      console.error('Registration error:', err);
      let errMsg = err.message || 'An unexpected error occurred.';
      if (errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('rate_limit')) {
        errMsg = "Supabase Email Rate Limit Exceeded: Please check your Supabase Dashboard settings under Settings -> Auth -> Rate Limits to increase or disable registration/sign-up rate limits.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-screen auth-theme">
      <div className="setup-logo">Bahattor</div>

      <div className="setup-card glassmorphic-auth" style={{ maxWidth: '520px' }}>
        <h2>Student Registration</h2>
        <p>Fill out the form below to create your student account.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="setup-input-row">
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-name">
                Full Name
              </label>
              <input
                id="reg-name"
                name="name"
                className="setup-input"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Rohit Roy"
                required
                disabled={loading}
              />
            </div>
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-dob">
                Date of Birth
              </label>
              <input
                id="reg-dob"
                name="dob"
                className="setup-input"
                type="date"
                value={formData.dob}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="setup-input-row">
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-gender">
                Gender
              </label>
              <select
                id="reg-gender"
                name="gender"
                className="setup-input"
                value={formData.gender}
                onChange={handleChange}
                required
                disabled={loading}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-roll">
                Class Roll
              </label>
              <input
                id="reg-roll"
                name="classRoll"
                className="setup-input"
                type="text"
                value={formData.classRoll}
                onChange={handleChange}
                placeholder="e.g. 7205"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="setup-input-row">
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-regnum">
                Registration Number
              </label>
              <input
                id="reg-regnum"
                name="regNum"
                className="setup-input"
                type="text"
                value={formData.regNum}
                onChange={handleChange}
                placeholder="eg: 2022123123"
                required
                disabled={loading}
              />
            </div>
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-session">
                Session
              </label>
              <input
                id="reg-session"
                name="session"
                className="setup-input"
                type="text"
                value={formData.session}
                onChange={handleChange}
                placeholder="eg: 2022-23"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="setup-input-group">
            <label className="setup-label" htmlFor="reg-email">
              DU Student Email
            </label>
            <input
              id="reg-email"
              name="email"
              className="setup-input"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="e.g. rohit-2021123456@stat.du.ac.bd"
              required
              disabled={loading}
            />
          </div>

          <div className="setup-input-group">
            <label className="setup-label" htmlFor="reg-phone">
              Phone Number
            </label>
            <input
              id="reg-phone"
              name="phone"
              className="setup-input"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="e.g. 01712345678"
              required
              disabled={loading}
            />
          </div>

          <div className="setup-input-row">
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                name="password"
                className="setup-input"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                required
                disabled={loading}
              />
            </div>
            <div className="setup-input-group">
              <label className="setup-label" htmlFor="reg-confirm">
                Confirm Password
              </label>
              <input
                id="reg-confirm"
                name="confirmPassword"
                className="setup-input"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button type="submit" className="setup-submit" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <button type="button" className="auth-link-btn" onClick={onGoToLogin}>
            Login here
          </button>
        </div>
      </div>
    </div>
  );
}
