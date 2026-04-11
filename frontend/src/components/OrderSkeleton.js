import React from 'react';

const OrderSkeleton = () => {
  return (
    <div className="order-card skeleton-card">
      <div className="skeleton-header">
        <div className="skeleton-text skeleton-order-number"></div>
        <div className="skeleton-badge"></div>
      </div>
      <div className="skeleton-info">
        <div className="skeleton-text skeleton-line"></div>
        <div className="skeleton-text skeleton-line-short"></div>
      </div>
      <div className="skeleton-images">
        <div className="skeleton-image"></div>
        <div className="skeleton-image"></div>
        <div className="skeleton-image"></div>
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-button skeleton-button-small"></div>
        <div className="skeleton-button skeleton-button-primary"></div>
      </div>
    </div>
  );
};

export const OrderListSkeleton = () => {
  return (
    <div className="orders-list">
      <OrderSkeleton />
      <OrderSkeleton />
      <OrderSkeleton />
    </div>
  );
};
