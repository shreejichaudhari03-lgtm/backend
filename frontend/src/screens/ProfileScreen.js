import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, 
  SignOut, 
  User, 
  Phone, 
  CurrencyDollar, 
  Package,
  ToggleLeft,
  ToggleRight
} from '@phosphor-icons/react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ProfileScreen = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const partnerId = localStorage.getItem('partner_id');
    if (!partnerId) {
      navigate('/');
      return;
    }
    
    fetchProfile(partnerId);
    fetchStats(partnerId);
  }, [navigate]);

  const fetchProfile = async (partnerId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/partner/${partnerId}`);
      setProfile(response.data.partner);
      setIsActive(response.data.partner.is_active);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (partnerId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/partner/${partnerId}/stats`);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleToggleStatus = async () => {
    const partnerId = localStorage.getItem('partner_id');
    const newStatus = !isActive;
    
    try {
      await axios.patch(`${BACKEND_URL}/api/partner/${partnerId}/status`, {
        is_active: newStatus
      });
      setIsActive(newStatus);
      toast.success(newStatus ? 'You are now online' : 'You are now offline');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_id');
    localStorage.removeItem('partner_name');
    localStorage.removeItem('partner_phone');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="screen-container">
        <div className="screen-content">
          <div className="loading-state">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="top-nav">
        <div className="nav-content">
          <button onClick={() => navigate('/dashboard')} className="btn-icon">
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h3>Profile</h3>
          <div style={{ width: '40px' }}></div>
        </div>
      </div>

      <div className="screen-content">
        {/* Profile Info */}
        <div className="profile-card">
          <div className="profile-avatar">
            <User size={48} weight="bold" />
          </div>
          <h2>{profile?.name}</h2>
          <p className="text-secondary">Driver ID: {profile?.id}</p>
          {profile?.phone && (
            <div className="phone-info">
              <Phone size={18} />
              <span>{profile.phone}</span>
            </div>
          )}
        </div>

        {/* Status Toggle */}
        <div className="status-card">
          <div className="status-info">
            <h3>Online Status</h3>
            <p className="text-secondary">
              {isActive ? 'You are accepting new orders' : 'You are not accepting orders'}
            </p>
          </div>
          <button 
            onClick={handleToggleStatus}
            className="toggle-btn"
            data-testid="status-toggle-button"
          >
            {isActive ? (
              <ToggleRight size={48} weight="fill" className="toggle-active" />
            ) : (
              <ToggleLeft size={48} weight="fill" className="toggle-inactive" />
            )}
          </button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-box">
              <CurrencyDollar size={32} weight="duotone" className="stat-icon" />
              <div className="stat-info">
                <span className="stat-label">Total Earnings</span>
                <span className="stat-value-large">${stats.total_earnings}</span>
              </div>
            </div>
            <div className="stat-box">
              <Package size={32} weight="duotone" className="stat-icon" />
              <div className="stat-info">
                <span className="stat-label">Total Deliveries</span>
                <span className="stat-value-large">{stats.total_deliveries}</span>
              </div>
            </div>
            <div className="stat-box">
              <CurrencyDollar size={32} weight="duotone" className="stat-icon earning" />
              <div className="stat-info">
                <span className="stat-label">Today's Earnings</span>
                <span className="stat-value-large">${stats.today_earnings}</span>
              </div>
            </div>
            <div className="stat-box">
              <Package size={32} weight="duotone" className="stat-icon active" />
              <div className="stat-info">
                <span className="stat-label">Active Orders</span>
                <span className="stat-value-large">{stats.active_orders}</span>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className="btn-logout"
          data-testid="logout-button"
        >
          <SignOut size={20} weight="bold" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default ProfileScreen;
