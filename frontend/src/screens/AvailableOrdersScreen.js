import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { MapPin, Package, CurrencyDollar, SignOut } from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const AvailableOrdersScreen = () => {
  const [orders, setOrders] = useState([]);
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
    fetchPendingOrders();
    setupRealtimeSubscription();
  }, [navigate]);

  const fetchPendingOrders = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders?status=pending`);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    // Subscribe to orders table changes
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
          // Refresh orders when changes occur
          fetchPendingOrders();
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
      
      // Navigate to shopping screen
      navigate(`/shopping/${orderId}`);
    } catch (error) {
      console.error('Error accepting order:', error);
      alert('Failed to accept order. Please try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_id');
    localStorage.removeItem('partner_name');
    navigate('/');
  };

  const getItemCount = (items) => {
    if (!items) return 0;
    if (Array.isArray(items)) {
      return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }
    return 0;
  };

  return (
    <div className="screen-container">
      <div className="top-nav">
        <div className="nav-content">
          <div>
            <h3 data-testid="driver-name">{partnerName}</h3>
            <span className="status-badge">Online</span>
          </div>
          <button onClick={handleLogout} className="btn-icon" data-testid="logout-button">
            <SignOut size={24} weight="bold" />
          </button>
        </div>
      </div>

      <div className="screen-content">
        <h1>Available Orders</h1>
        
        {loading ? (
          <div className="loading-state">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <Package size={64} weight="duotone" />
            <h2>No pending orders</h2>
            <p>New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="orders-list" data-testid="available-orders-list">
            {orders.map((order) => (
              <div key={order.id} className="order-card" data-testid={`order-card-${order.id}`}>
                <div className="order-header">
                  <span className="order-number">Order #{order.order_number}</span>
                  <span className="order-time">
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <div className="order-address">
                  <MapPin size={20} weight="bold" />
                  <span>{order.customer_address}</span>
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
                </div>

                <button
                  onClick={() => handleAcceptOrder(order.id)}
                  className="btn-primary"
                  data-testid={`accept-order-button-${order.id}`}
                >
                  Accept Order
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableOrdersScreen;
