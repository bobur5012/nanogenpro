import React, { useState, useRef, useEffect } from 'react';
import { Copy, Upload, Check, AlertCircle, Loader2, CreditCard, ChevronRight, ExternalLink } from 'lucide-react';
import { ModelHeader } from '../components/ModelHeader';
import { triggerHaptic, triggerNotification } from '../utils/haptics';
import { userAPI, paymentAPI } from '../utils/api';
import { openBankingApp } from '../utils/paymentLinks';

interface PaymentViewProps {
    amount: number;       // Credits to buy
    price: number;        // Price in UZS
    onBack: () => void;
    userCredits: number;
    onCreditsUpdate?: (newCredits: number) => void;
}

interface CreditPackage {
    credits: number;
    price_uzs: number;
    discount: number;
}

interface CardInfo {
    number: string;
    holder: string;
    type: string;
}

// UZCARD Logo SVG
const UzcardLogo = () => (
    <svg width="60" height="20" viewBox="0 0 120 40" fill="none">
        <rect width="120" height="40" rx="4" fill="#1E40AF" />
        <text x="10" y="28" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">UZCARD</text>
    </svg>
);

export const PaymentView: React.FC<PaymentViewProps> = ({ amount: initialAmount, price: initialPrice, onBack, userCredits, onCreditsUpdate }) => {
    const [packages, setPackages] = useState<CreditPackage[]>([]);
    const [card, setCard] = useState<CardInfo | null>(null);
    const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

    useEffect(() => {
        fetchPackages();
    }, []);

    const fetchPackages = async () => {
        try {
            const data = await userAPI.getPackages();
            setPackages(data.packages);
            setCard(data.card);

            // Select matching or first package
            if (initialAmount && initialPrice) {
                const match = data.packages.find((p: CreditPackage) => p.credits === initialAmount);
                setSelectedPackage(match || data.packages[0]);
            } else {
                setSelectedPackage(data.packages[0]);
            }
        } catch (e) {
            console.error('Failed to fetch packages:', e);
            // Fallback packages
            setPackages([
                { credits: 100, price_uzs: 50000, discount: 0 },
                { credits: 500, price_uzs: 225000, discount: 10 },
                { credits: 1000, price_uzs: 400000, discount: 20 },
                { credits: 5000, price_uzs: 1750000, discount: 30 },
            ]);
            setCard({
                number: "8600 3304 8588 5154",
                holder: "Botirov Bobur",
                type: "UZCARD"
            });
            setSelectedPackage({ credits: 100, price_uzs: 50000, discount: 0 });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!card) return;
        triggerHaptic('light');
        navigator.clipboard.writeText(card.number.replace(/\s/g, ''));
        setCopied(true);
        triggerNotification('success');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleUploadClick = () => {
        triggerHaptic('light');
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                triggerNotification('error');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    triggerHaptic('medium');
                    setScreenshot(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!screenshot || !selectedPackage || !userId) return;

        setIsSubmitting(true);
        triggerHaptic('medium');

        try {
            // Extract base64 data (remove data:image/...;base64, prefix if present)
            const base64Data = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot;

            const result = await paymentAPI.topup({
                user_id: userId,
                credits: selectedPackage.credits,
                amount_uzs: selectedPackage.price_uzs,
                screenshot_base64: base64Data,
            });

            setSubmitSuccess(true);
            triggerNotification('success');

            // Note: Balance will be updated after admin approval, not immediately
            // But we can still call the callback if needed for UI consistency

        } catch (e: any) {
            triggerNotification('error');
            console.error('Topup failed:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0B0B0E] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#FFD400] animate-spin" />
            </div>
        );
    }

    if (submitSuccess) {
        return (
            <div className="min-h-screen bg-[#0B0B0E] flex flex-col">
                <ModelHeader
                    modelName="Оплата"
                    userCredits={userCredits}
                    canAfford={true}
                    onOpenProfile={onBack}
                />
                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                    <div className="w-20 h-20 bg-[#22C55E]/10 rounded-full flex items-center justify-center">
                        <Check size={40} className="text-[#22C55E]" />
                    </div>
                    <div className="text-center space-y-2">
                        <h2 className="text-xl font-bold text-white">Заявка отправлена!</h2>
                        <p className="text-sm text-[#A0A0A0]">
                            Ожидайте подтверждения оператором.<br />
                            Обычно это занимает 5-30 минут.
                        </p>
                    </div>
                    <button
                        onClick={onBack}
                        className="bg-[#FFD400] text-black px-8 py-3 rounded-xl font-bold text-sm active:scale-95 transition-transform"
                    >
                        Вернуться в профиль
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0B0E] flex flex-col animate-slide-in">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

            <ModelHeader
                modelName="Пополнение"
                userCredits={userCredits}
                canAfford={true}
                onOpenProfile={onBack}
            />

            <div className="flex-1 p-5 space-y-6 overflow-y-auto pb-24">

                {/* 1. Package Selection */}
                <div className="space-y-3">
                    <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Выберите пакет</label>
                    <div className="grid grid-cols-2 gap-3">
                        {packages.map((pkg) => (
                            <button
                                key={pkg.credits}
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedPackage(pkg);
                                }}
                                className={`relative p-4 rounded-xl border-2 transition-all active:scale-95 ${selectedPackage?.credits === pkg.credits
                                        ? 'border-[#FFD400] bg-[#FFD400]/5'
                                        : 'border-[#24242A] bg-[#15151A] hover:border-[#3A3A40]'
                                    }`}
                            >
                                {pkg.discount > 0 && (
                                    <div className="absolute -top-2 -right-2 bg-[#22C55E] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        -{pkg.discount}%
                                    </div>
                                )}
                                <div className="text-2xl font-bold text-white">{pkg.credits}</div>
                                <div className="text-[10px] text-[#A0A0A0] uppercase">кредитов</div>
                                <div className="text-sm font-bold text-[#FFD400] mt-2">
                                    {pkg.price_uzs.toLocaleString()} UZS
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. Payment Card with Fast Actions */}
                {card && (
                    <div className="space-y-4">
                        <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Оплата</label>

                        {/* Card Design */}
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E40AF] via-[#1E3A8A] to-[#172554] p-5 shadow-xl group" onClick={handleCopy}>
                            {/* ... existing card visuals ... */}
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl transform translate-x-20 -translate-y-20" />
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl transform -translate-x-16 translate-y-16" />
                            </div>

                            <div className="relative z-10 space-y-4">
                                <div className="flex justify-between items-start">
                                    <UzcardLogo />
                                    <div className="text-white/60 text-[10px] font-mono">{card.type}</div>
                                </div>
                                <div className="pt-4 flex items-center gap-3">
                                    <span className="text-2xl font-mono text-white tracking-widest">{card.number}</span>
                                    <div className={`p-2 rounded-lg transition-all ${copied ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-white/10 text-white'}`}>
                                        {copied ? <Check size={18} /> : <Copy size={18} />}
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Получатель</div>
                                    <div className="text-white font-bold tracking-wide">{card.holder}</div>
                                </div>
                            </div>
                        </div>

                        {/* Fast Pay Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { handleCopy(); openBankingApp('click'); }}
                                className="bg-[#007AFF]/10 hover:bg-[#007AFF]/20 border border-[#007AFF]/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Click_logo.png/1200px-Click_logo.png" alt="Click" className="h-5" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                                <span className="text-[#007AFF] font-bold text-sm">Открыть Click</span>
                                <ExternalLink size={14} className="text-[#007AFF]" />
                            </button>
                            <button
                                onClick={() => { handleCopy(); openBankingApp('payme'); }}
                                className="bg-[#00CCCC]/10 hover:bg-[#00CCCC]/20 border border-[#00CCCC]/30 p-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <span className="text-[#00CCCC] font-bold text-sm">Открыть Payme</span>
                                <ExternalLink size={14} className="text-[#00CCCC]" />
                            </button>
                        </div>

                        <p className="text-[10px] text-[#505055] text-center">
                            *Нажмите, чтобы скопировать карту и открыть приложение
                        </p>
                    </div>
                )}

                {/* 3. Screenshot Upload */}
                <div className="space-y-3">
                    <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Скриншот чека</label>
                    <div
                        onClick={handleUploadClick}
                        className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-[0.98] ${screenshot
                                ? 'border-[#22C55E] bg-[#22C55E]/5 p-3'
                                : 'border-[#24242A] bg-[#15151A] hover:bg-[#1A1A1F] hover:border-[#3A3A40] p-8'
                            }`}
                    >
                        {screenshot ? (
                            <div className="relative w-full">
                                <img
                                    src={screenshot}
                                    alt="Чек"
                                    className="w-full h-48 object-cover rounded-xl"
                                />
                                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                    <span className="text-white text-sm font-bold bg-black/50 px-4 py-2 rounded-lg">
                                        Заменить
                                    </span>
                                </div>
                                <div className="absolute top-2 right-2 bg-[#22C55E] text-white p-1.5 rounded-full">
                                    <Check size={16} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-14 h-14 rounded-full bg-[#24242A] flex items-center justify-center text-white mb-3">
                                    <Upload size={24} />
                                </div>
                                <span className="text-sm font-bold text-white">Загрузить скриншот</span>
                                <span className="text-[10px] text-[#505055] mt-1">После перевода загрузите скриншот чека</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Summary */}
                {selectedPackage && (
                    <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-[#A0A0A0]">Итого к оплате:</span>
                            <div className="text-right">
                                <div className="text-xl font-bold text-white">
                                    {selectedPackage.price_uzs.toLocaleString()} UZS
                                </div>
                                <div className="text-xs text-[#FFD400]">
                                    +{selectedPackage.credits} кредитов
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-5 border-t border-[#24242A] bg-[#0B0B0E]">
                <button
                    onClick={handleSubmit}
                    disabled={!screenshot || isSubmitting}
                    className="w-full bg-[#FF4D4D] hover:bg-[#FF6B6B] disabled:bg-[#2A1515] disabled:text-[#505055] disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl px-5 py-4 flex items-center justify-center gap-2 text-white font-bold text-sm shadow-lg"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            Отправка...
                        </>
                    ) : (
                        <>
                            <ChevronRight size={18} />
                            Отправить на проверку
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
