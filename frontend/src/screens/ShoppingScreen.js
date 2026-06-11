import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import axios from 'axios';
import { CheckCircle, Circle, ArrowLeft, Phone, WhatsappLogo } from '@phosphor-icons/react';
import ImageModal from '../components/ImageModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ShoppingScreen = () => {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const isScheduled = searchParams.get('source') === 'scheduled' || localStorage.getItem(`scheduled_order_${orderId}`) === 'true';
  const splitGroup = searchParams.get('splitGroup'); // '1' or '2' or null
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [filteredItems, setFilteredItems] = useState([]);
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [removedItems, setRemovedItems] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const endpoint = isScheduled 
        ? `${BACKEND_URL}/api/scheduled-orders/${orderId}`
        : `${BACKEND_URL}/api/orders/${orderId}`;
      const response = await axios.get(endpoint);
      const fullOrder = response.data.order;
      setOrder(fullOrder);
      
      // Filter items if this is a split delivery
      if (splitGroup && fullOrder.items) {
        // Try localStorage first, then fall back to splitGroup field in items
        let filtered = null;
        try {
          const splitData = JSON.parse(localStorage.getItem(`split_${orderId}`) || '{}');
          const indices = splitGroup === '1' ? splitData.group1 : splitData.group2;
          if (indices && indices.length > 0) {
            filtered = indices.map(i => fullOrder.items[i]).filter(Boolean);
          }
        } catch {}
        
        if (!filtered) {
          // Read from items' splitGroup field (saved in DB)
          const groupNum = parseInt(splitGroup);
          filtered = fullOrder.items.filter(item => item.splitGroup === groupNum);
        }
        
        setFilteredItems(filtered && filtered.length > 0 ? filtered : fullOrder.items);
      } else {
        setFilteredItems(fullOrder.items || []);
      }
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

  const removeItem = (index, e) => {
    e.stopPropagation();
    const newRemoved = new Set(removedItems);
    newRemoved.add(index);
    setRemovedItems(newRemoved);
    
    // Also uncheck if it was checked
    const newChecked = new Set(checkedItems);
    newChecked.delete(index);
    setCheckedItems(newChecked);
  };

  const undoRemoveItem = (index, e) => {
    e.stopPropagation();
    const newRemoved = new Set(removedItems);
    newRemoved.delete(index);
    setRemovedItems(newRemoved);
  };

  const handleCallCustomer = () => {
    if (order?.customer_phone) {
      window.location.href = `tel:${order.customer_phone}`;
    }
  };

  const handleWhatsApp = () => {
    if (order?.customer_phone) {
      const phone = order.customer_phone.replace(/[^0-9]/g, '');
      const invoiceParams = new URLSearchParams();
      if (isScheduled) invoiceParams.set('source', 'scheduled');
      if (splitGroup) invoiceParams.set('splitGroup', splitGroup);
      const invoiceQs = invoiceParams.toString() ? `?${invoiceParams.toString()}` : '';
      const invoiceUrl = `${window.location.origin}/invoice/${orderId}${invoiceQs}`;
      const splitNote = splitGroup ? ` (Part ${splitGroup})` : '';
      const message = encodeURIComponent(`Hi ${order.customer_name}, Thanks for using Repid Cart 💚\n\nI'm currently shopping for your Order #${order.order_number}${splitNote}.\n\nView your invoice here:\n${invoiceUrl}`);
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    }
  };

  const handleStartDelivery = async () => {
    const partnerId = localStorage.getItem('partner_id');
    
    try {
      const endpoint = isScheduled 
        ? `${BACKEND_URL}/api/scheduled-orders/${orderId}`
        : `${BACKEND_URL}/api/orders/${orderId}`;
      
      // Mark unavailable items directly in the items array (use full order items)
      const updatedItems = order.items.map((item, index) => ({
        ...item,
        unavailable: removedItems.has(index) ? true : undefined
      }));
      
      await axios.patch(endpoint, {
        status: splitGroup ? order.status : 'delivering', // Don't change status if split (partial delivery)
        delivery_partner_id: partnerId,
        items: removedItems.size > 0 ? updatedItems : undefined
      });
      
      localStorage.removeItem(`working_on_${orderId}`);
      
      // Pass splitGroup to delivery screen
      const params = new URLSearchParams();
      if (isScheduled) params.set('source', 'scheduled');
      if (splitGroup) params.set('splitGroup', splitGroup);
      const qs = params.toString() ? `?${params.toString()}` : '';
      navigate(`/delivery/${orderId}${qs}`);
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to start delivery. Please try again.');
    }
  };

  const availableItemsCount = filteredItems.length - removedItems.size || 0;
  const allItemsChecked = availableItemsCount > 0 && 
    checkedItems.size === availableItemsCount;

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
          <div className="nav-actions">
            <button 
              onClick={handleWhatsApp} 
              className="btn-icon whatsapp-btn"
              data-testid="whatsapp-customer-button"
            >
              <WhatsappLogo size={24} weight="bold" />
            </button>
            <button 
              onClick={handleCallCustomer} 
              className="btn-icon"
              data-testid="call-customer-button"
            >
              <Phone size={24} weight="bold" />
            </button>
          </div>
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
            <div className="address-structured">
              {order.customer_address?.split(',').map((part, i) => {
                const trimmed = part.trim();
                const labels = ['Building', 'Floor', 'House no'];
                // Parse "Floor 3" -> label: Floor, value: 3
                const match = trimmed.match(/^(Floor|Door|House)\s*(.+)$/i);
                if (match) {
                  const label = match[1] === 'Door' ? 'House no' : match[1];
                  return <div key={i} className="address-line"><span className="address-label">{label}</span><span className="address-value">{match[2]}</span></div>;
                }
                // First part is building
                const label = i === 0 ? 'Building' : (labels[i] || 'Address');
                return <div key={i} className="address-line"><span className="address-label">{label}</span><span className="address-value">{trimmed}</span></div>;
              })}
            </div>
          </div>
        </div>

        <div className="shopping-list" data-testid="shopping-list">
          <h3 className="section-title">
            Items to collect ({filteredItems.length})
            {splitGroup && <span className="split-badge-inline"> · Part {splitGroup}</span>}
          </h3>
          
          {filteredItems.length > 0 ? (
            filteredItems.map((item, index) => {
              const isRemoved = removedItems.has(index);
              const isChecked = checkedItems.has(index);
              
              return (
                <div
                  key={index}
                  className={`checklist-item ${isChecked ? 'checked' : ''} ${isRemoved ? 'removed' : ''}`}
                  onClick={() => !isRemoved && toggleItem(index)}
                  data-testid={`checklist-item-${index}`}
                >
                  <div className="checkbox-wrapper">
                    {isRemoved ? (
                      <Circle size={32} weight="regular" className="checkbox-icon removed-icon" />
                    ) : isChecked ? (
                      <CheckCircle size={32} weight="fill" className="checkbox-icon checked" />
                    ) : (
                      <Circle size={32} weight="regular" className="checkbox-icon" />
                    )}
                  </div>
                  {(item.image || item.image_url) && !isRemoved && (
                    <img 
                      src={item.image || item.image_url} 
                      alt={item.name}
                      className="checklist-item-image"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(item.image || item.image_url);
                      }}
                      style={{ cursor: 'pointer' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                  <div className="item-details">
                    <span className="item-name">
                      {item.name}
                      {isRemoved && <span className="unavailable-tag">Not Available</span>}
                    </span>
                    <span className="item-meta">
                      Qty: {item.quantity} • ${item.price?.toFixed(2)} each
                    </span>
                  </div>
                  <div className="item-actions">
                    {isRemoved ? (
                      <button
                        onClick={(e) => undoRemoveItem(index, e)}
                        className="undo-item-btn"
                        data-testid={`undo-item-button-${index}`}
                        title="Mark as available"
                      >
                        <Circle size={24} weight="bold" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => removeItem(index, e)}
                        className="remove-item-btn"
                        data-testid={`remove-item-button-${index}`}
                        title="Mark as unavailable"
                      >
                        ✕
                      </button>
                    )}
                    {!isRemoved && (
                      <div className="item-price">
                        ${(item.quantity * item.price).toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-secondary">No items in this order</p>
          )}
        </div>

        <div className="progress-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${availableItemsCount > 0 ? (checkedItems.size / availableItemsCount) * 100 : 0}%` }}
            />
          </div>
          <span className="progress-text">
            {checkedItems.size} of {availableItemsCount} items collected
            {removedItems.size > 0 && ` • ${removedItems.size} unavailable`}
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

      {/* Image Modal */}
      <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
};

export default ShoppingScreen;
