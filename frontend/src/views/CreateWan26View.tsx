import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Video, Image as ImageIcon, Monitor, Smartphone, Square, 
    Upload, Trash2, Coins, AlertTriangle, Film, Type, Layers, Info, CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateWan26ViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

type Wan26Mode = 'text' | 'image' | 'reference';
type Resolution = '720p' | '1080p';

const MODES = [
    { id: 'text', label: 'Text → Video', icon: Type, desc: 'Генерация по описанию' },
    { id: 'image', label: 'Image → Video', icon: ImageIcon, desc: 'Оживление фото' },
    { id: 'reference', label: 'Ref → Video', icon: Layers, desc: 'Генерация по референсу' },
];

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
  { id: '4:3', label: '4:3', icon: Monitor },
  { id: '3:4', label: '3:4', icon: Smartphone },
];

// Pricing Configuration (USD per second)
const PRICING = {
    standard: { // Text and Image modes
        '720p': 0.105,
        '1080p': 0.1575
    },
    reference: { // Reference mode
        '720p': 0.0903126,
        '1080p': 0.15052065
    }
};

const CREDITS_PER_DOLLAR = 100;

export const CreateWan26View: React.FC<CreateWan26ViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    // State
    const [mode, setMode] = useState<Wan26Mode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [duration, setDuration] = useState<5 | 10>(5);
    const [refDuration, setRefDuration] = useState<number>(4); // Slider 2-8s for Reference mode
    const [resolution, setResolution] = useState<Resolution>('720p');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentMode = MODES.find(m => m.id === mode) || MODES[0];

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: Wan 2.6");
    }, []);

    useEffect(() => {
        const modeLabel = MODES.find(m => m.id === mode)?.label || mode;
        console.log(`MODE_SELECTED: ${modeLabel}`);
    }, [mode]);

    useEffect(() => {
        console.log("USER_BALANCE:", userCredits);
    }, [userCredits]);

    // Handlers
    const handleModeChange = (m: Wan26Mode) => {
        if (mode !== m) {
            triggerSelection();
            setMode(m);
            // Reset durations to defaults when switching
            if (m === 'reference') {
                setRefDuration(4);
            } else {
                setDuration(5);
            }
        }
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

    // Cost Calculation
    const costUSD = useMemo(() => {
        if (mode === 'reference') {
            const rate = resolution === '720p' ? PRICING.reference['720p'] : PRICING.reference['1080p'];
            return rate * refDuration;
        } else {
            const rate = resolution === '720p' ? PRICING.standard['720p'] : PRICING.standard['1080p'];
            return rate * duration;
        }
    }, [mode, resolution, duration, refDuration]);

    const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
    const remainingCredits = userCredits - costCredits;
    const canAfford = userCredits >= costCredits;

    const isValid = useMemo(() => {
        if (mode === 'image' && !image) return false;
        if (mode === 'reference' && !image) return false;
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

            let imageUrl: string | undefined;
            if (image && (mode === 'image' || mode === 'reference')) {
                imageUrl = image;
            }

            const result = await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'wan/2.6',
                model_name: 'Wan 2.6',
                generation_type: 'video',
                prompt: prompt.trim(),
                image_url: imageUrl,
                parameters: {
                    mode: mode,
                    duration: mode === 'reference' ? `${refDuration}s` : `${duration}s`,
                    resolution,
                    aspect_ratio: aspectRatio,
                },
                idempotency_key: generateIdempotencyKey(),
            });

            setSuccess(true);
            triggerNotification('success');

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
                accept="image/*"
            />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        Wan 2.6
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Film size={10} className="text-blue-400" /> Advanced Video Generation
                    </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
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
                                    onClick={() => handleModeChange(m.id as Wan26Mode)}
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
                    <p className="text-[9px] text-[#505055] px-1 h-3">{currentMode.desc}</p>
                </div>

                {/* Global Settings */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Duration */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Длительность</label>
                            {mode === 'reference' ? (
                                <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-3">
                                    <div className="flex justify-between items-center text-xs font-bold mb-2">
                                        <span className="text-white">{refDuration} сек</span>
                                        <span className="text-[#A0A0A0] text-[9px]">2-8s</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="2" max="8" step="1" 
                                        value={refDuration} 
                                        onChange={(e) => {triggerSelection(); setRefDuration(parseInt(e.target.value))}}
                                        className="w-full h-1 bg-[#24242A] rounded-lg appearance-none cursor-pointer accent-[#FFD400]"
                                    />
                                </div>
                            ) : (
                                <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                                    <button onClick={() => {triggerSelection(); setDuration(5)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>5 сек</button>
                                    <button onClick={() => {triggerSelection(); setDuration(10)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>10 сек</button>
                                </div>
                            )}
                        </div>

                        {/* Resolution */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Разрешение</label>
                            <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                <button onClick={() => {triggerSelection(); setResolution('720p')}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${resolution === '720p' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>720p</button>
                                <button onClick={() => {triggerSelection(); setResolution('1080p')}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${resolution === '1080p' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>1080p</button>
                            </div>
                        </div>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="space-y-1.5">
                         <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                         <div className="grid grid-cols-5 gap-1.5">
                             {RATIOS.map(r => {
                                 const Icon = r.icon;
                                 return (
                                    <button 
                                        key={r.id}
                                        onClick={() => {triggerSelection(); setAspectRatio(r.id)}}
                                        className={`flex items-center justify-center rounded-xl border py-2 transition-all ${aspectRatio === r.id ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}
                                    >
                                        <Icon size={14} />
                                    </button>
                                 )
                             })}
                         </div>
                    </div>
                </div>

                {/* Inputs */}
                <div className="space-y-4 animate-fade-in">
                    
                    {(mode === 'image' || mode === 'reference') && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                                {mode === 'image' ? 'Исходное изображение' : 'Референс-изображение'}
                            </label>
                            {!image ? (
                                <div 
                                    onClick={handleUploadClick}
                                    className="w-full h-32 border-2 border-dashed border-[#24242A] bg-[#15151A] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all"
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A22] flex items-center justify-center border border-[#24242A]">
                                        <Upload size={14} className="text-[#A0A0A0]" />
                                    </div>
                                    <span className="text-xs font-bold text-[#505055]">Загрузить фото</span>
                                </div>
                            ) : (
                                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-[#24242A] group bg-[#15151A]">
                                    <img src={image} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
                                        <button onClick={handleUploadClick} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Заменить</button>
                                        <button onClick={clearImage} className="bg-[#2A1515] text-[#FF4D4D] p-1.5 rounded-lg border border-[#441111]"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                            Текстовый Промпт
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={5000}
                            placeholder="Опишите сцену детально..."
                            className="w-full h-28 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                         <div className="flex justify-end px-1">
                            <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/5000</span>
                        </div>
                    </div>
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Тариф</span>
                         <span className="font-mono text-[#A0A0A0]">
                             {resolution}
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
                             <span className="text-[10px] text-[#505055] font-mono">Баланс: {userCredits}</span>
                         </div>
                     </div>

                     {!canAfford && (
                         <div className="flex items-center gap-2 text-[#FF4D4D] text-[10px] bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                            <AlertTriangle size={12} />
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
                            Генерация Wan 2.6...
                        </span>
                    ) : (
                        <div className="flex items-center gap-2 justify-center">
                            <Film size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                            <span>{canAfford ? (isValid ? 'Сгенерировать видео' : 'Заполните данные') : 'Пополнить баланс'}</span>
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};