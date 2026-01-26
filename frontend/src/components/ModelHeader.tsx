import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { BalanceDisplay } from './BalanceDisplay';
import { triggerHaptic } from '../utils/haptics';

interface ModelHeaderProps {
  modelName: string;
  subtitle?: string;
  badge?: React.ReactNode;
  userCredits: number;
  canAfford: boolean;
  onOpenProfile: () => void;
}

export const ModelHeader: React.FC<ModelHeaderProps> = ({
  modelName,
  subtitle,
  badge,
  userCredits,
  canAfford,
  onOpenProfile,
}) => {
  const handleBack = () => {
    triggerHaptic('light');
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.close();
    }
  };

  return (
    <div className="px-4 py-3 flex items-center shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
      {/* Left: Back Button */}
      <button
        onClick={handleBack}
        className="p-2 -ml-2 text-[#A0A0A0] hover:text-white transition-colors shrink-0"
        aria-label="Закрыть"
      >
        <ChevronLeft size={24} />
      </button>

      {/* Center: Model Name */}
      <div className="flex-1 flex flex-col items-center justify-center px-2">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-base text-white leading-none text-center">
            {modelName}
          </h1>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        {subtitle && (
          <span className="text-[10px] text-[#A0A0A0] font-mono mt-0.5 text-center">
            {subtitle}
          </span>
        )}
      </div>

      {/* Right: Balance */}
      <div className="shrink-0">
        <BalanceDisplay
          amount={userCredits}
          canAfford={canAfford}
          onClick={onOpenProfile}
        />
      </div>
    </div>
  );
};
