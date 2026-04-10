import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { CheckCircle, Circle, ArrowLeft, Phone } from '@phosphor-icons/react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ShoppingScreen = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`);
      setOrder(response.data.order);
    } catch (error) {
      console.error('Error fetching order:', error);
      alert('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (index) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedItems(newChecked);
  };

  const handleCallCustomer = () => {
    if (order?.customer_phone) {
      window.location.href = `tel:${order.customer_phone}`;
    }
  };

  const handleStartDelivery = async () => {
    try {
      await axios.patch(`${BACKEND_URL}/api/orders/${orderId}`, {
        status: 'delivering'
      });
      navigate(`/delivery/${orderId}`);
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to start delivery. Please try again.');
    }
  };

  const allItemsChecked = order?.items?.length > 0 && 
    checkedItems.size === order.items.length;

  if (loading) {
    return (
      <div className="screen-container">
        <div className="screen-content">
          <div className="loading-state">Loading...</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="screen-container">
        <div className="screen-content">
          <div className="error-message">Order not found</div>
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
          <h3>Shopping List</h3>
          <button 
            onClick={handleCallCustomer} 
            className="btn-icon"
            data-testid="call-customer-button"
          >
            <Phone size={24} weight="bold" />
          </button>
        </div>
      </div>

      <div className="screen-content">
        <div className="order-info-card">
          <div className="order-info-header">
            <div>
              <h2>Order #{order.order_number}</h2>
              <p className="text-secondary">{order.customer_name}</p>
            </div>
            <div className="earnings-badge">
              <span>Earn</span>
              <strong>${order.delivery_fee?.toFixed(2)}</strong>
            </div>
          </div>
          <div className="address-row">
            <span className="text-secondary">Deliver to:</span>
            <p className="address-text">{order.customer_address}</p>
          </div>
        </div>

        <div className="shopping-list" data-testid="shopping-list">
          <h3 className="section-title">Items to collect ({order.items?.length || 0})</h3>
          
          {order.items && order.items.length > 0 ? (
            order.items.map((item, index) => (
              <div
                key={index}
                className={`checklist-item ${checkedItems.has(index) ? 'checked' : ''}`}
                onClick={() => toggleItem(index)}
                data-testid={`checklist-item-${index}`}
              >
                <div className="checkbox-wrapper">
                  {checkedItems.has(index) ? (
                    <CheckCircle size={32} weight="fill" className="checkbox-icon checked" />
                  ) : (
                    <Circle size={32} weight="regular" className="checkbox-icon" />
                  )}
                </div>
                <div className="item-details">
                  <span className="item-name">{item.name}</span>
                  <span className="item-meta">
                    Qty: {item.quantity} • ${item.price?.toFixed(2)} each
                  </span>
                </div>
                <div className="item-price">
                  ${(item.quantity * item.price).toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <p className="text-secondary">No items in this order</p>
          )}
        </div>

        <div className="progress-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(checkedItems.size / (order.items?.length || 1)) * 100}%` }}
            />
          </div>
          <span className="progress-text">
            {checkedItems.size} of {order.items?.length || 0} items collected
          </span>
        </div>
      </div>

      <div className="sticky-bottom">
        <button
          onClick={handleStartDelivery}
          className="btn-primary"
          disabled={!allItemsChecked}
          data-testid="start-delivery-button"
        >
          {allItemsChecked ? 'Start Delivery' : 'Check all items first'}
        </button>
      </div>
    </div>
  );
};

export default ShoppingScreen;
