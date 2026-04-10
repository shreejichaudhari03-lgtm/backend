import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { 
  MapPin, 
  Package, 
  CurrencyDollar, 
  User, 
  CheckCircle,
  Clock,
  X
} from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardScreen = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const partnerId = localStorage.getItem('partner_id');
    const name = localStorage.getItem('partner_name');
    
    if (!partnerId) {
      navigate('/');
      return;
    }
    
    setPartnerName(name);
    fetchAllOrders(partnerId);
    fetchStats(partnerId);
    setupRealtimeSubscription();
  }, [navigate]);

  const fetchAllOrders = async (partnerId) => {
    try {
      // Fetch available (pending) orders
      const availableRes = await axios.get(`${BACKEND_URL}/api/orders?status=pending`);
      setAvailableOrders(availableRes.data.orders || []);

      // Fetch active orders (shopping or delivering)
      const shoppingRes = await axios.get(
        `${BACKEND_URL}/api/orders?status=shopping&partner_id=${partnerId}`
      );
      const deliveringRes = await axios.get(
        `${BACKEND_URL}/api/orders?status=delivering&partner_id=${partnerId}`
      );
      
      const active = [
        ...(shoppingRes.data.orders || []),
        ...(deliveringRes.data.orders || [])
      ];
      setActiveOrders(active);

      // Fetch completed orders
      const completedRes = await axios.get(
        `${BACKEND_URL}/api/orders?status=completed&partner_id=${partnerId}&limit=20`
      );
      setCompletedOrders(completedRes.data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
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

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Order change detected:', payload);
          const partnerId = localStorage.getItem('partner_id');
          fetchAllOrders(partnerId);
          fetchStats(partnerId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleAcceptOrder = async (orderId) => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      await axios.patch(`${BACKEND_URL}/api/orders/${orderId}`, {
        status: 'shopping',
        delivery_partner_id: parseInt(partnerId)
      });
      
      navigate(`/shopping/${orderId}`);
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleRejectOrder = async (orderId) => {
    try {
      await axios.post(`${BACKEND_URL}/api/orders/${orderId}/reject`);
      const partnerId = localStorage.getItem('partner_id');
      fetchAllOrders(partnerId);
    } catch (error) {
      console.error('Error rejecting order:', error);
    }
  };

  const handleContinueOrder = (order) => {
    if (order.status === 'shopping') {
      navigate(`/shopping/${order.id}`);
    } else if (order.status === 'delivering') {
      navigate(`/delivery/${order.id}`);
    }
  };

  const getItemCount = (items) => {
    if (!items) return 0;
    if (Array.isArray(items)) {
      return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }
    return 0;
  };

  const renderOrderCard = (order, type) => (
    <div key={order.id} className="order-card" data-testid={`order-card-${order.id}`}>
      <div className="order-header">
        <span className="order-number">Order #{order.order_number}</span>
        <span className={`status-badge status-${order.status}`}>
          {order.status}
        </span>
      </div>

      <div className="order-info">
        <div className="info-row">
          <User size={18} weight="bold" />
          <span>{order.customer_name}</span>
        </div>
        <div className="info-row">
          <MapPin size={18} weight="bold" />
          <span>{order.customer_address}</span>
        </div>
      </div>

      <div className="order-details">
        <div className="detail-item">
          <Package size={18} />
          <span>{getItemCount(order.items)} items</span>
        </div>
        <div className="detail-item">
          <CurrencyDollar size={18} />
          <span>${order.total?.toFixed(2)}</span>
        </div>
        {order.delivery_fee && (
          <div className="detail-item earning">
            <span>Earn: ${order.delivery_fee?.toFixed(2)}</span>
          </div>
        )}
      </div>

      {type === 'available' && (
        <div className="order-actions">
          <button
            onClick={() => handleRejectOrder(order.id)}
            className="btn-secondary-sm"
            data-testid={`reject-order-button-${order.id}`}
          >
            <X size={18} weight="bold" />
            Skip
          </button>
          <button
            onClick={() => handleAcceptOrder(order.id)}
            className="btn-primary-sm"
            data-testid={`accept-order-button-${order.id}`}
          >
            Accept Order
          </button>
        </div>
      )}

      {type === 'active' && (
        <button
          onClick={() => handleContinueOrder(order)}
          className="btn-primary"
          data-testid={`continue-order-button-${order.id}`}
        >
          Continue
        </button>
      )}

      {type === 'completed' && (
        <div className="completed-info">
          <CheckCircle size={18} weight="fill" className="check-icon" />
          <span>Completed {new Date(order.created_at).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );

  const renderEmptyState = (type) => {
    const messages = {
      available: {
        icon: <Package size={64} weight="duotone" />,
        title: 'No pending orders',
        subtitle: 'New orders will appear here automatically'
      },
      active: {
        icon: <Clock size={64} weight="duotone" />,
        title: 'No active orders',
        subtitle: 'Accept an order to get started'
      },
      completed: {
        icon: <CheckCircle size={64} weight="duotone" />,
        title: 'No completed deliveries',
        subtitle: 'Your delivery history will appear here'
      }
    };

    const message = messages[type];
    return (
      <div className="empty-state">
        {message.icon}
        <h2>{message.title}</h2>
        <p>{message.subtitle}</p>
      </div>
    );
  };

  const currentOrders = {
    available: availableOrders,
    active: activeOrders,
    completed: completedOrders
  }[activeTab];

  return (
    <div className="screen-container">
      <div className="dashboard-header">
        <div className="header-content">
          <div>
            <h1 data-testid="driver-name">{partnerName}</h1>
            <p className="driver-id">Driver ID: {localStorage.getItem('partner_id')}</p>
          </div>
          <button 
            onClick={() => navigate('/profile')} 
            className="profile-btn"
            data-testid="profile-button"
          >
            <User size={24} weight="bold" />
          </button>
        </div>

        {stats && (
          <div className="stats-cards">
            <div className="stat-card">
              <span className="stat-label">Today's Earnings</span>
              <span className="stat-value">${stats.today_earnings}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Total Deliveries</span>
              <span className="stat-value">{stats.total_deliveries}</span>
            </div>
          </div>
        )}
      </div>

      <div className="tabs-container">
        <button
          className={`tab ${activeTab === 'available' ? 'active' : ''}`}
          onClick={() => setActiveTab('available')}
          data-testid="tab-available"
        >
          Available
          {availableOrders.length > 0 && (
            <span className="badge">{availableOrders.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
          data-testid="tab-active"
        >
          Active
          {activeOrders.length > 0 && (
            <span className="badge">{activeOrders.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
          data-testid="tab-completed"
        >
          Completed
        </button>
      </div>

      <div className="screen-content">
        {loading ? (
          <div className="loading-state">Loading orders...</div>
        ) : currentOrders.length === 0 ? (
          renderEmptyState(activeTab)
        ) : (
          <div className="orders-list" data-testid={`${activeTab}-orders-list`}>
            {currentOrders.map((order) => renderOrderCard(order, activeTab))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardScreen;
