import React, { useState } from 'react';
import { Package, SplitVertical, X, Check, ArrowRight } from '@phosphor-icons/react';

const SPLIT_THRESHOLD = 25;

const SplitOrderModal = ({ order, isScheduled, onSplit, onSkip, onClose }) => {
  const [step, setStep] = useState('ask'); // 'ask' | 'count' | 'assign'
  const [splitCount, setSplitCount] = useState(2);
  const [assignments, setAssignments] = useState({}); // { itemIndex: splitGroupIndex }
  const [splitting, setSplitting] = useState(false);

  const items = order?.items || [];
  const total = order?.total || 0;

  // Initialize assignments - all unassigned
  const getGroupItems = (groupIdx) => {
    return items.filter((_, i) => assignments[i] === groupIdx);
  };

  const getGroupTotal = (groupIdx) => {
    return getGroupItems(groupIdx).reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  };

  const getUnassignedItems = () => {
    return items.filter((_, i) => assignments[i] === undefined);
  };

  const toggleAssignment = (itemIndex, groupIdx) => {
    setAssignments(prev => {
      const updated = { ...prev };
      if (updated[itemIndex] === groupIdx) {
        delete updated[itemIndex];
      } else {
        updated[itemIndex] = groupIdx;
      }
      return updated;
    });
  };

  const allAssigned = Object.keys(assignments).length === items.length;
  
  // Check each split has at least 1 item
  const allSplitsHaveItems = () => {
    for (let i = 0; i < splitCount; i++) {
      if (getGroupItems(i).length === 0) return false;
    }
    return true;
  };

  const handleConfirmSplit = async () => {
    if (!allAssigned || !allSplitsHaveItems()) return;
    
    setSplitting(true);
    
    // Build splits array: [[itemIdx, itemIdx], [itemIdx, itemIdx]]
    const splits = [];
    for (let i = 0; i < splitCount; i++) {
      const indices = items
        .map((_, idx) => idx)
        .filter(idx => assignments[idx] === i);
      splits.push(indices);
    }
    
    await onSplit(splits);
    setSplitting(false);
  };

  const splitColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  if (step === 'ask') {
    return (
      <div className="modal-overlay" data-testid="split-modal">
        <div className="split-modal">
          <button className="split-modal-close" onClick={onClose}><X size={20} /></button>
          <div className="split-ask">
            <SplitVertical size={48} weight="duotone" className="split-icon" />
            <h2>Large Order</h2>
            <p className="split-total">Order total: <strong>${total.toFixed(2)}</strong></p>
            <p className="split-desc">This order is over $25. Would you like to split it into smaller deliveries?</p>
            <div className="split-ask-actions">
              <button className="btn-split-primary" onClick={() => setStep('count')} data-testid="split-yes-btn">
                Yes, split it
              </button>
              <button className="btn-split-secondary" onClick={onSkip} data-testid="split-no-btn">
                No, deliver as one
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'count') {
    return (
      <div className="modal-overlay" data-testid="split-modal">
        <div className="split-modal">
          <button className="split-modal-close" onClick={onClose}><X size={20} /></button>
          <div className="split-ask">
            <h2>How many splits?</h2>
            <p className="split-desc">Choose how many deliveries to split into</p>
            <div className="split-count-options">
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  className={`split-count-btn ${splitCount === n ? 'active' : ''}`}
                  onClick={() => setSplitCount(n)}
                  data-testid={`split-count-${n}`}
                >
                  {n} splits
                </button>
              ))}
            </div>
            <button className="btn-split-primary" onClick={() => setStep('assign')}>
              <ArrowRight size={18} weight="bold" />
              Next - Assign Items
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step: assign items to splits
  return (
    <div className="modal-overlay" data-testid="split-modal">
      <div className="split-modal split-modal-large">
        <button className="split-modal-close" onClick={onClose}><X size={20} /></button>
        <h2 className="split-assign-title">Assign items to splits</h2>
        <p className="split-assign-desc">Tap an item, then tap a split group to assign it</p>

        {/* Split group tabs */}
        <div className="split-groups-bar">
          {Array.from({ length: splitCount }, (_, i) => (
            <div key={i} className="split-group-tab" style={{ borderColor: splitColors[i] }}>
              <span className="split-group-dot" style={{ background: splitColors[i] }}>{i + 1}</span>
              <span className="split-group-info">
                {getGroupItems(i).length} items · ${getGroupTotal(i).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Items list */}
        <div className="split-items-list" data-testid="split-items-list">
          {items.map((item, index) => {
            const assignedTo = assignments[index];
            const isAssigned = assignedTo !== undefined;
            return (
              <div key={index} className={`split-item ${isAssigned ? 'assigned' : ''}`}>
                <div className="split-item-info">
                  {(item.image || item.image_url) && (
                    <img src={item.image || item.image_url} alt={item.name} className="split-item-img" />
                  )}
                  <div>
                    <span className="split-item-name">{item.name}</span>
                    <span className="split-item-price">Qty: {item.quantity || 1} · ${item.price?.toFixed(2)}</span>
                  </div>
                </div>
                <div className="split-item-buttons">
                  {Array.from({ length: splitCount }, (_, i) => (
                    <button
                      key={i}
                      className={`split-assign-btn ${assignedTo === i ? 'active' : ''}`}
                      style={{ 
                        background: assignedTo === i ? splitColors[i] : 'transparent',
                        borderColor: splitColors[i],
                        color: assignedTo === i ? 'white' : splitColors[i]
                      }}
                      onClick={() => toggleAssignment(index, i)}
                      data-testid={`assign-item-${index}-to-${i}`}
                    >
                      {assignedTo === i ? <Check size={14} weight="bold" /> : i + 1}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirm button */}
        <div className="split-confirm-bar">
          <button
            className="btn-split-primary"
            disabled={!allAssigned || !allSplitsHaveItems() || splitting}
            onClick={handleConfirmSplit}
            data-testid="confirm-split-btn"
          >
            {splitting ? 'Splitting...' : `Split into ${splitCount} orders`}
          </button>
          {!allAssigned && (
            <p className="split-remaining">{getUnassignedItems().length} item(s) still unassigned</p>
          )}
        </div>
      </div>
    </div>
  );
};

export { SPLIT_THRESHOLD };
export default SplitOrderModal;
