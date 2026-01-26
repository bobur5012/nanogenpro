import React, { useState, useEffect } from 'react';
import { Home, BarChart2, CreditCard, Copy, Users, Wallet, ArrowRight, ShieldCheck } from 'lucide-react';
import { ModelHeader } from '../components/ModelHeader';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { ReferralStats } from '../types';
import * as Sim from '../utils/simulation';

interface ReferralViewProps {
    onBack: () => void;
    userStats: ReferralStats;
    userCredits: number;
}

type Tab = 'main' | 'stats' | 'withdraw';

const MIN_WITHDRAW = 300000; // 300 000 UZS

export const ReferralView: React.FC<ReferralViewProps> = ({ onBack, userStats, userCredits }) => {
    const [activeTab, setActiveTab] = useState<Tab>('main');
    const [localStats, setLocalStats] = useState<ReferralStats>(userStats);
    
    // Withdraw State
    const [cardNumber, setCardNumber] = useState(userStats.savedCard || '');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [isCardSaved, setIsCardSaved] = useState(!!userStats.savedCard);

    useEffect(() => {
        // Sync with SimDB on mount
        setLocalStats(Sim.getReferralStats());
    }, []);

    const handleTabChange = (tab: Tab) => {
        if (activeTab !== tab) {
            triggerSelection();
            setActiveTab(tab);
        }
    };

    const handleCopyLink = () => {
        triggerHaptic('light');
        const refLink = `https://t.me/nanogenprobot?start=ref_${window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '12345'}`;
        navigator.clipboard.writeText(refLink);
        triggerNotification('success');
    };

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('ru-RU') + ' UZS';
    };

    const handleSaveCard = () => {
        const clean = cardNumber.replace(/\s/g, '');
        if (clean.length === 16 && (clean.startsWith('8600') || clean.startsWith('9860'))) {
            triggerHaptic('medium');
            Sim.saveCard(clean);
            setIsCardSaved(true);
            setLocalStats(Sim.getReferralStats());
            triggerNotification('success');
        } else {
            triggerNotification('error');
        }
    };

    const handleWithdraw = () => {
        const amount = parseInt(withdrawAmount.replace(/\s/g, ''));
        if (isNaN(amount) || amount < MIN_WITHDRAW) return;
        if (amount > localStats.balance) return;

        triggerHaptic('heavy');
        setIsWithdrawing(true);

        setTimeout(() => {
            const success = Sim.requestWithdraw(amount);
            if (success) {
                setLocalStats(Sim.getReferralStats());
                setIsWithdrawing(false);
                setWithdrawAmount('');
                triggerNotification('success');
                
                const payload = {
                    type: 'withdraw_request',
                    payload: { amount, card: localStats.savedCard }
                };
                window.Telegram.WebApp.sendData(JSON.stringify(payload));
            } else {
                setIsWithdrawing(false);
                triggerNotification('error');
            }
        }, 1500);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'main':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Summary Card */}
                        <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-2xl p-6 relative overflow-hidden border border-[#4c1d95]/30 shadow-xl">
                            <div className="relative z-10 space-y-4">
                                <div>
                                    <span className="text-[#a5b4fc] text-xs font-bold uppercase tracking-wider">ВАШ ДОХОД</span>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="text-4xl font-bold text-white">{formatMoney(localStats.totalEarnings)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#FFD400]/20 border border-[#FFD400]/40 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                        <Users size={14} className="text-[#FFD400]" />
                                        <span className="text-xs font-bold text-[#FFD400]">{localStats.activeCount} активных</span>
                                    </div>
                                    <span className="text-[10px] text-[#a5b4fc]">Всего: {localStats.invitedCount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Link Section */}
                        <div className="space-y-2">
                            <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Ваша партнёрская ссылка</label>
                            <div 
                                onClick={handleCopyLink}
                                className="bg-[#1A1A1F] border border-[#24242A] rounded-xl p-4 flex items-center justify-between cursor-pointer active:bg-[#24242A] transition-colors group"
                            >
                                <div className="overflow-hidden">
                                    <div className="text-xs font-mono text-[#505055] mb-1">Telegram Bot Link</div>
                                    <div className="text-sm font-bold text-white truncate group-hover:text-[#FFD400] transition-colors">
                                        t.me/nanogenprobot?start=ref_{window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '12345'}
                                    </div>
                                </div>
                                <Copy size={20} className="text-[#A0A0A0]" />
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className="w-full bg-[#15151A] border border-[#24242A] rounded-xl p-4 flex items-center justify-center gap-2 text-white font-bold text-sm hover:border-[#FFD400]/50 active:scale-95 transition-all"
                            >
                                <ArrowRight size={16} /> Поделиться ссылкой
                            </button>
                        </div>

                        {/* Conditions */}
                        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-5 space-y-3">
                            <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                <ShieldCheck size={16} className="text-[#FFD400]" /> Условия программы
                            </h3>
                            <ul className="space-y-2">
                                <li className="flex items-start gap-3 text-xs text-[#A0A0A0]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#24242A] mt-1.5 shrink-0" />
                                    <span><strong className="text-white">25%</strong> с каждого пополнения баланса.</span>
                                </li>
                                <li className="flex items-start gap-3 text-xs text-[#A0A0A0]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#24242A] mt-1.5 shrink-0" />
                                    <span>Доход начисляется <strong className="text-white">навсегда</strong>.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                );

            case 'stats':
                return (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-5">
                            <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-4">СТАТИСТИКА</h3>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-center py-2 border-b border-[#24242A]">
                                    <span className="text-sm text-white">Все время</span>
                                    <span className="text-sm font-bold text-[#FFD400]">{formatMoney(localStats.totalEarnings)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4 flex flex-col items-center justify-center gap-1">
                                <span className="text-3xl font-bold text-white">{localStats.invitedCount}</span>
                                <span className="text-[10px] text-[#A0A0A0] uppercase font-bold">РЕФЕРАЛОВ</span>
                            </div>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4 flex flex-col items-center justify-center gap-1">
                                <span className="text-3xl font-bold text-[#FFD400]">{localStats.activeCount}</span>
                                <span className="text-[10px] text-[#A0A0A0] uppercase font-bold">АКТИВНЫХ</span>
                            </div>
                        </div>
                    </div>
                );

            case 'withdraw':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Balance Card */}
                        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 relative">
                            <div className="absolute top-4 right-4 bg-[#24242A] px-2 py-1 rounded text-[10px] text-[#A0A0A0] border border-[#2A2A30]">
                                Min: {MIN_WITHDRAW.toLocaleString()}
                            </div>
                            <span className="text-[#A0A0A0] text-xs font-bold uppercase tracking-widest">БАЛАНС ПАРТНЁРА</span>
                            <div className="text-4xl font-bold text-white tracking-tight">{formatMoney(localStats.balance)}</div>
                        </div>

                        {/* Card Binding */}
                        <div className="space-y-3">
                            <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Способ вывода</label>
                            
                            {!isCardSaved ? (
                                <div className="space-y-3">
                                    <input 
                                        type="tel"
                                        placeholder="8600 0000 0000 0000"
                                        value={cardNumber}
                                        onChange={(e) => setCardNumber(e.target.value.replace(/[^0-9\s]/g, ''))}
                                        className="w-full bg-[#15151A] border border-[#24242A] rounded-xl p-4 text-white placeholder-[#505055] font-mono text-lg outline-none focus:border-[#FFD400] transition-colors"
                                    />
                                    <button
                                        onClick={handleSaveCard}
                                        disabled={cardNumber.length < 16}
                                        className="w-full bg-[#FF4D4D] hover:bg-[#FF6B6B] disabled:bg-[#2A1515] disabled:text-[#505055] disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl px-5 py-4 flex items-center justify-center gap-2 text-white font-bold text-sm shadow-lg"
                                    >
                                        Привязать карту
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-[#1A1A1F] border border-[#24242A] rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#24242A] flex items-center justify-center text-white">
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <div className="text-white font-mono font-bold">
                                                {localStats.savedCard?.slice(0, 4)} **** **** {localStats.savedCard?.slice(-4)}
                                            </div>
                                            <div className="text-[10px] text-[#22C55E] font-bold mt-0.5">UZCARD / HUMO</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => { setIsCardSaved(false); setCardNumber(''); }}
                                        className="text-[#FF4D4D] text-xs font-bold px-3 py-2 hover:bg-[#2A1515] rounded-lg transition-colors"
                                    >
                                        Сменить
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Withdraw Form */}
                        {isCardSaved && (
                            <div className="space-y-3 pt-2">
                                <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Сумма вывода</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input 
                                            type="tel"
                                            value={withdrawAmount}
                                            onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="0"
                                            className="w-full bg-[#15151A] border border-[#24242A] rounded-xl p-4 text-white font-bold text-lg outline-none focus:border-[#FFD400]"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#505055] font-bold text-sm">UZS</span>
                                    </div>
                                    <button 
                                        onClick={() => setWithdrawAmount(localStats.balance.toString())}
                                        className="bg-[#24242A] px-4 rounded-xl text-[#FFD400] text-xs font-bold border border-[#24242A] hover:border-[#FFD400]"
                                    >
                                        MAX
                                    </button>
                                </div>
                                <button
                                    onClick={handleWithdraw}
                                    disabled={!withdrawAmount || parseInt(withdrawAmount) < MIN_WITHDRAW || parseInt(withdrawAmount) > localStats.balance || isWithdrawing}
                                    className="w-full bg-[#FF4D4D] hover:bg-[#FF6B6B] disabled:bg-[#2A1515] disabled:text-[#505055] disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl px-5 py-4 flex items-center justify-center gap-2 text-white font-bold text-sm shadow-lg"
                                >
                                    {isWithdrawing ? 'Обработка...' : 'Запросить вывод'}
                                </button>
                            </div>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#0B0B0E] flex flex-col animate-slide-in">
            <ModelHeader
                modelName="Партнёрка"
                userCredits={userCredits}
                canAfford={true}
                onOpenProfile={onBack}
            />

            {/* Custom Tab Bar */}
            <div className="px-4 py-3 bg-[#0B0B0E] border-b border-[#24242A]">
                <div className="flex bg-[#15151A] p-1 rounded-xl border border-[#24242A]">
                    <button 
                        onClick={() => handleTabChange('main')}
                        className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeTab === 'main' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0] hover:text-white'}`}
                    >
                        <Home size={14} /> Главная
                    </button>
                    <button 
                        onClick={() => handleTabChange('stats')}
                        className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeTab === 'stats' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0] hover:text-white'}`}
                    >
                        <BarChart2 size={14} /> Статистика
                    </button>
                    <button 
                        onClick={() => handleTabChange('withdraw')}
                        className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all ${activeTab === 'withdraw' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0] hover:text-white'}`}
                    >
                        <Wallet size={14} /> Вывод
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-5 overflow-y-auto pb-20">
                {renderContent()}
            </div>
        </div>
    );
};
