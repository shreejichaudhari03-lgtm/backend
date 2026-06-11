import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  X,
  MagnifyingGlass,
  Scissors
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import ImageModal from '../components/ImageModal';
import { OrderListSkeleton } from '../components/OrderSkeleton';
import { cacheManager } from '../utils/cache';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const POLL_INTERVAL = 15000; // Auto-refresh every 15 seconds

const DashboardScreen = () => {
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [scheduledOrders, setScheduledOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [skippedOrders, setSkippedOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partnerName, setPartnerName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [splitPickerOrder, setSplitPickerOrder] = useState(null); // order for item picker
  const [splitPickerScheduled, setSplitPickerScheduled] = useState(false);
  const [selectedSplitItems, setSelectedSplitItems] = useState(new Set());
  const channelRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const navigate = useNavigate();

  // Refresh function that can be called from anywhere
  const refreshOrders = useCallback(() => {
    const partnerId = localStorage.getItem('partner_id');
    if (partnerId) {
      fetchAllOrders(partnerId);
      fetchStats(partnerId);
    }
  }, []);

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
    
    // Setup realtime subscription
    const channel = supabase
      .channel('all-orders-realtime-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        const pid = localStorage.getItem('partner_id');
        if (pid) { fetchAllOrders(pid); fetchStats(pid); }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_orders' }, () => {
        const pid = localStorage.getItem('partner_id');
        if (pid) { fetchAllOrders(pid); }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime connected');
        }
      });
    channelRef.current = channel;

    // Polling fallback: auto-refresh every 15 seconds
    pollIntervalRef.current = setInterval(() => {
      const pid = localStorage.getItem('partner_id');
      if (pid) {
        fetchAllOrders(pid);
        fetchStats(pid);
      }
    }, POLL_INTERVAL);

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [navigate]);

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
      console.log('Fetching all orders...');

      // Fetch all in parallel for speed (including scheduled orders)
      const [availableRes, completedRes, skippedRes, scheduledRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/orders?status=placed`),
        axios.get(`${BACKEND_URL}/api/orders?status=completed&partner_id=${partnerId}&limit=50`),
        axios.get(`${BACKEND_URL}/api/orders?status=skipped&partner_id=${partnerId}`),
        axios.get(`${BACKEND_URL}/api/scheduled-orders?date=${today}`).catch(() => ({ data: { orders: [] } }))
      ]);
      const allScheduled = scheduledRes.data.orders || [];
      // Schedules tab: only active orders (not completed, skipped, or split), newest first
      const scheduledData = allScheduled
        .filter(o => o.status !== 'completed' && o.status !== 'skipped' && o.status !== 'split')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      // Completed scheduled orders (last 24 hours)
      const completedScheduled = allScheduled.filter(o => o.status === 'completed');
      // Skipped scheduled orders
      const skippedScheduled = allScheduled.filter(o => o.status === 'skipped');

      const available = (availableRes.data.orders || [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Filter completed orders to last 48 hours
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const recentCompleted = (completedRes.data.orders || []).filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= fortyEightHoursAgo;
      });
      const recentCompletedScheduled = completedScheduled.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= fortyEightHoursAgo;
      });
      
      // Merge completed from both tables
      const allCompleted = [
        ...recentCompleted,
        ...recentCompletedScheduled.map(o => ({ ...o, _source: 'scheduled' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Merge skipped from both tables
      const allSkipped = [
        ...(skippedRes.data.orders || []),
        ...skippedScheduled.map(o => ({ ...o, _source: 'scheduled' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setAvailableOrders(available);
      setScheduledOrders(scheduledData);
      setCompletedOrders(allCompleted);
      setSkippedOrders(allSkipped);
      
      cacheManager.set(cacheKey, {
        available,
        scheduled: scheduledData,
        completed: allCompleted,
        skipped: allSkipped
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

  const handleAcceptOrder = async (orderId, isScheduled = false, splitGroup = null) => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      localStorage.setItem(`working_on_${orderId}`, partnerId);
      if (isScheduled) {
        localStorage.setItem(`scheduled_order_${orderId}`, 'true');
      }
      // Pass split group info if accepting a split delivery
      const params = new URLSearchParams();
      if (isScheduled) params.set('source', 'scheduled');
      if (splitGroup) params.set('splitGroup', splitGroup);
      const qs = params.toString() ? `?${params.toString()}` : '';
      navigate(`/shopping/${orderId}${qs}`);
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleSplitOrder = (order, isScheduled) => {
    setSplitPickerOrder(order);
    setSplitPickerScheduled(isScheduled);
    setSelectedSplitItems(new Set());
  };

  const confirmSplit = () => {
    if (!splitPickerOrder || selectedSplitItems.size === 0) return;
    const orderId = splitPickerOrder.id;
    const allIndices = splitPickerOrder.items.map((_, i) => i);
    const group1 = Array.from(selectedSplitItems);
    const group2 = allIndices.filter(i => !selectedSplitItems.has(i));
    
    // Save split info to localStorage
    localStorage.setItem(`split_${orderId}`, JSON.stringify({ group1, group2, delivered1: false }));
    setSplitPickerOrder(null);
    // Force re-render
    setAvailableOrders(prev => [...prev]);
    setScheduledOrders(prev => [...prev]);
    toast.success('Order split! Deliver the first part now.');
  };

  const getSplitInfo = (orderId) => {
    try {
      const data = localStorage.getItem(`split_${orderId}`);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  };

  const markSplitDelivered = (orderId, group) => {
    const info = getSplitInfo(orderId);
    if (!info) return;
    if (group === 1) info.delivered1 = true;
    localStorage.setItem(`split_${orderId}`, JSON.stringify(info));
  };

  const handleRejectOrder = async (orderId, isScheduled = false) => {
    const partnerId = localStorage.getItem('partner_id');
    
    // Immediately remove from UI for instant feedback
    if (isScheduled) {
      setScheduledOrders(prev => prev.filter(o => o.id !== orderId));
    } else {
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
    }

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
      // Refresh to restore if API failed
      fetchAllOrders(partnerId);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
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

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    return `${days}d ago`;
  };

  const renderOrderCard = (order, type) => {
    const isScheduled = type === 'active';
    
    return (
    <div key={order.id} className="order-card" data-testid={`order-card-${order.id}`}>
      <div className="order-header">
        <div className="order-header-left">
          <span className="order-number">Order #{order.order_number}</span>
          <span className="order-time-ago">{getTimeAgo(order.created_at)}</span>
        </div>
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
        <div className="info-row address-info-row">
          <MapPin size={18} weight="bold" />
          <div className="address-structured-compact">
            {order.customer_address?.split(',').map((part, i) => {
              const trimmed = part.trim();
              const match = trimmed.match(/^(Floor|Door|House)\s*(.+)$/i);
              if (match) {
                const label = match[1] === 'Door' ? 'House no' : match[1];
                return <span key={i}><strong>{label}:</strong> {match[2]}</span>;
              }
              const label = i === 0 ? 'Bldg' : '';
              return <span key={i}>{label ? <><strong>{label}:</strong> {trimmed}</> : trimmed}</span>;
            })}
          </div>
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

      {(type === 'available' || type === 'active') && (() => {
        const splitInfo = getSplitInfo(order.id);
        
        if (splitInfo) {
          // Split view: show two groups in one card
          const group1Items = splitInfo.group1.map(i => order.items[i]).filter(Boolean);
          const group2Items = splitInfo.group2.map(i => order.items[i]).filter(Boolean);
          const group1Total = group1Items.reduce((s, it) => s + (it.price * (it.quantity || 1)), 0);
          const group2Total = group2Items.reduce((s, it) => s + (it.price * (it.quantity || 1)), 0);
          
          return (
            <div className="split-card-view">
              <div className={`split-group-section ${splitInfo.delivered1 ? 'delivered' : ''}`}>
                <div className="split-group-label">
                  <span className="split-dot split-dot-1">1</span>
                  <span>{splitInfo.delivered1 ? 'Delivered' : `Delivery 1 · ${group1Items.length} items · $${group1Total.toFixed(2)}`}</span>
                </div>
                <div className="split-group-items">
                  {group1Items.map((item, i) => (
                    <span key={i} className="split-item-chip">{item.name}</span>
                  ))}
                </div>
                {!splitInfo.delivered1 && (
                  <button
                    onClick={() => handleAcceptOrder(order.id, isScheduled, '1')}
                    className="btn-primary-sm"
                    data-testid={`accept-split-1-${order.id}`}
                  >Accept Delivery 1</button>
                )}
              </div>
              
              <div className="split-divider">
                <Scissors size={14} />
                <span>split</span>
              </div>

              <div className={`split-group-section ${!splitInfo.delivered1 ? 'waiting' : ''}`}>
                <div className="split-group-label">
                  <span className="split-dot split-dot-2">2</span>
                  <span>{!splitInfo.delivered1 ? `Remaining · ${group2Items.length} items · $${group2Total.toFixed(2)}` : `Delivery 2 · ${group2Items.length} items · $${group2Total.toFixed(2)}`}</span>
                </div>
                <div className="split-group-items">
                  {group2Items.map((item, i) => (
                    <span key={i} className="split-item-chip">{item.name}</span>
                  ))}
                </div>
                {splitInfo.delivered1 && (
                  <button
                    onClick={() => handleAcceptOrder(order.id, isScheduled, '2')}
                    className="btn-primary-sm"
                    data-testid={`accept-split-2-${order.id}`}
                  >Accept Delivery 2</button>
                )}
              </div>
            </div>
          );
        }
        
        // Normal (non-split) actions
        return (
          <div className="order-actions">
            <button
              onClick={() => handleRejectOrder(order.id, isScheduled)}
              className="btn-secondary-sm"
              data-testid={`reject-order-button-${order.id}`}
            >
              <X size={18} weight="bold" />
              Skip
            </button>
            {order.items && order.items.length > 1 && (
              <button
                onClick={() => handleSplitOrder(order, isScheduled)}
                className="btn-split-sm"
                data-testid={`split-order-button-${order.id}`}
              >
                <Scissors size={18} weight="bold" />
                Split
              </button>
            )}
            <button
              onClick={() => handleAcceptOrder(order.id, isScheduled)}
              className="btn-primary-sm"
              data-testid={`accept-order-button-${order.id}`}
            >
              {localStorage.getItem(`working_on_${order.id}`) ? 'Resume' : 'Accept'}
            </button>
          </div>
        );
      })()}

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

  const filteredCompleted = searchQuery.trim()
    ? completedOrders.filter(o => 
        o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : completedOrders;

  const currentOrders = {
    available: availableOrders,
    active: scheduledOrders,
    completed: filteredCompleted,
    skipped: skippedOrders
  }[activeTab];

  return (
    <div className="screen-container">
      <div className="dashboard-header">
        <div className="header-content">
          <div>
            <p className="welcome-text">Welcome</p>
            <h1 data-testid="driver-name">RepidCart Backed</h1>
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
        {activeTab === 'completed' && (
          <div className="search-bar" data-testid="completed-search">
            <MagnifyingGlass size={20} weight="bold" />
            <input
              type="text"
              placeholder="Search customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="completed-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="search-clear" data-testid="search-clear-btn">
                <X size={16} weight="bold" />
              </button>
            )}
          </div>
        )}
        {loading ? (
          <OrderListSkeleton />
        ) : currentOrders.length === 0 ? (
          searchQuery ? (
            <div className="empty-state">
              <MagnifyingGlass size={48} weight="duotone" />
              <h2>No results</h2>
              <p>No completed orders found for "{searchQuery}"</p>
            </div>
          ) : (
            renderEmptyState(activeTab)
          )
        ) : (
          <div className="orders-list" data-testid={`${activeTab}-orders-list`}>
            {currentOrders.map((order) => renderOrderCard(order, activeTab))}
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />

      {/* Split Item Picker */}
      {splitPickerOrder && (
        <div className="modal-overlay" onClick={() => setSplitPickerOrder(null)}>
          <div className="split-picker-modal" onClick={e => e.stopPropagation()} data-testid="split-picker">
            <button className="split-modal-close" onClick={() => setSplitPickerOrder(null)}><X size={20} /></button>
            <h2 className="split-picker-title"><Scissors size={22} /> Split Order #{splitPickerOrder.order_number}</h2>
            <p className="split-picker-desc">Pick items for the <strong>first delivery</strong>. The rest will stay as the second delivery.</p>
            
            <div className="split-picker-list">
              {splitPickerOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className={`split-picker-item ${selectedSplitItems.has(idx) ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedSplitItems(prev => {
                      const next = new Set(prev);
                      next.has(idx) ? next.delete(idx) : next.add(idx);
                      return next;
                    });
                  }}
                  data-testid={`split-pick-item-${idx}`}
                >
                  <div className={`split-picker-check ${selectedSplitItems.has(idx) ? 'checked' : ''}`}>
                    {selectedSplitItems.has(idx) ? <CheckCircle size={22} weight="fill" /> : <div className="split-picker-circle" />}
                  </div>
                  {(item.image || item.image_url) && (
                    <img src={item.image || item.image_url} alt={item.name} className="split-picker-img" />
                  )}
                  <div className="split-picker-info">
                    <span className="split-picker-name">{item.name}</span>
                    <span className="split-picker-meta">Qty: {item.quantity || 1} · ${item.price?.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="split-picker-summary">
              <span>Delivery 1: {selectedSplitItems.size} items</span>
              <span>Delivery 2: {splitPickerOrder.items.length - selectedSplitItems.size} items</span>
            </div>

            <button
              className="btn-split-primary"
              disabled={selectedSplitItems.size === 0 || selectedSplitItems.size === splitPickerOrder.items.length}
              onClick={confirmSplit}
              data-testid="confirm-split-btn"
            >
              Confirm Split
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardScreen;
