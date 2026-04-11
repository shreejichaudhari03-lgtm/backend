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
import { OrderListSkeleton } from '../components/OrderSkeleton';
import { cacheManager } from '../utils/cache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardScreen = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [scheduledOrders, setScheduledOrders] = useState([]);
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
    fetchAllOrders(partnerId);
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
      // Check cache first for faster loading
      const cacheKey = `orders_${partnerId}`;
      const cached = cacheManager.get(cacheKey);
      
      if (cached) {
        setAvailableOrders(cached.available || []);
        setScheduledOrders(cached.scheduled || []);
        setCompletedOrders(cached.completed || []);
        setSkippedOrders(cached.skipped || []);
        setLoading(false);
      }

      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];

      // Fetch all in parallel for speed (including scheduled orders)
      const [availableRes, completedRes, skippedRes, scheduledRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/orders?status=pending`),
        axios.get(`${BACKEND_URL}/api/orders?status=completed&partner_id=${partnerId}&limit=50`),
        axios.get(`${BACKEND_URL}/api/orders?status=skipped&partner_id=${partnerId}`),
        axios.get(`${BACKEND_URL}/api/scheduled-orders?date=${today}`).catch(() => ({ data: { orders: [] } }))
      ]);

      const allScheduled = scheduledRes.data.orders || [];
      // Schedules tab: only non-completed
      const scheduledData = allScheduled.filter(o => o.status !== 'completed');
      // Completed scheduled orders (last 24 hours)
      const completedScheduled = allScheduled.filter(o => o.status === 'completed');

      const available = availableRes.data.orders || [];
      
      // Filter completed orders to last 24 hours
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentCompleted = (completedRes.data.orders || []).filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= twentyFourHoursAgo;
      });
      const recentCompletedScheduled = completedScheduled.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= twentyFourHoursAgo;
      });
      
      // Merge completed from both tables, mark scheduled ones
      const allCompleted = [
        ...recentCompleted,
        ...recentCompletedScheduled.map(o => ({ ...o, _source: 'scheduled' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const skipped = skippedRes.data.orders || [];

      setAvailableOrders(available);
      setScheduledOrders(scheduledData);
      setCompletedOrders(allCompleted);
      setSkippedOrders(skipped);
      
      cacheManager.set(cacheKey, {
        available,
        scheduled: scheduledData,
        completed: allCompleted,
        skipped
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
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
      console.log('Setting up Realtime subscriptions for orders and scheduled_orders...');
      
      const channel = supabase
        .channel('all-orders-realtime-' + Date.now())
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders'
          },
          (payload) => {
            console.log('Order change detected:', payload.eventType);
            const partnerId = localStorage.getItem('partner_id');
            if (partnerId) {
              fetchAllOrders(partnerId);
              fetchStats(partnerId);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'scheduled_orders'
          },
          (payload) => {
            console.log('Scheduled order change detected:', payload.eventType);
            const partnerId = localStorage.getItem('partner_id');
            if (partnerId) {
              fetchAllOrders(partnerId);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime connected for orders + scheduled_orders');
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Realtime connection error');
          }
        });

      return channel;
    } catch (error) {
      console.error('Realtime subscription error:', error);
      return null;
    }
  };

  const handleAcceptOrder = async (orderId, isScheduled = false) => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      // Store that this driver is working on this order
      localStorage.setItem(`working_on_${orderId}`, partnerId);
      if (isScheduled) {
        localStorage.setItem(`scheduled_order_${orderId}`, 'true');
      }
      
      navigate(`/shopping/${orderId}${isScheduled ? '?source=scheduled' : ''}`);
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleRejectOrder = async (orderId, isScheduled = false) => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      const endpoint = isScheduled 
        ? `${BACKEND_URL}/api/scheduled-orders/${orderId}`
        : `${BACKEND_URL}/api/orders/${orderId}`;
      
      await axios.patch(endpoint, {
        status: 'skipped',
        delivery_partner_id: partnerId
      });
      
      localStorage.removeItem(`working_on_${orderId}`);
      
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

  const renderOrderCard = (order, type) => {
    const isScheduled = type === 'active';
    
    return (
    <div key={order.id} className="order-card" data-testid={`order-card-${order.id}`}>
      <div className="order-header">
        <span className="order-number">Order #{order.order_number}</span>
        <span className={`status-badge status-${order.status}`}>
          {order.status}
        </span>
      </div>

      {/* Show scheduled date and delivery window for scheduled orders */}
      {isScheduled && order.scheduled_date && (
        <div className="scheduled-info">
          <div className="info-row">
            <Clock size={18} weight="bold" />
            <span>{new Date(order.scheduled_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            {order.delivery_window && (
              <span className="delivery-window-badge">{order.delivery_window}</span>
            )}
          </div>
        </div>
      )}

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
                  loading="lazy"
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

      {(type === 'available' || type === 'active') && (
        <div className="order-actions">
          <button
            onClick={() => handleRejectOrder(order.id, isScheduled)}
            className="btn-secondary-sm"
            data-testid={`reject-order-button-${order.id}`}
          >
            <X size={18} weight="bold" />
            Skip
          </button>
          <button
            onClick={() => handleAcceptOrder(order.id, isScheduled)}
            className="btn-primary-sm"
            data-testid={`accept-order-button-${order.id}`}
          >
            {localStorage.getItem(`working_on_${order.id}`) ? 'Resume Order' : 'Accept Order'}
          </button>
        </div>
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
  };

  const renderEmptyState = (type) => {
    const messages = {
      available: {
        icon: <Package size={64} weight="duotone" />,
        title: 'No pending orders',
        subtitle: 'New orders will appear here automatically'
      },
      active: {
        icon: <Clock size={64} weight="duotone" />,
        title: 'No scheduled orders today',
        subtitle: 'Scheduled deliveries for today will appear here'
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
    active: scheduledOrders,
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
          Schedules
          {scheduledOrders.length > 0 && (
            <span className="badge">{scheduledOrders.length}</span>
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

      <div className="screen-content">
        {loading ? (
          <OrderListSkeleton />
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
