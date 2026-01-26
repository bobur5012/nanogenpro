import React, { useState } from 'react';
import { TelegramUser } from '../types';
import { Gem, Shield, Image as ImageIcon, Video, CreditCard, Users, MessageCircle } from 'lucide-react';
import { triggerHaptic, triggerSelection } from '../utils/haptics';
import { ModelHeader } from '../components/ModelHeader';

interface ProfileViewProps {
  user: TelegramUser | null;
  credits: number;
  onNavigateToPayment: (amount: number, price: number) => void;
  onNavigateToReferral?: () => void;
}

const PRESETS = [10, 50, 100];
const RATE = 1000; // 1 Diamond = 1000 UZS

export const ProfileView: React.FC<ProfileViewProps> = ({ user, credits, onNavigateToPayment, onNavigateToReferral }) => {
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const initials = user?.first_name ? user.first_name.charAt(0).toUpperCase() : '?';

  const handlePreset = (amount: number) => {
      triggerSelection();
      setSelectedPreset(amount);
      setCustomAmount('');
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      setCustomAmount(val);
      setSelectedPreset(null);
  };

  const handleReferralClick = () => {
      if (onNavigateToReferral) {
          triggerHaptic('light');
          onNavigateToReferral();
      }
  };

  const currentAmount = selectedPreset || (customAmount ? parseInt(customAmount) : 0);
  const currentPrice = currentAmount * RATE;

  const handleBuy = () => {
      if (currentAmount > 0) {
          triggerHaptic('medium');
          onNavigateToPayment(currentAmount, currentPrice);
      }
  };

  const handleSupport = () => {
      triggerHaptic('light');
      window.open('https://t.me/botiroffb', '_blank');
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] flex flex-col animate-fade-in">
      <ModelHeader
        modelName="Профиль"
        userCredits={credits}
        canAfford={true}
        onOpenProfile={() => {}}
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24">
        {/* 1. User Card - Green Style */}
        <div className="bg-gradient-to-br from-[#1a4d3a] to-[#0d2e1f] rounded-2xl p-4 flex items-center gap-4 shadow-lg">
          <div className="w-14 h-14 rounded-xl bg-[#0d2e1f] border-2 border-[#2d7a5a] flex items-center justify-center overflow-hidden shrink-0">
            {user?.photo_url ? (
              <img src={user.photo_url} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-white">{initials}</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <h1 className="text-lg font-bold text-white truncate">@{user?.username || user?.first_name || 'User'}</h1>
            <div className="mt-1.5">
              <span className="bg-[#0d2e1f]/60 border border-[#2d7a5a]/50 text-white text-[11px] px-2.5 py-1 rounded-lg font-mono">
                ID: {user?.id || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Balance Card - Blue/Purple Style */}
        <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-2xl p-6 shadow-xl border border-[#4c1d95]/30">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-[#a5b4fc] text-xs font-bold uppercase tracking-wider mb-2">БАЛАНС</div>
              <div className="flex items-center gap-2">
                <span className="text-4xl font-bold text-white">{credits}</span>
                <Gem size={28} className="text-[#3b82f6]" fill="#3b82f6" fillOpacity={0.9} />
              </div>
            </div>
            <button
              onClick={() => document.getElementById('topup-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-[#FFD400] hover:bg-[#FFE066] active:scale-95 transition-all rounded-xl px-5 py-3 flex items-center gap-2 shadow-lg shadow-yellow-500/30"
            >
              <CreditCard size={18} className="text-black" />
              <span className="text-black font-bold text-sm">Пополнить</span>
            </button>
          </div>
        </div>

        {/* 3. Usage Estimation (Compact) */}
        <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#A0A0A0]">
                    <ImageIcon size={14} />
                    <span className="text-xs font-bold">~ {Math.floor(credits / 2)}</span>
                </div>
                <span className="text-[10px] text-[#505055] uppercase font-bold">IMG</span>
            </div>
            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#A0A0A0]">
                    <Video size={14} />
                    <span className="text-xs font-bold">~ {Math.floor(credits / 7)}</span>
                </div>
                <span className="text-[10px] text-[#505055] uppercase font-bold">VIDEO</span>
            </div>
        </div>

        {/* 4. Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-8">
            <button 
                onClick={handleReferralClick}
                className="bg-[#15151A] border border-[#24242A] p-4 rounded-xl flex flex-col items-center gap-2 hover:border-[#FFD400]/30 active:scale-95 transition-all group"
            >
                <div className="w-10 h-10 rounded-full bg-[#1A1A1F] flex items-center justify-center text-[#FFD400] group-hover:scale-110 transition-transform">
                    <Users size={20} />
                </div>
                <span className="text-xs font-bold text-white">Партнёрка</span>
            </button>

            <button 
                onClick={handleSupport}
                className="bg-[#15151A] border border-[#24242A] p-4 rounded-xl flex flex-col items-center gap-2 hover:border-[#FFD400]/30 active:scale-95 transition-all group"
            >
                <div className="w-10 h-10 rounded-full bg-[#1A1A1F] flex items-center justify-center text-[#A0A0A0] group-hover:text-white transition-colors">
                    <MessageCircle size={20} />
                </div>
                <span className="text-xs font-bold text-white">Поддержка</span>
            </button>
        </div>

        {/* 5. Top Up Section (Anchored) */}
        <div id="topup-section" className="space-y-4 pt-4 border-t border-[#24242A]">
            <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider text-center">
                КУПИТЬ КРЕДИТЫ
            </h3>
            
            {/* Presets */}
            <div className="grid grid-cols-3 gap-3">
                {PRESETS.map(amount => (
                    <button
                        key={amount}
                        onClick={() => handlePreset(amount)}
                        className={`py-4 rounded-xl border-2 font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                            selectedPreset === amount 
                            ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20' 
                            : 'bg-[#15151A] border-[#24242A] text-white hover:border-[#FFD400]/50'
                        }`}
                    >
                        <span className="text-xl leading-none font-bold">
                            {amount}
                        </span>
                    </button>
                ))}
            </div>

            {/* Custom Input */}
            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex items-center px-4">
                <span className="text-sm font-bold text-[#505055] mr-3">Ввести:</span>
                <input 
                    type="tel"
                    value={customAmount}
                    onChange={handleCustomChange}
                    placeholder="0"
                    className="bg-transparent border-none outline-none text-white font-bold w-full h-10 placeholder-[#2A2A30] text-center"
                />
            </div>

            {/* Pay Button - Bright Red */}
            <button
                onClick={handleBuy}
                disabled={currentAmount === 0}
                className="w-full bg-[#FF4D4D] hover:bg-[#FF6B6B] disabled:bg-[#2A1515] disabled:text-[#505055] disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl px-5 py-4 flex items-center justify-between gap-2 text-white font-bold text-sm shadow-lg mt-2"
            >
                <span className="flex items-center gap-2">
                    <CreditCard size={18} />
                    ОПЛАТИТЬ {currentAmount > 0 ? `${currentAmount}` : ''}
                </span>
                <span className="font-mono bg-black/20 px-2 py-1 rounded text-sm">
                    {currentAmount > 0 ? (currentPrice).toLocaleString() : 0} UZS
                </span>
            </button>
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center flex justify-center">
            <div className="flex items-center gap-2 text-[#2A2A30] text-[10px] uppercase font-bold tracking-widest">
                <Shield size={10} /> Secure Telegram Pay
            </div>
        </div>
      </div>
    </div>
  );
};
