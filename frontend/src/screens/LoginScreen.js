import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Package } from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LoginScreen = () => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 4) {
      setPin(value);
      setError('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/pin-login`, {
        pin
      });

      if (response.data.success) {
        localStorage.setItem('partner_id', response.data.partner_id);
        localStorage.setItem('partner_name', response.data.partner_name);
        localStorage.setItem('partner_phone', response.data.partner_phone || '');
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Invalid PIN');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-content">
        <div className="login-header">
          <Package size={48} weight="duotone" className="brand-icon" />
          <h1 data-testid="login-title">Repid Cart Driver</h1>
        </div>

        <div className="login-form-section">
          <h2>Welcome back</h2>
          <p className="subtitle">Enter your 4-digit PIN to access orders</p>

          <form onSubmit={handleLogin}>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={pin}
              onChange={handlePinChange}
              placeholder="••••"
              className="pin-input"
              data-testid="login-pin-input"
              autoFocus
            />

            {error && (
              <div className="error-message" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || pin.length !== 4}
              data-testid="login-submit-button"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
