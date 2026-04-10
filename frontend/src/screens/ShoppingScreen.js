import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Circle, ArrowLeft } from '@phosphor-icons/react';

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
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
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

  const handleStartDelivery = async () => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'delivering' })
        .eq('id', orderId);

      if (error) throw error;
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
          <button onClick={() => navigate('/orders')} className="btn-icon">
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h3>Shopping List</h3>
          <div style={{ width: '40px' }}></div>
        </div>
      </div>

      <div className="screen-content">
        <div className="order-info-card">
          <h2>Order #{order.order_number}</h2>
          <p className="text-secondary">{order.customer_name}</p>
        </div>

        <div className="shopping-list" data-testid="shopping-list">
          <h3 className="section-title">Items to collect</h3>
          
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
                    Qty: {item.quantity} • ${item.price?.toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-secondary">No items in this order</p>
          )}
        </div>

        <div className="progress-indicator">
          <span>{checkedItems.size} of {order.items?.length || 0} items collected</span>
        </div>
      </div>

      <div className="sticky-bottom">
        <button
          onClick={handleStartDelivery}
          className="btn-primary"
          disabled={!allItemsChecked}
          data-testid="start-delivery-button"
        >
          Start Delivery
        </button>
      </div>
    </div>
  );
};

export default ShoppingScreen;
