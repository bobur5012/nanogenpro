import React, { useState, useRef } from 'react';
import { Copy, CreditCard, Upload, Check, AlertCircle } from 'lucide-react';
import { ModelHeader } from '../components/ModelHeader';
import { triggerHaptic, triggerNotification } from '../utils/haptics';

interface PaymentViewProps {
    amount: number;
    price: number;
    onBack: () => void;
    userCredits: number;
}

const CARD_NUMBER = "8600 0000 0000 0000";
const CARD_HOLDER = "NANOGEN SERVICE";

export const PaymentView: React.FC<PaymentViewProps> = ({ amount, price, onBack, userCredits }) => {
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCopy = () => {
        triggerHaptic('light');
        navigator.clipboard.writeText(CARD_NUMBER.replace(/\s/g, ''));
        triggerNotification('success');
    };

    const handleUploadClick = () => {
        triggerHaptic('light');
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
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

    const handleSubmit = () => {
        if (!screenshot) return;
        
        setIsSubmitting(true);
        triggerHaptic('medium');

        setTimeout(() => {
            const payload = {
                type: 'payment_confirm',
                payload: {
                    amount,
                    screenshot: 'base64_screenshot_truncated'
                }
            };
            window.Telegram.WebApp.sendData(JSON.stringify(payload));
        }, 1500);
    };

    return (
        <div className="min-h-screen bg-[#0B0B0E] flex flex-col animate-slide-in">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

            <ModelHeader
                modelName="Оплата"
                userCredits={userCredits}
                canAfford={true}
                onOpenProfile={onBack}
            />

            <div className="flex-1 p-5 space-y-6 overflow-y-auto">
                
                {/* 1. Summary */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-5 text-center space-y-1">
                    <span className="text-[#A0A0A0] text-xs font-bold uppercase">Сумма к оплате</span>
                    <div className="text-3xl font-bold text-white">{price.toLocaleString()} UZS</div>
                    <div className="text-[#FFD400] text-sm font-bold mt-1">Пополнение на {amount} кредитов</div>
                </div>

                {/* 2. Card Details */}
                <div className="space-y-2">
                    <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Реквизиты карты</label>
                    <div className="bg-gradient-to-br from-[#24242A] to-[#1A1A1F] rounded-2xl p-5 border border-[#24242A] relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CreditCard size={100} />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div>
                                <span className="text-[#505055] text-[10px] font-bold uppercase block mb-1">Номер карты (UZCARD / HUMO)</span>
                                <div className="flex items-center gap-3">
                                    <span className="text-xl font-mono text-white tracking-wider">{CARD_NUMBER}</span>
                                    <button onClick={handleCopy} className="text-[#FFD400] p-1 active:scale-90 transition-transform">
                                        <Copy size={18} />
                                    </button>
                                </div>
                            </div>
                            <div>
                                <span className="text-[#505055] text-[10px] font-bold uppercase block mb-1">Получатель</span>
                                <span className="text-sm font-bold text-white tracking-widest">{CARD_HOLDER}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2 bg-[#2A1515] p-3 rounded-xl border border-[#441111]">
                        <AlertCircle size={16} className="text-[#FF4D4D] shrink-0 mt-0.5" />
                        <p className="text-[10px] text-[#FF4D4D] leading-tight">
                            Внимание! В комментарии к платежу обязательно укажите ваш ID: 
                            <span className="font-mono bg-[#441111] px-1 rounded ml-1 text-white">{window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 'N/A'}</span>
                        </p>
                    </div>
                </div>

                {/* 3. Confirmation */}
                <div className="space-y-2">
                    <label className="text-[#A0A0A0] text-xs font-bold uppercase ml-1">Подтверждение</label>
                    <div 
                        onClick={handleUploadClick}
                        className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${screenshot ? 'border-[#22C55E] bg-[#22C55E]/5' : 'border-[#24242A] bg-[#15151A] hover:bg-[#1A1A1F]'}`}
                    >
                        {screenshot ? (
                            <div className="flex flex-col items-center gap-1 text-[#22C55E]">
                                <Check size={32} />
                                <span className="text-xs font-bold">Скриншот загружен</span>
                                <span className="text-[10px] opacity-70">Нажмите, чтобы заменить</span>
                            </div>
                        ) : (
                            <>
                                <div className="w-10 h-10 rounded-full bg-[#24242A] flex items-center justify-center text-white">
                                    <Upload size={20} />
                                </div>
                                <span className="text-xs font-bold text-[#A0A0A0]">Загрузить скриншот чека</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
                <button
                    onClick={handleSubmit}
                    disabled={!screenshot || isSubmitting}
                    className="w-full bg-[#FF4D4D] hover:bg-[#FF6B6B] disabled:bg-[#2A1515] disabled:text-[#505055] disabled:cursor-not-allowed active:scale-95 transition-all rounded-xl px-5 py-4 flex items-center justify-center gap-2 text-white font-bold text-sm shadow-lg"
                >
                    {isSubmitting ? 'Отправка...' : 'Отправить на проверку'}
                </button>
            </div>
        </div>
    );
};
