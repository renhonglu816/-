import React from 'react';
import { brandAsset } from '../utils/assets';

const Logo = ({ size = 'normal', full = false }) => (
  <div className={`brand-logo brand-logo--${size}${full ? ' brand-logo--full' : ''}`}>
    <img src={brandAsset(full ? 'yaojide-logo-full.png' : 'yaojide-logo.png')} alt="药记得" />
  </div>
);

export default Logo;
