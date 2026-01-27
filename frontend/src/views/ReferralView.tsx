import React, { useState, useEffect } from 'react';
import { Home, BarChart2, CreditCard, Copy, Users, Wallet, Share2, ShieldCheck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { ModelHeader } from '../components/ModelHeader';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';

interface ReferralViewProps {
    onBack: () => void;
    userCredits: number;
}

interface PartnerStats {
    referral_code: string;
    referral_link: string;
    total_earned: number;
    available_balance: number;
    total_withdrawn: number;
    referrals_total: number;
    referrals_active: number;
    saved_card: string | null;
    saved_card_type: string | null;
    min_withdrawal: number;
    commission_percent: number;
}

type Tab = 'main' | 'stats' | 'withdraw';

const API_URL = import.meta.env.VITE_API_URL || '';

export const ReferralView: React.FC<ReferralViewProps> = ({ onBack, userCredits }) => {
    const [activeTab, setActiveTab] = useState<Tab>('main');
    const [stats, setStats] = useState<PartnerStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Withdraw State
    const [cardNumber, setCardNumber] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [withdrawSuccess, setWithdrawSuccess] = useState(false);

    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        if (!userId) {
            setError('User not found');
            setLoading(false);
            return;
        }

        try {
            const url = `${API_URL}/api/user/partner/${userId}`;
            console.log('Fetching partner stats from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Partner stats API error:', response.status, errorData);
                throw new Error(errorData.detail || `HTTP ${response.status}: Failed to fetch stats`);
            }
            
            const data = await response.json();
            console.log('Partner stats received:', data);
            
            setStats(data);
            if (data.saved_card) {
                setCardNumber(data.saved_card);
            }
            setError(null);
        } catch (e: any) {
            console.error('Failed to fetch partner stats:', e);
            setError(e.message || 'Ошибка загрузки данных');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab: Tab) => {
        if (activeTab !== tab) {
            triggerSelection();
            setActiveTab(tab);
        }
    };

    const handleCopyLink = () => {
        if (!stats) return;
        triggerHaptic('light');
        navigator.clipboard.writeText(stats.referral_link);
        triggerNotification('success');
    };

    // ========== TELEGRAM NATIVE SHARE ==========
    const handleShare = () => {
        if (!stats) return;
        triggerHaptic('medium');
        
        const shareText = `🎬 Попробуй NanoGen — AI генератор видео!\n\nПолучи 10 бесплатных кредитов по моей ссылке 👇`;
        const shareUrl = stats.referral_link;
        
        // Use Telegram's native share
        const tg = window.Telegram?.WebApp;
        if (tg) {
            // Method 1: openTelegramLink with share URL
            const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
            tg.openTelegramLink(telegramShareUrl);
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
            triggerNotification('success');
        }
    };

    const formatMoney = (amount: number) => {
        return amount.toLocaleString('ru-RU') + ' UZS';
    };

    const formatCardNumber = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 16);
        return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    const handleCardInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatCardNumber(e.target.value);
        setCardNumber(formatted);
    };

    const isValidCard = () => {
        const clean = cardNumber.replace(/\s/g, '');
        return clean.length === 16 && (clean.startsWith('8600') || clean.startsWith('9860'));
    };

    const handleWithdraw = async () => {
        if (!stats || !userId) return;
        
        const amount = parseInt(withdrawAmount.replace(/\s/g, ''));
        if (isNaN(amount) || amount < stats.min_withdrawal) return;
        if (amount > stats.available_balance) return;
        if (!isValidCard()) return;

        triggerHaptic('heavy');
        setIsWithdrawing(true);

        try {
            const response = await fetch(`${API_URL}/api/user/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    amount_uzs: amount,
                    card_number: cardNumber.replace(/\s/g, ''),
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Ошибка вывода');
            }

            setWithdrawSuccess(true);
            triggerNotification('success');
            
            // Refresh stats
            await fetchStats();
            setWithdrawAmount('');

        } catch (e: any) {
            triggerNotification('error');
            setError(e.message);
        } finally {
            setIsWithdrawing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0B0B0E] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FFD400] animate-spin" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-h-screen bg-[#0B0B0E] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-[#FF4D4D] mx-auto" />
                    <p className="text-white">{error || 'Ошибка загрузки'}</p>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'main':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Summary Card */}
                        <div className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#1e1b4b] rounded-2xl p-6 relative overflow-hidden border border-[#4c1d95]/30 shadow-xl">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD400]/5 rounded-full blur-3xl" />
                            <div className="relative z-10 space-y-4">
                                <div>
                                    <span className="text-[#a5b4fc] text-xs font-bold uppercase tracking-wider">ВАШ ДОХОД</span>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="text-4xl font-bold text-white">{formatMoney(stats.total_earned)}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#FFD400]/20 border border-[#FFD400]/40 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                        <Users size={14} className="text-[#FFD400]" />
                                        <span className="text-xs font-bold text-[#FFD400]">{stats.referrals_active} активных</span>
                                    </div>
                                    <span className="text-[10px] text-[#a5b4fc]">Всего: {stats.referrals_total}</span>
                                </div>
                            </div>
                        </div>

                        {/* Link Section */}
                        <div className="space-y-3">
                            <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Ваша партнёрская ссылка</label>
                            <div 
                                onClick={handleCopyLink}
                                className="bg-[#1A1A1F] border border-[#24242A] rounded-xl p-4 flex items-center justify-between cursor-pointer active:bg-[#24242A] transition-colors group"
                            >
                                <div className="overflow-hidden flex-1 mr-3">
                                    <div className="text-xs font-mono text-[#505055] mb-1">Telegram Bot Link</div>
                                    <div className="text-sm font-bold text-white truncate group-hover:text-[#FFD400] transition-colors">
                                        {stats.referral_link.replace('https://', '')}
                                    </div>
                                </div>
                                <Copy size={20} className="text-[#A0A0A0] shrink-0" />
                            </div>
                            
                            {/* NATIVE TELEGRAM SHARE BUTTON */}
                            <button
                                onClick={handleShare}
                                className="w-full bg-[#0088CC] hover:bg-[#0099DD] active:scale-95 transition-all rounded-xl p-4 flex items-center justify-center gap-3 text-white font-bold text-sm shadow-lg"
                            >
                                <Share2 size={18} />
                                🔗 Поделиться ссылкой
                            </button>
                        </div>

                        {/* Conditions */}
                        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-5 space-y-3">
                            <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                <ShieldCheck size={16} className="text-[#FFD400]" /> Условия программы
                            </h3>
                            <ul className="space-y-2">
                                <li className="flex items-start gap-3 text-xs text-[#A0A0A0]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFD400] mt-1.5 shrink-0" />
                                    <span><strong className="text-white">{stats.commission_percent}%</strong> с каждого пополнения баланса.</span>
                                </li>
                                <li className="flex items-start gap-3 text-xs text-[#A0A0A0]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFD400] mt-1.5 shrink-0" />
                                    <span>Доход начисляется <strong className="text-white">навсегда</strong>.</span>
                                </li>
                                <li className="flex items-start gap-3 text-xs text-[#A0A0A0]">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFD400] mt-1.5 shrink-0" />
                                    <span>Минимальный вывод: <strong className="text-white">{formatMoney(stats.min_withdrawal)}</strong></span>
                                </li>
                            </ul>
                        </div>
                    </div>
                );

            case 'stats':
                return (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-5">
                            <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-4">ФИНАНСЫ</h3>
                            
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-2 border-b border-[#24242A]">
                                    <span className="text-sm text-[#A0A0A0]">Всего заработано</span>
                                    <span className="text-sm font-bold text-white">{formatMoney(stats.total_earned)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-[#24242A]">
                                    <span className="text-sm text-[#A0A0A0]">Доступно к выводу</span>
                                    <span className="text-sm font-bold text-[#FFD400]">{formatMoney(stats.available_balance)}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-sm text-[#A0A0A0]">Выведено</span>
                                    <span className="text-sm font-bold text-[#22C55E]">{formatMoney(stats.total_withdrawn)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4 flex flex-col items-center justify-center gap-1">
                                <span className="text-3xl font-bold text-white">{stats.referrals_total}</span>
                                <span className="text-[10px] text-[#A0A0A0] uppercase font-bold">РЕФЕРАЛОВ</span>
                            </div>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-4 flex flex-col items-center justify-center gap-1">
                                <span className="text-3xl font-bold text-[#FFD400]">{stats.referrals_active}</span>
                                <span className="text-[10px] text-[#A0A0A0] uppercase font-bold">АКТИВНЫХ</span>
                            </div>
                        </div>
                        
                        <p className="text-[10px] text-[#505055] text-center">
                            * Активные — пользователи с хотя бы одним пополнением
                        </p>
                    </div>
                );

            case 'withdraw':
                if (withdrawSuccess) {
                    return (
                        <div className="space-y-6 animate-fade-in flex flex-col items-center justify-center py-10">
                            <div className="w-20 h-20 bg-[#22C55E]/10 rounded-full flex items-center justify-center">
                                <CheckCircle size={40} className="text-[#22C55E]" />
                            </div>
                            <div className="text-center space-y-2">
                                <h2 className="text-xl font-bold text-white">Заявка создана!</h2>
                                <p className="text-sm text-[#A0A0A0]">Выплата будет выполнена в течение 24 часов.</p>
                            </div>
                            <button
                                onClick={() => setWithdrawSuccess(false)}
                                className="bg-[#24242A] text-white px-6 py-3 rounded-xl font-bold text-sm"
                            >
                                Закрыть
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Balance Card */}
                        <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-6 flex flex-col items-center justify-center space-y-2 relative">
                            <div className="absolute top-4 right-4 bg-[#24242A] px-2 py-1 rounded text-[10px] text-[#A0A0A0] border border-[#2A2A30]">
                                Min: {stats.min_withdrawal.toLocaleString()}
                            </div>
                            <span className="text-[#A0A0A0] text-xs font-bold uppercase tracking-widest">БАЛАНС ПАРТНЁРА</span>
                            <div className="text-4xl font-bold text-white tracking-tight">{formatMoney(stats.available_balance)}</div>
                        </div>

                        {/* Card Input */}
                        <div className="space-y-3">
                            <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Карта для вывода</label>
                            
                            <div className="relative">
                                <input 
                                    type="tel"
                                    placeholder="8600 0000 0000 0000"
                                    value={cardNumber}
                                    onChange={handleCardInput}
                                    className={`w-full bg-[#15151A] border rounded-xl p-4 text-white placeholder-[#505055] font-mono text-lg outline-none transition-colors ${
                                        cardNumber.length > 0 
                                            ? isValidCard() 
                                                ? 'border-[#22C55E]' 
                                                : 'border-[#FF4D4D]'
                                            : 'border-[#24242A] focus:border-[#FFD400]'
                                    }`}
                                />
                                {cardNumber.length > 0 && (
                                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold ${
                                        cardNumber.startsWith('8600') ? 'text-[#22C55E]' : 
                                        cardNumber.startsWith('9860') ? 'text-[#0088CC]' : 'text-[#505055]'
                                    }`}>
                                        {cardNumber.startsWith('8600') ? 'UZCARD' : 
                                         cardNumber.startsWith('9860') ? 'HUMO' : ''}
                                    </span>
                                )}
                            </div>
                            
                            <p className="text-[10px] text-[#505055] ml-1">
                                Поддерживаются карты UZCARD (8600) и HUMO (9860)
                            </p>
                        </div>

                        {/* Withdraw Form */}
                        <div className="space-y-3">
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
                                    onClick={() => setWithdrawAmount(stats.available_balance.toString())}
                                    className="bg-[#24242A] px-4 rounded-xl text-[#FFD400] text-xs font-bold border border-[#24242A] hover:border-[#FFD400] active:scale-95 transition-all"
                                >
                                    MAX
                                </button>
                            </div>
                            
                            {error && (
                                <div className="flex items-center gap-2 text-[#FF4D4D] text-xs bg-[#2A1515] p-3 rounded-lg border border-[#441111]">
                                    <AlertCircle size={14} />
                                    <span>{error}</span>
                                </div>
                            )}
                            
                            <button
                                onClick={handleWithdraw}
                                disabled={
                                    !withdrawAmount || 
                                    parseInt(withdrawAmount) < stats.min_withdrawal || 
                                    parseInt(withdrawAmount) > stats.available_balance || 
                                    !isValidCard() ||
                                    isWithdrawing
                                }
                                className="w-full bg-[#FF4D4D] hover:bg-[#FF6B6B] disabled:bg-[#2A1515] disabled:text-[#505055] disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl px-5 py-4 flex items-center justify-center gap-2 text-white font-bold text-sm shadow-lg"
                            >
                                {isWithdrawing ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Обработка...
                                    </>
                                ) : (
                                    'Запросить вывод'
                                )}
                            </button>
                        </div>
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

            {/* Tab Bar */}
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

            {/* Content */}
            <div className="flex-1 p-5 overflow-y-auto pb-20">
                {renderContent()}
            </div>
        </div>
    );
};
