import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle, MapPin, User, Phone, Package, Camera, Scissors } from '@phosphor-icons/react';
import ImageModal from '../components/ImageModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CompletedOrderScreen = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [splitData, setSplitData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`);
      setOrder(response.data.order);
    } catch (error) {
      try {
        const scheduledRes = await axios.get(`${BACKEND_URL}/api/scheduled-orders/${orderId}`);
        setOrder(scheduledRes.data.order);
      } catch (err) {
        console.error('Error fetching order:', err);
      }
    } finally {
      // Check for split data: first localStorage, then from items' splitGroup field
      try {
        const data = localStorage.getItem(`split_${orderId}`);
        if (data) {
          setSplitData(JSON.parse(data));
        }
      } catch {}
      setLoading(false);
    }
  };

  // After order loads, reconstruct split info from items if not in localStorage
  useEffect(() => {
    if (order && !splitData && order.items) {
      const hasSplitGroups = order.items.some(item => item.splitGroup);
      if (hasSplitGroups) {
        const group1 = order.items.map((_, i) => i).filter(i => order.items[i].splitGroup === 1);
        const group2 = order.items.map((_, i) => i).filter(i => order.items[i].splitGroup === 2);
        if (group1.length > 0 && group2.length > 0) {
          // Also try to get photos from localStorage
          let photos = {};
          try {
            const lsData = localStorage.getItem(`split_${orderId}`);
            if (lsData) photos = JSON.parse(lsData);
          } catch {}
          setSplitData({ 
            group1, group2, completed: true,
            photo1: photos.photo1 || null,
            photo2: photos.photo2 || null
          });
        }
      }
    }
  }, [order]);

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

  const completedDate = new Date(order.created_at);
  const formattedDate = completedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const isSplit = splitData && splitData.group1 && splitData.group2;
  const group1Items = isSplit ? splitData.group1.map(i => order.items?.[i]).filter(Boolean) : [];
  const group2Items = isSplit ? splitData.group2.map(i => order.items?.[i]).filter(Boolean) : [];

  const renderItemList = (items) => (
    <div className="completed-items-list">
      {items.map((item, index) => (
        <div key={index} className="completed-item">
          {(item.image || item.image_url) && (
            <img 
              src={item.image || item.image_url}
              alt={item.name}
              className="completed-item-image"
              onClick={() => setSelectedImage(item.image || item.image_url)}
            />
          )}
          <div className="completed-item-details">
            <span className="item-name">{item.name}</span>
            <span className="item-meta">Qty: {item.quantity} × ${item.price?.toFixed(2)}</span>
          </div>
          <span className="item-total">${(item.quantity * item.price).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );

  const renderPhotoSection = (photoUrl, label) => {
    if (!photoUrl) return null;
    return (
      <div className="split-photo-block">
        <h4 className="split-photo-label">
          <Camera size={16} weight="bold" />
          {label}
        </h4>
        <div className="proof-photo-container">
          <img 
            src={photoUrl}
            alt={label}
            className="proof-photo"
            onClick={() => setSelectedImage(photoUrl)}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="screen-container">
      <div className="top-nav">
        <div className="nav-content">
          <button onClick={() => navigate('/dashboard')} className="btn-icon">
            <ArrowLeft size={24} weight="bold" />
          </button>
          <h3>Order Details</h3>
          <div style={{ width: '40px' }}></div>
        </div>
      </div>

      <div className="screen-content">
        {/* Completed Badge */}
        <div className="completed-badge-large">
          <CheckCircle size={48} weight="fill" />
          <h2>Delivery Completed</h2>
          <p>{formattedDate}</p>
        </div>

        {/* Order Info */}
        <div className="order-detail-card">
          <h3>Order #{order.order_number}</h3>
          <div className="detail-row">
            <User size={20} weight="bold" />
            <div>
              <span className="label">Customer</span>
              <span className="value">{order.customer_name}</span>
            </div>
          </div>
          <div className="detail-row">
            <Phone size={20} weight="bold" />
            <div>
              <span className="label">Phone</span>
              <span className="value">{order.customer_phone}</span>
            </div>
          </div>
          <div className="detail-row">
            <MapPin size={20} weight="bold" />
            <div>
              <span className="label">Address</span>
              <span className="value">{order.customer_address}</span>
            </div>
          </div>
        </div>

        {isSplit ? (
          <>
            {/* Split Delivery 1 */}
            <div className="order-detail-card split-delivery-card">
              <div className="split-delivery-header">
                <span className="split-dot split-dot-1">1</span>
                <h3>Delivery 1 ({group1Items.length} items)</h3>
              </div>
              {renderItemList(group1Items)}
              {renderPhotoSection(splitData.photo1, 'Delivery 1 Proof')}
            </div>

            {/* Split Divider */}
            <div className="completed-split-divider">
              <Scissors size={14} />
              <span>split order</span>
            </div>

            {/* Split Delivery 2 */}
            <div className="order-detail-card split-delivery-card">
              <div className="split-delivery-header">
                <span className="split-dot split-dot-2">2</span>
                <h3>Delivery 2 ({group2Items.length} items)</h3>
              </div>
              {renderItemList(group2Items)}
              {renderPhotoSection(splitData.photo2, 'Delivery 2 Proof')}
            </div>
          </>
        ) : (
          <>
            {/* Normal Items List */}
            <div className="order-detail-card">
              <h3>Items Delivered ({order.items?.length || 0})</h3>
              {renderItemList(order.items || [])}
            </div>
          </>
        )}

        {/* Order Total */}
        <div className="order-detail-card">
          <div className="total-row">
            <span>Subtotal</span>
            <span>${order.subtotal?.toFixed(2)}</span>
          </div>
          <div className="total-row">
            <span>Delivery Fee</span>
            <span>${order.delivery_fee?.toFixed(2)}</span>
          </div>
          <div className="total-row total">
            <span>Total</span>
            <strong>${order.total?.toFixed(2)}</strong>
          </div>
          <div className="total-row earning-row">
            <span>Your Earning</span>
            <strong className="earning">${order.delivery_fee?.toFixed(2)}</strong>
          </div>
        </div>

        {/* Single Photo (non-split orders) */}
        {!isSplit && order.delivery_photo_url && (
          <div className="order-detail-card">
            <h3>
              <Camera size={20} weight="bold" style={{ marginRight: '0.5rem' }} />
              Delivery Proof Photo
            </h3>
            <div className="proof-photo-container">
              <img 
                src={order.delivery_photo_url}
                alt="Delivery proof"
                className="proof-photo"
                onClick={() => setSelectedImage(order.delivery_photo_url)}
              />
              <p className="photo-caption">Tap to view full size</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      <ImageModal imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
};

export default CompletedOrderScreen;
