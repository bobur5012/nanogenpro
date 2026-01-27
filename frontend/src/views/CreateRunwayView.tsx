import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Video, Image as ImageIcon, Zap, Monitor, Smartphone, Square, 
    Upload, Trash2, Sliders, AlertCircle, Coins, Clock, Film, 
    Type, Lock, Info, CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateRunwayViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

type RunwayMode = 'text' | 'image';

const MODES = [
    { id: 'text', label: 'Text → Video', icon: Type },
    { id: 'image', label: 'Image → Video', icon: ImageIcon },
];

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '4:3', label: '4:3', icon: Monitor },
  { id: '3:4', label: '3:4', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
  { id: '21:9', label: '21:9', icon: Film },
];

// Simulation pricing: $0.05 per sec
const PRICE_PER_SEC = 0.05;
const CREDITS_PER_DOLLAR = 100;

export const CreateRunwayView: React.FC<CreateRunwayViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    // State
    const [mode, setMode] = useState<RunwayMode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [duration, setDuration] = useState<5 | 10>(5);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    // Advanced
    const [seed, setSeed] = useState<string>('');
    const [watermark, setWatermark] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: Runway Gen-4 Turbo");
    }, []);

    useEffect(() => {
        const modeLabel = MODES.find(m => m.id === mode)?.label || mode;
        console.log(`MODE_SELECTED: ${modeLabel}`);
    }, [mode]);

    // Handlers
    const handleModeChange = (m: RunwayMode) => {
        if (mode !== m) {
            triggerSelection();
            setMode(m);
        }
    };

    const handleUpload = () => {
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
                    setImage(ev.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const clearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('rigid');
        setImage(null);
    };

    // Calculation
    const costUSD = duration * PRICE_PER_SEC;
    const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
    const remainingCredits = userCredits - costCredits;
    const canAfford = userCredits >= costCredits;

    const isValid = useMemo(() => {
        if (mode === 'image' && !image) return false;
        return prompt.trim().length > 0;
    }, [mode, prompt, image]);

    const handleSubmit = async () => {
        if (!canAfford || !isValid || isSubmitting) {
            triggerNotification('error');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setSuccess(false);
        triggerHaptic('medium');

        try {
            const userData = getTelegramUserData();
            if (!userData) {
                throw new Error('Telegram данные не найдены');
            }

            // Convert image to URL if present
            let imageUrl: string | undefined;
            if (image && mode === 'image') {
                // For now, use the base64 data URL directly
                // In production, you might want to upload to a CDN first
                imageUrl = image;
            }

            const result = await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'runway/gen4-turbo',
                model_name: 'Runway Gen-4 Turbo',
                generation_type: 'video',
                prompt: prompt.trim(),
                image_base64: imageUrl,
                parameters: {
                    mode: mode,
                    duration: `${duration}s`,
                    aspect_ratio: aspectRatio,
                    seed: seed || undefined,
                    watermark: watermark,
                },
                idempotency_key: generateIdempotencyKey(),
            });

            setSuccess(true);
            triggerNotification('success');

            // Update balance if provided
            if (result.new_balance !== undefined && onCreditsUpdate) {
                onCreditsUpdate(result.new_balance);
            }

            // Return to profile after 2 seconds
            setTimeout(() => {
                onOpenProfile();
            }, 2000);

        } catch (err: any) {
            console.error('Generation failed:', err);
            let errorMessage = 'Не удалось запустить генерацию. Попробуйте позже.';
            
            // Parse structured error if available
            if (err.message) {
                try {
                    const errorData = JSON.parse(err.message);
                    errorMessage = errorData.message || errorData.detail || errorMessage;
                } catch {
                    errorMessage = err.message || errorMessage;
                }
            }
            
            setError(errorMessage);
            triggerNotification('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#0B0B0E] animate-fade-in">
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
            />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        Runway Gen-4 Turbo
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Zap size={10} className="text-yellow-400" /> Быстрая генерация видео
                    </span>
                    <div className="mt-1 flex">
                        <span className="bg-[#15151A] border border-[#24242A] text-white text-[9px] px-1.5 py-0.5 rounded font-bold">10 сек за ~30 сек</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
                    <span className="text-[9px] text-[#505055] font-mono font-bold">
                        ${PRICE_PER_SEC}/s
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
                
                {/* Mode Selector */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Режим генерации</label>
                    <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                        {MODES.map((m) => {
                            const isActive = mode === m.id;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => handleModeChange(m.id as RunwayMode)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                                        isActive 
                                        ? 'bg-[#24242A] text-white shadow-sm' 
                                        : 'text-[#A0A0A0] hover:text-white'
                                    }`}
                                >
                                    <Icon size={16} />
                                    <span className="text-xs font-bold">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Global Settings */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Параметры</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Duration */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Длительность</label>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                                <button onClick={() => {triggerSelection(); setDuration(5)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>5 сек</button>
                                <button onClick={() => {triggerSelection(); setDuration(10)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>10 сек</button>
                            </div>
                        </div>

                         {/* Ratio */}
                         <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                             <div className="relative">
                                 <select 
                                    value={aspectRatio} 
                                    onChange={(e) => {triggerSelection(); setAspectRatio(e.target.value)}}
                                    className="w-full h-[34px] bg-[#15151A] border border-[#24242A] rounded-xl text-xs font-bold text-white px-3 appearance-none focus:outline-none focus:border-[#FFD400]"
                                 >
                                    {RATIOS.map(r => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                 </select>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Specific Inputs */}
                <div className="space-y-4 animate-fade-in">
                    
                    {/* Image Upload */}
                    {mode === 'image' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Первый кадр</label>
                            {!image ? (
                                <div 
                                    onClick={handleUpload}
                                    className="w-full h-32 border-2 border-dashed border-[#24242A] bg-[#15151A] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all"
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A22] flex items-center justify-center border border-[#24242A]">
                                        <Upload size={14} className="text-[#A0A0A0]" />
                                    </div>
                                    <span className="text-xs font-bold text-[#505055]">Загрузить изображение</span>
                                </div>
                            ) : (
                                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-[#24242A] group bg-[#15151A]">
                                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                                        <button onClick={handleUpload} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Заменить</button>
                                        <button onClick={clearImage} className="bg-[#2A1515] text-[#FF4D4D] p-1.5 rounded-lg border border-[#441111]"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )}
                            <p className="text-[9px] text-[#505055] px-1">Изображение используется как первый кадр видео</p>
                        </div>
                    )}

                    {/* Prompt Text */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                            Текстовый Промпт (Обязательно)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={1000}
                            placeholder="Подробно опишите сцену, движение, стиль и атмосферу."
                            className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                        <div className="flex justify-end px-1">
                            <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/1000</span>
                        </div>
                    </div>

                    {/* Advanced Options */}
                    <div className="space-y-4 bg-[#15151A] border border-[#24242A] p-3 rounded-xl">
                        <h4 className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wider flex items-center gap-1">
                            <Sliders size={10} /> Дополнительно
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-[#505055]">Seed (Число)</label>
                                <input 
                                    value={seed}
                                    onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="Случайно"
                                    inputMode="numeric"
                                    className="w-full bg-[#0B0B0E] border border-[#24242A] rounded-lg text-[10px] font-bold text-white h-8 px-2 focus:outline-none focus:border-[#FFD400]"
                                />
                                <span className="text-[8px] text-[#505055] block">Одинаковый seed → похожий результат</span>
                            </div>
                            
                             <div className="space-y-1">
                                <label className="text-[9px] font-bold text-[#505055]">Watermark</label>
                                <button 
                                    onClick={() => {triggerSelection(); setWatermark(!watermark)}}
                                    className={`w-full flex items-center justify-between px-3 h-8 rounded-lg border transition-all ${watermark ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055]'}`}
                                >
                                    <span className="text-[10px] font-bold">Лого Runway</span>
                                    <span className="text-[10px] font-bold">{watermark ? 'ВКЛ' : 'ВЫКЛ'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Расчет стоимости</span>
                         <span className="font-mono text-[#A0A0A0]">
                            {duration}с × ${PRICE_PER_SEC}
                         </span>
                     </div>
                     <div className="h-px bg-[#24242A]" />
                     <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <Coins size={16} className={canAfford ? 'text-[#FFD400]' : 'text-[#FF4D4D]'} />
                             <span className="text-sm font-bold text-white">Итого</span>
                         </div>
                         <div className="flex flex-col items-end">
                             <span className="text-lg font-bold text-white">{costCredits} CR</span>
                             <span className="text-[10px] text-[#505055] font-mono">(${costUSD.toFixed(2)})</span>
                         </div>
                     </div>
                     
                     <div className="flex items-center gap-2 text-[#A0A0A0] text-[10px] bg-[#0B0B0E] p-2 rounded-lg border border-[#24242A]">
                         <Info size={12} />
                         <span>Оптимизировано для быстрой итерации, а не максимального качества.</span>
                     </div>

                     {!canAfford && (
                         <div className="flex items-center gap-2 text-[#FF4D4D] text-[10px] bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                            <AlertCircle size={12} />
                            <span>Недостаточно кредитов</span>
                        </div>
                     )}
                </div>
            </div>

            {/* Footer Action */}
            <div className="p-5 border-t border-[#24242A] bg-[#0B0B0E]">
                <Button 
                    fullWidth 
                    onClick={handleSubmit} 
                    disabled={!isValid || !canAfford}
                    loading={isSubmitting}
                >
                    {isSubmitting ? (
                        <span className="flex items-center gap-2">
                            Генерация Runway...
                        </span>
                    ) : (
                        <div className="flex items-center gap-2 justify-center">
                            <Video size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                            <span>{canAfford ? (isValid ? 'Сгенерировать видео' : 'Заполните данные') : 'Пополнить баланс'}</span>
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};