import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Video, 
    Image as ImageIcon, 
    Layers, 
    ArrowRightLeft, 
    Monitor, 
    Smartphone, 
    Mic, 
    Music, 
    Coins, 
    AlertTriangle, 
    Type,
    Film,
    Upload,
    Trash2,
    CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateVeoViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

type VeoMode = 'text' | 'image' | 'reference' | 'frames';

interface ModeConfig {
    id: VeoMode;
    label: string;
    icon: React.ElementType;
    desc: string;
}

const MODES: ModeConfig[] = [
    { id: 'text', label: 'Text → Video', icon: Type, desc: 'Генерация по описанию' },
    { id: 'image', label: 'Image → Video', icon: ImageIcon, desc: 'Оживление фото' },
    { id: 'reference', label: 'Ref → Video', icon: Layers, desc: 'Референс стиля/персонажа' },
    { id: 'frames', label: 'Frames → Video', icon: ArrowRightLeft, desc: 'Интерполяция кадров' },
];

const PRICE_NO_AUDIO = 0.21;
const PRICE_AUDIO = 0.42;
const CREDITS_PER_DOLLAR = 100;

const DURATIONS = [4, 6, 8];
const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
];

export const CreateVeoView: React.FC<CreateVeoViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    const [mode, setMode] = useState<VeoMode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [duration, setDuration] = useState(4);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [audio, setAudio] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        console.log("MODEL_SELECTED: Veo 3.1");
    }, []);

    const currentMode = useMemo(() => MODES.find(m => m.id === mode) || MODES[0], [mode]);

    const pricePerSec = audio ? PRICE_AUDIO : PRICE_NO_AUDIO;
    const costUSD = duration * pricePerSec;
    const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
    const canAfford = userCredits >= costCredits;

    const isValid = useMemo(() => {
        if (mode === 'text') return prompt.trim().length > 0;
        if (mode === 'image' || mode === 'reference' || mode === 'frames') return !!image;
        return false;
    }, [mode, prompt, image]);

    const handleModeChange = (m: VeoMode) => {
        if (mode !== m) {
            triggerSelection();
            setMode(m);
            setPrompt('');
            setImage(null);
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
            if (image && (mode === 'image' || mode === 'reference' || mode === 'frames')) {
                imageUrl = image;
            }

            const result = await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'google/veo-3.1-generate',
                model_name: 'Veo 3.1',
                generation_type: 'video',
                prompt: prompt.trim(),
                image_url: imageUrl,
                parameters: {
                    mode: mode,
                    duration: `${duration}s`,
                    aspect_ratio: aspectRatio,
                    audio: audio,
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
                        Veo 3.1
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Film size={10} className="text-cyan-400" /> High-Fidelity Video
                    </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
                
                {/* Mode Selector */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Режим</label>
                    <div className="grid grid-cols-2 gap-2">
                        {MODES.map((m) => {
                            const isActive = mode === m.id;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => handleModeChange(m.id as VeoMode)}
                                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-all ${
                                        isActive 
                                        ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20' 
                                        : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                    }`}
                                >
                                    <Icon size={16} />
                                    <div className="text-left">
                                        <span className="block text-xs font-bold">{m.label}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Settings */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Длительность</label>
                            <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                {DURATIONS.map(d => (
                                    <button 
                                        key={d}
                                        onClick={() => {triggerSelection(); setDuration(d)}} 
                                        className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === d ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}
                                    >
                                        {d}s
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                            <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                {RATIOS.map(r => {
                                    const Icon = r.icon;
                                    return (
                                        <button 
                                            key={r.id}
                                            onClick={() => {triggerSelection(); setAspectRatio(r.id)}}
                                            className={`flex-1 flex items-center justify-center rounded-lg transition-all ${aspectRatio === r.id ? 'bg-[#FFD400] text-black' : 'text-[#A0A0A0]'}`}
                                        >
                                            <Icon size={14} />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => {triggerSelection(); setAudio(!audio)}}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl border transition-all ${
                            audio 
                            ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' 
                            : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                        }`}
                    >
                         <div className="flex items-center gap-2">
                             {audio ? <Mic size={16} /> : <Music size={16} />}
                             <span className="text-xs font-bold">Аудио сопровождение</span>
                         </div>
                         <span className="text-[10px] font-bold">{audio ? 'ВКЛ' : 'ВЫКЛ'}</span>
                    </button>
                </div>

                {/* Inputs */}
                <div className="space-y-4 animate-fade-in">
                    
                    {mode !== 'text' && (
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Исходное изображение</label>
                             
                             {!image ? (
                                 <div 
                                    onClick={handleUploadClick}
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
                                         <button onClick={handleUploadClick} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Заменить</button>
                                         <button onClick={clearImage} className="bg-[#2A1515] text-[#FF4D4D] p-1.5 rounded-lg border border-[#441111]"><Trash2 size={16} /></button>
                                     </div>
                                 </div>
                             )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                            {mode === 'text' ? 'Текстовый Промпт' : 'Промпт (Опционально)'}
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={5000}
                            placeholder="Опишите сцену, движение и атмосферу..."
                            className="w-full h-28 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                    </div>
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Тариф</span>
                         <span className="font-mono text-[#A0A0A0]">
                             {duration}s / {audio ? 'Audio' : 'Silent'}
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
                     
                     <div className="flex items-center gap-2 text-cyan-400 text-[10px] bg-cyan-950/20 p-2 rounded-lg border border-cyan-500/20">
                        <AlertTriangle size={12} />
                        <span>Veo генерирует видео высокого разрешения (1080p+).</span>
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
                            Генерация Veo...
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