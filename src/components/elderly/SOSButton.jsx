import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const SOSButton = ({ onTrigger, variant = 'floating' }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);

  const handleTouchStart = (e) => {
    e.preventDefault();
    setIsPressed(true);
    
    const timer = setTimeout(() => {
      onTrigger();
      setIsPressed(false);
    }, 1000);
    
    setPressTimer(timer);
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleClick = () => {
    onTrigger();
  };

  return (
    <button
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onClick={handleClick}
      aria-label="SOS 一键求救"
      title="SOS 一键求救"
      className={`${variant === 'header' ? 'sos-button sos-button--header' : 'fixed bottom-28 right-4 sm:bottom-32 sm:right-8 w-16 h-16 sm:w-20 sm:h-20'} rounded-full flex items-center justify-center z-50 transition-all duration-200 sos-neon ${
        isPressed 
          ? 'scale-110' 
          : 'hover:scale-105 active:scale-95'
      }`}
    >
      <div className="text-center">
        <AlertTriangle size={28} className="text-white mx-auto mb-1" />
        <span className="text-white text-xs font-bold">SOS</span>
      </div>
      {isPressed && (
        <div className="absolute inset-0 rounded-full border-4 border-white animate-ping opacity-50"></div>
      )}
    </button>
  );
};

export default SOSButton;
