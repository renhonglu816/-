import React from 'react';
import { brandAsset } from '../utils/assets';

const poses = {
  smile: ['emotions', 1, 0], wink: ['emotions', 2, 0], surprise: ['emotions', 3, 0],
  thinking: ['emotions', 4, 0], worried: ['emotions', 0, 1], sick: ['emotions', 1, 1],
  sleepy: ['emotions', 2, 1], thanks: ['emotions', 3, 1], cheer: ['emotions', 4, 1],
  wave: ['actions', 0, 0], nod: ['actions', 1, 0], wait: ['actions', 2, 0],
  celebrate: ['actions', 3, 0], approve: ['actions', 4, 0], idea: ['actions', 0, 1],
  read: ['actions', 1, 1], search: ['actions', 2, 1], listen: ['actions', 3, 1],
  guide: ['actions', 4, 1],
};

const XiaoNuan = ({ size = 'small', pose = 'smile', className = '' }) => {
  const [sheet, column, row] = poses[pose] || poses.smile;
  return (
    <span
      className={`xiaonuan xiaonuan--${size} xiaonuan--pose-${pose} ${className}`}
      style={{ backgroundImage: `url('${brandAsset(`yaoxiaonuan-${sheet}.png`)}')`, backgroundPosition: `${column * 25}% ${row * 83.333}%` }}
      role="img"
      aria-label="药小暖"
    />
  );
};

export default XiaoNuan;
