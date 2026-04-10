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
import { toast } from 'sonner';
import ImageModal from '../components/ImageModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardScreen = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [skippedOrders, setSkippedOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('');
  const [realtimeChannel, setRealtimeChannel] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const partnerId = localStorage.getItem('partner_id');
    const name = localStorage.getItem('partner_name');
    
    if (!partnerId) {
      navigate('/');
      return;
    }
    
    setPartnerName(name);
    
    // Fetch all orders first
    fetchAllOrders(partnerId).then(() => {
      // After fetching, check if we should show Active tab
      const lastTab = localStorage.getItem('lastActiveTab');
      const hasActiveOrders = localStorage.getItem('hasActiveOrders') === 'true';
      
      // If user just accepted an order or has active orders, show Active tab
      if (hasActiveOrders || lastTab === 'active') {
        setActiveTab('active');
      }
      
      // Clear the flag
      localStorage.removeItem('hasActiveOrders');
    });
    
    fetchStats(partnerId);
    
    // Setup realtime subscription only once
    if (!realtimeChannel) {
      const channel = setupRealtimeSubscription();
      setRealtimeChannel(channel);
    }
    
    // Cleanup on unmount
    return () => {
      if (realtimeChannel) {
        console.log('🔌 Cleaning up Realtime subscription');
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [navigate]); // Remove realtimeChannel from dependencies to prevent re-subscription

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

      // Fetch completed orders (last 24 hours only)
      const completedRes = await axios.get(
        `${BACKEND_URL}/api/orders?status=completed&partner_id=${partnerId}&limit=50`
      );
      
      // Filter to show only orders from last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const recentCompleted = (completedRes.data.orders || []).filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= twentyFourHoursAgo;
      });
      
      setCompletedOrders(recentCompleted);

      // Fetch skipped orders
      const skippedRes = await axios.get(
        `${BACKEND_URL}/api/orders?status=skipped&partner_id=${partnerId}`
      );
      setSkippedOrders(skippedRes.data.orders || []);
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
    try {
      console.log('🔄 Setting up Realtime subscription for orders...');
      
      const channel = supabase
        .channel('orders-realtime-' + Date.now()) // Unique channel name
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events: INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            console.log('📦 Order change detected:', payload.eventType);
            console.log('Order data:', payload.new || payload.old);
            
            // Refresh orders and stats when any change occurs
            const partnerId = localStorage.getItem('partner_id');
            if (partnerId) {
              console.log('🔄 Refreshing orders and stats...');
              fetchAllOrders(partnerId);
              fetchStats(partnerId);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime connected! Orders will update automatically.');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Realtime connection error. Check Supabase settings.');
          } else if (status === 'TIMED_OUT') {
            console.warn('⚠️ Realtime connection timed out.');
          } else {
            console.log('Realtime status:', status);
          }
        });

      // Return the channel for cleanup
      return channel;
    } catch (error) {
      console.error('❌ Realtime subscription error:', error);
      return null;
    }
  };

  const handleAcceptOrder = async (orderId) => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      await axios.patch(`${BACKEND_URL}/api/orders/${orderId}`, {
        status: 'shopping',
        delivery_partner_id: parseInt(partnerId)
      });
      
      // Set flag so dashboard knows to show Active tab when we return
      localStorage.setItem('hasActiveOrders', 'true');
      localStorage.setItem('lastActiveTab', 'active');
      
      navigate(`/shopping/${orderId}`);
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleRejectOrder = async (orderId) => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      // Mark order as skipped for this driver
      await axios.patch(`${BACKEND_URL}/api/orders/${orderId}`, {
        status: 'skipped',
        delivery_partner_id: partnerId
      });
      
      toast.success('Order skipped');
      fetchAllOrders(partnerId);
    } catch (error) {
      console.error('Error skipping order:', error);
      toast.error('Failed to skip order');
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('lastActiveTab', tab);
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

      {/* Product Images Preview */}
      {order.items && order.items.length > 0 && (
        <div className="order-products-preview">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="product-preview-item">
              {item.image || item.image_url ? (
                <img 
                  src={item.image || item.image_url} 
                  alt={item.name}
                  className="product-preview-image"
                  onClick={() => setSelectedImage(item.image || item.image_url)}
                  style={{ cursor: 'pointer' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="product-preview-placeholder">
                  <Package size={16} weight="duotone" />
                </div>
              )}
              <span className="product-preview-name">{item.name}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="product-preview-more">
              +{order.items.length - 3} more
            </div>
          )}
        </div>
      )}

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

      {type === 'skipped' && (
        <button
          onClick={() => handleAcceptOrder(order.id)}
          className="btn-primary"
          data-testid={`reaccept-order-button-${order.id}`}
        >
          Accept Order
        </button>
      )}

      {type === 'completed' && (
        <div className="completed-info">
          <CheckCircle size={18} weight="fill" className="check-icon" />
          <span>Completed {new Date(order.created_at).toLocaleDateString()}</span>
        </div>
      )}

      {/* Make completed orders clickable */}
      {type === 'completed' && (
        <button
          onClick={() => navigate(`/completed/${order.id}`)}
          className="btn-secondary"
          data-testid={`view-completed-button-${order.id}`}
        >
          View Details
        </button>
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
      },
      skipped: {
        icon: <X size={64} weight="duotone" />,
        title: 'No skipped orders',
        subtitle: 'Orders you skip will appear here'
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
    completed: completedOrders,
    skipped: skippedOrders
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
          onClick={() => handleTabChange('available')}
          data-testid="tab-available"
        >
          Available
          {availableOrders.length > 0 && (
            <span className="badge">{availableOrders.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => handleTabChange('active')}
          data-testid="tab-active"
        >
          Active
          {activeOrders.length > 0 && (
            <span className="badge">{activeOrders.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'skipped' ? 'active' : ''}`}
          onClick={() => handleTabChange('skipped')}
          data-testid="tab-skipped"
        >
          Skipped
          {skippedOrders.length > 0 && (
            <span className="badge">{skippedOrders.length}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => handleTabChange('completed')}
          data-testid="tab-completed"
        >
          Completed
        </button>
      </div>

      {/* Show notice if on Available tab but has active orders */}
      {activeTab === 'available' && activeOrders.length > 0 && (
        <div className="active-orders-notice">
          <Clock size={20} weight="bold" />
          <span>You have {activeOrders.length} order{activeOrders.length > 1 ? 's' : ''} in progress! Check the Active tab.</span>
        </div>
      )}

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

      {/* Image Modal */}
      <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
};

export default DashboardScreen;
