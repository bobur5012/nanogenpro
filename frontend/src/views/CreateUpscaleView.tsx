import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Trash2, Zap, AlertCircle, Coins, ArrowUpCircle, CheckCircle } from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateUpscaleViewProps {
    userCredits: number;
    onOpenProfile: () => void;
    onCreditsUpdate?: (newCredits: number) => void;
}

const UPSCALE_PRICE = 5; // 5 credits per upscale

export const CreateUpscaleView: React.FC<CreateUpscaleViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    const [image, setImage] = useState<string | null>(null);
    const [scale, setScale] = useState<2 | 4>(2);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const canAfford = userCredits >= UPSCALE_PRICE;
    const isValid = !!image;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setImage(e.target.result as string);
                    triggerHaptic('medium');
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadClick = () => {
        triggerHaptic('light');
        fileInputRef.current?.click();
    };

    const clearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('rigid');
        setImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleScaleChange = (s: 2 | 4) => {
        if (scale !== s) {
            triggerSelection();
            setScale(s);
        }
    };

    const handleSubmit = async () => {
        if (!canAfford || !isValid || isSubmitting || !image) return;

        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        triggerHaptic('medium');

        try {
            const userData = getTelegramUserData();
            if (!userData) {
                throw new Error('Telegram данные не найдены');
            }

            await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'upscale',
                model_name: 'NanoScale Upscaler',
                generation_type: 'image',
                prompt: `Upscale x${scale}`,
                image_base64: image,
                parameters: {
                    scale: scale,
                },
                idempotency_key: generateIdempotencyKey(),
            });

            setSuccess(true);
            triggerNotification('success');

            if (onCreditsUpdate) {
                // Optimistic update or fetch new balance
                onCreditsUpdate(userCredits - UPSCALE_PRICE);
            }

            setTimeout(() => {
                onOpenProfile();
            }, 2000);

        } catch (err: any) {
            console.error('Upscale failed:', err);
            setError(err.message || 'Ошибка апскейла');
            triggerNotification('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        NanoScale <span className="text-[#FFD400]">Upscaler</span>
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono block mt-1">
                        Улучшение качества изображений
                    </span>
                </div>
                <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
                <div className="space-y-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*"
                        className="hidden"
                    />

                    {!image ? (
                        <div
                            onClick={handleUploadClick}
                            className="w-full h-64 border-2 border-dashed border-[#24242A] bg-[#15151A] rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all"
                        >
                            <div className="w-14 h-14 rounded-full bg-[#1A1A22] flex items-center justify-center">
                                <Upload size={24} className="text-[#A0A0A0]" />
                            </div>
                            <div className="text-center">
                                <span className="block text-sm font-bold text-white">Загрузить фото</span>
                                <span className="text-[10px] text-[#505055]">для улучшения</span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-[#24242A] group bg-[#15151A]">
                            <img src={image} alt="Preview" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3">
                                <button
                                    onClick={handleUploadClick}
                                    className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold backdrop-blur-md border border-white/10"
                                >
                                    Заменить
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Масштабирование</h3>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleScaleChange(2)}
                            className={`flex-1 p-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${scale === 2
                                    ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20'
                                    : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                }`}
                        >
                            <span className="text-2xl font-bold">2x</span>
                            <span className="text-[10px] font-bold opacity-60">HD</span>
                        </button>
                        <button
                            onClick={() => handleScaleChange(4)}
                            className={`flex-1 p-4 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${scale === 4
                                    ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20'
                                    : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                }`}
                        >
                            <span className="text-2xl font-bold">4x</span>
                            <span className="text-[10px] font-bold opacity-60">Ultra HD</span>
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-[#2A1515] border border-[#441111] rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle size={20} className="text-[#FF4D4D] shrink-0 mt-0.5" />
                        <p className="text-[#FF4D4D] text-xs">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="bg-[#1A4D3A] border border-[#2d7a5a] rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle size={20} className="text-[#22C55E] shrink-0 mt-0.5" />
                        <p className="text-[#22C55E] text-xs font-bold">Улучшение запущено! Результат скоро будет.</p>
                    </div>
                )}
            </div>

            <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
                <Button
                    fullWidth
                    onClick={handleSubmit}
                    disabled={!isValid || !canAfford}
                    loading={isSubmitting}
                >
                    <div className="flex items-center gap-2 justify-center">
                        <ArrowUpCircle size={18} className={canAfford && isValid ? "text-black" : "text-[#A0A0A0]"} />
                        <span>{canAfford ? `Улучшить за ${UPSCALE_PRICE} 💎` : 'Пополнить баланс'}</span>
                    </div>
                </Button>
            </div>
        </div>
    );
};
