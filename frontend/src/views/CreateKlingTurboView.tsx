import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
    Video, Image as ImageIcon, Zap, Monitor, Smartphone, Square, 
    Upload, Trash2, Sliders, AlertCircle, Coins, Clock, CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateKlingTurboViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

type TurboMode = 'text' | 'image';

const MODES = [
    { id: 'text', label: 'Text → Video', icon: Video },
    { id: 'image', label: 'Image → Video', icon: ImageIcon },
];

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
];

const PRICE_PER_SEC = 0.0735;
const CREDITS_PER_DOLLAR = 100;

export const CreateKlingTurboView: React.FC<CreateKlingTurboViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    const [mode, setMode] = useState<TurboMode>('text');
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [duration, setDuration] = useState<5 | 10>(5);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [image, setImage] = useState<string | null>(null);
    const [cfgScale, setCfgScale] = useState(0.5);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        console.log("MODEL_SELECTED: Kling v2.5 Turbo Pro");
    }, []);

    useEffect(() => {
        console.log("USER_BALANCE:", userCredits);
    }, [userCredits]);

    const costUSD = duration * PRICE_PER_SEC;
    const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
    const remainingCredits = userCredits - costCredits;
    const canAfford = userCredits >= costCredits;

    const isValid = useMemo(() => {
        if (mode === 'text') {
            return prompt.trim().length > 0;
        } else {
            return !!image;
        }
    }, [mode, prompt, image]);

    const handleModeChange = (m: TurboMode) => {
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

    const handleDurationChange = (d: 5 | 10) => {
        if (duration !== d) {
            triggerSelection();
            setDuration(d);
        }
    };

    const handleSubmit = async () => {
        if (!canAfford || !isValid || isSubmitting) {
            if (!isValid) triggerNotification('error');
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

            const result = await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'kling-video/v1.5/pro/text-to-video',
                model_name: 'Kling Turbo Pro',
                generation_type: 'video',
                prompt: prompt.trim(),
                negative_prompt: negativePrompt.trim() || undefined,
                image_url: mode === 'image' && image ? image : undefined,
                parameters: {
                    duration: `${duration}s`,
                    aspect_ratio: aspectRatio,
                    cfg_scale: cfgScale,
                },
                idempotency_key: generateIdempotencyKey(),
            });

            setSuccess(true);
            triggerNotification('success');

            // Update balance if provided
            if (result.new_balance !== undefined && onCreditsUpdate) {
                onCreditsUpdate(result.new_balance);
            }

            setTimeout(() => {
                onOpenProfile();
            }, 2000);

        } catch (err: any) {
            console.error('Generation failed:', err);
            let errorMessage = 'Не удалось запустить генерацию. Попробуйте позже.';
            
            if (err.message) {
                try {
                    const errorData = JSON.parse(err.message);
                    errorMessage = errorData.message || errorData.detail || errorMessage;
                } catch {
                    errorMessage = err.message;
                }
            }
            
            setError(errorMessage);
            triggerNotification('error');
            
            if (errorMessage.includes('кредит') || errorMessage.includes('баланс') || errorMessage.includes('INSUFFICIENT')) {
                setTimeout(() => {
                    onOpenProfile();
                }, 3000);
            }
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
                        Kling Turbo Pro
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Zap size={10} className="text-orange-400" /> Fast Text & Image to Video
                    </span>
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
                    <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Режим</label>
                    <div className="flex gap-2">
                        {MODES.map((m) => {
                            const isActive = mode === m.id;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => handleModeChange(m.id as TurboMode)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                                        isActive 
                                        ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20' 
                                        : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
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
                <div className="space-y-4">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Duration */}
                        <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                            <button onClick={() => handleDurationChange(5)} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white' : 'text-[#A0A0A0]'}`}>5s</button>
                            <button onClick={() => handleDurationChange(10)} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white' : 'text-[#A0A0A0]'}`}>10s</button>
                        </div>
                        {/* Resolution Read-Only */}
                        <div className="bg-[#15151A] border border-[#24242A] rounded-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-[#505055]">Up to 1080p HD</span>
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Формат</label>
                        <div className="grid grid-cols-3 gap-2">
                             {RATIOS.map((r) => {
                                 const Icon = r.icon;
                                 const isSelected = aspectRatio === r.id;
                                 return (
                                     <button
                                        key={r.id}
                                        onClick={() => { triggerSelection(); setAspectRatio(r.id); }}
                                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                                            isSelected 
                                            ? 'bg-[#FFD400] border-[#FFD400] text-black' 
                                            : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                        }`}
                                     >
                                         <Icon size={16} className="mb-1" />
                                         <span className="text-[10px] font-bold">{r.label}</span>
                                     </button>
                                 );
                             })}
                         </div>
                    </div>
                </div>

                {/* Mode Specific Inputs */}
                <div className="space-y-5 animate-fade-in">
                    
                    {/* Image Upload Area */}
                    <div className="space-y-2">
                         <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                             {mode === 'text' ? 'Опциональное фото (Гайд)' : 'Исходное изображение'}
                         </label>
                         
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
                    </div>

                    {/* Text Inputs */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                                {mode === 'text' ? 'Промпт' : 'Промпт (Опционально)'}
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                maxLength={2500}
                                placeholder="Опишите сцену, движение и стиль..."
                                className="w-full h-28 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                            />
                        </div>
                        
                        {mode === 'text' && (
                             <div className="space-y-2 bg-[#15151A] p-3 rounded-xl border border-[#24242A]">
                                <div className="flex justify-between items-center text-xs font-bold text-[#A0A0A0]">
                                    <span className="flex items-center gap-1.5"><Sliders size={12} /> CFG Scale</span>
                                    <span className="text-white">{cfgScale.toFixed(1)}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.1" 
                                    value={cfgScale} 
                                    onChange={(e) => setCfgScale(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-[#24242A] rounded-lg appearance-none cursor-pointer accent-[#FFD400]"
                                />
                                <div className="flex justify-between text-[8px] font-bold text-[#505055] uppercase tracking-wider">
                                    <span>Creative</span>
                                    <span>Precise</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#505055] uppercase tracking-wider ml-1">Негативный промпт (Опционально)</label>
                            <input
                                value={negativePrompt}
                                onChange={(e) => setNegativePrompt(e.target.value)}
                                placeholder="Размыто, низкое качество..."
                                className="w-full bg-[#15151A] border border-[#24242A] rounded-xl p-3 text-white placeholder-[#505055] focus:border-[#FFD400]/50 focus:outline-none transition-all text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="bg-[#2A1515] border border-[#441111] rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle size={20} className="text-[#FF4D4D] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[#FF4D4D] text-sm font-bold mb-1">Ошибка</p>
                      <p className="text-[#A0A0A0] text-xs">{error}</p>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="bg-[#1A4D3A] border border-[#2d7a5a] rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle size={20} className="text-[#22C55E] shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[#22C55E] text-sm font-bold mb-1">Генерация запущена!</p>
                      <p className="text-[#A0A0A0] text-xs">Результат придёт в Telegram</p>
                    </div>
                  </div>
                )}

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Расчет</span>
                         <span className="font-mono text-[#A0A0A0]">{duration}с × ${PRICE_PER_SEC}</span>
                     </div>
                     <div className="h-px bg-[#24242A]" />
                     <div className="flex justify-between items-center">
                         <div className="flex items-center gap-2">
                             <Coins size={16} className={canAfford ? 'text-[#FFD400]' : 'text-[#FF4D4D]'} />
                             <span className="text-sm font-bold text-white">Итого</span>
                         </div>
                         <div className="flex flex-col items-end">
                             <span className="text-lg font-bold text-white">{costCredits} CR</span>
                             <span className="text-[10px] text-[#505055] font-mono">(${costUSD.toFixed(3)})</span>
                         </div>
                     </div>
                     {canAfford ? (
                         <div className="flex justify-between items-center text-[10px] bg-black/20 p-2 rounded-lg">
                             <span className="text-[#A0A0A0]">Остаток</span>
                             <span className="text-white font-mono">{remainingCredits} CR</span>
                         </div>
                     ) : (
                         <div className="flex items-center gap-2 text-[#FF4D4D] text-[10px] bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                            <AlertCircle size={12} />
                            <span>Недостаточно средств</span>
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
                            Генерация Turbo...
                        </span>
                    ) : (
                        <div className="flex items-center gap-2 justify-center">
                            <Zap size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                            <span>{canAfford ? (isValid ? 'Сгенерировать видео' : 'Заполните поля') : 'Пополнить баланс'}</span>
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};