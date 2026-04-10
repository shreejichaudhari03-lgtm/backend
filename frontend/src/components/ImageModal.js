import React from 'react';
import { X } from '@phosphor-icons/react';

const ImageModal = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;

  return (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose}>
          <X size={24} weight="bold" />
        </button>
        <img src={imageUrl} alt="Full size" className="image-modal-img" />
      </div>
    </div>
  );
};

export default ImageModal;
