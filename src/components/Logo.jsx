import React from 'react';

const Logo = ({ size = 'normal', full = false }) => (
  <div className={`brand-logo brand-logo--${size}${full ? ' brand-logo--full' : ''}`}>
    <img src={full ? '/brand/yaojide-logo-full.png' : '/brand/yaojide-logo.png'} alt="药记得" />
  </div>
);

export default Logo;
