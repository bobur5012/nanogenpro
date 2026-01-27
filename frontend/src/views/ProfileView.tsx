import React, { useState, useEffect } from 'react';
import { TelegramUser } from '../types';
import { Gem, Shield, Image as ImageIcon, Video, CreditCard, Users, MessageCircle, History, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { triggerHaptic, triggerSelection } from '../utils/haptics';
import { ModelHeader } from '../components/ModelHeader';
import { userAPI, generationAPI } from '../utils/api';

interface ProfileViewProps {
  user: TelegramUser | null;
  credits: number;
  onNavigateToPayment: (amount: number, price: number) => void;
  onNavigateToReferral?: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

const PRESETS = [10, 50, 100];
const RATE = 1000; // 1 Diamond = 1000 UZS

export const ProfileView: React.FC<ProfileViewProps> = ({ user, credits, onNavigateToPayment, onNavigateToReferral, onCreditsUpdate }) => {
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [currentCredits, setCurrentCredits] = useState<number>(credits);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Load balance from API when component mounts or user changes
  useEffect(() => {
    if (user?.id) {
      loadBalance();
    }
  }, [user?.id]);

  const loadHistory = async () => {
    if (!user?.id || isLoadingHistory) return;
    
    setIsLoadingHistory(true);
    try {
      const data = await generationAPI.getHistory(user.id, 20, 0);
      setHistory(data.items || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleHistoryClick = () => {
    triggerHaptic('light');
    if (!showHistory) {
      setShowHistory(true);
      loadHistory();
    } else {
      setShowHistory(false);
    }
  };

  const loadBalance = async () => {
    if (!user?.id) return;
    
    setIsLoadingBalance(true);
    try {
      const balance = await userAPI.getBalance(user.id);
      setCurrentCredits(balance.credits);
      if (onCreditsUpdate) {
        onCreditsUpdate(balance.credits);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
      // Keep current credits on error
    } finally {
      setIsLoadingBalance(false);
    }
  };

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
                <span className="text-4xl font-bold text-white">
                  {isLoadingBalance ? '...' : currentCredits}
                </span>
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
                    <span className="text-xs font-bold">~ {Math.floor(currentCredits / 2)}</span>
                </div>
                <span className="text-[10px] text-[#505055] uppercase font-bold">IMG</span>
            </div>
            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#A0A0A0]">
                    <Video size={14} />
                    <span className="text-xs font-bold">~ {Math.floor(currentCredits / 7)}</span>
                </div>
                <span className="text-[10px] text-[#505055] uppercase font-bold">VIDEO</span>
            </div>
        </div>

        {/* 4. Quick Actions */}
        <div className="grid grid-cols-3 gap-3 mb-8">
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
                onClick={handleHistoryClick}
                className={`border p-4 rounded-xl flex flex-col items-center gap-2 hover:border-[#FFD400]/30 active:scale-95 transition-all group ${
                    showHistory 
                        ? 'bg-[#FFD400]/10 border-[#FFD400]' 
                        : 'bg-[#15151A] border-[#24242A]'
                }`}
            >
                <div className={`w-10 h-10 rounded-full bg-[#1A1A1F] flex items-center justify-center transition-colors ${
                    showHistory ? 'text-[#FFD400]' : 'text-[#A0A0A0] group-hover:text-white'
                }`}>
                    <History size={20} />
                </div>
                <span className="text-xs font-bold text-white">История</span>
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

        {/* History Section */}
        {showHistory && (
            <div className="mb-8 space-y-3">
                <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider">История генераций</h3>
                {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#FFD400] animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-8 text-center">
                        <History className="w-12 h-12 text-[#505055] mx-auto mb-3 opacity-50" />
                        <p className="text-[#A0A0A0] text-sm">Нет генераций</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {history.map((item) => (
                            <div key={item.id} className="bg-[#15151A] border border-[#24242A] rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                        <div className="text-white font-bold text-sm mb-1">{item.model_name}</div>
                                        <div className="text-[#A0A0A0] text-xs mb-2 line-clamp-2">{item.prompt}</div>
                                        <div className="flex items-center gap-3 text-[10px] text-[#505055]">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {new Date(item.created_at).toLocaleString('ru-RU')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Gem size={10} />
                                                {item.credits_charged} 💎
                                            </span>
                                        </div>
                                    </div>
                                    <div className="ml-3">
                                        {item.status === 'completed' ? (
                                            <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                                        ) : item.status === 'failed' ? (
                                            <XCircle className="w-5 h-5 text-[#FF4D4D]" />
                                        ) : (
                                            <Loader2 className="w-5 h-5 text-[#FFD400] animate-spin" />
                                        )}
                                    </div>
                                </div>
                                {item.result_url && (
                                    <a
                                        href={item.result_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#FFD400] text-xs hover:underline"
                                    >
                                        Открыть результат →
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

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
