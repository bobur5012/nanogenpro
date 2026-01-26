import React from 'react';
import { Gem } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface BalanceDisplayProps {
  amount: number;
  canAfford?: boolean;
  onClick?: () => void;
}

export const BalanceDisplay: React.FC<BalanceDisplayProps> = ({ amount, canAfford = true, onClick }) => {
  const handleClick = () => {
      if (onClick) {
          triggerHaptic('light');
          onClick();
      }
  };

  return (
    <div 
        onClick={handleClick}
        className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95 hover:bg-[#1A1A1F] ${canAfford ? 'bg-[#15151A] border-[#24242A] text-white' : 'bg-[#2A1515] border-[#FF4D4D] text-[#FF4D4D]'}`}
    >
        <Gem size={14} className={canAfford ? 'text-[#3B82F6]' : 'text-[#FF4D4D]'} fill={canAfford ? "#3B82F6" : "#FF4D4D"} fillOpacity={0.2} />
        <span className="text-sm font-bold tracking-wide">{amount}</span>
    </div>
  );
};
