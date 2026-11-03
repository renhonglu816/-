import React from 'react';

const Logo = ({ size = 'normal' }) => {
  const sizeClass = size === 'large' ? 'w-24 h-24' : size === 'small' ? 'w-10 h-10' : 'w-16 h-16';

  return (
    <div className={`flex items-center gap-2 ${size === 'large' ? 'gap-4' : ''}`}>
      <img 
        src="/logo.png" 
        alt="药记得Logo" 
        className={`${sizeClass} object-contain`}
      />
      
      {/* Logo文字 */}
      <div className={`font-bold text-gray-800 ${size === 'large' ? 'text-3xl' : size === 'small' ? 'text-lg' : 'text-2xl'}`}>
        药记得
      </div>
    </div>
  );
};

export default Logo;
