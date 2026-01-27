import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Video, Image as ImageIcon, Zap, Monitor, Smartphone, Square, 
    Upload, Trash2, Sliders, AlertCircle, Coins, Clock, Film, 
    Type, Camera, Eye, Lock, RefreshCw, Wand2, CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateSeedanceViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

type SeedanceMode = 'pro_text' | 'lite_text' | 'lite_image';
type Resolution = '480p' | '720p' | '1080p';
type CameraType = 'panorama' | 'zoom' | 'follow' | 'aero' | 'handheld';

const MODES = [
    { id: 'pro_text', label: 'Pro: Text → Video', icon: Type, desc: 'Максимальное качество' },
    { id: 'lite_text', label: 'Lite: Text → Video', icon: Zap, desc: 'Быстро и экономно' },
    { id: 'lite_image', label: 'Lite: Image → Video', icon: ImageIcon, desc: 'Анимация изображения' },
];

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
  { id: '3:4', label: '3:4', icon: Smartphone },
  { id: '4:3', label: '4:3', icon: Monitor },
  { id: '21:9', label: '21:9', icon: Film },
];

const CAMERAS: { id: CameraType; label: string }[] = [
    { id: 'panorama', label: 'Панорама' },
    { id: 'zoom', label: 'Зум' },
    { id: 'follow', label: 'Следование' },
    { id: 'aero', label: 'Аэро' },
    { id: 'handheld', label: 'Ручная' },
];

const CREDITS_PER_DOLLAR = 100;
const COST_LITE_480P = 0.019162;
const COST_LITE_720P = 0.04725;
const COST_PRO_ESTIMATE = 0.08; // Estimated base for tokens

export const CreateSeedanceView: React.FC<CreateSeedanceViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    // State
    const [mode, setMode] = useState<SeedanceMode>('pro_text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [duration, setDuration] = useState<5 | 10>(5);
    const [fps, setFps] = useState<24 | 30>(24);
    const [resolution, setResolution] = useState<Resolution>('480p');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    // Advanced for Lite Image
    const [cameraType, setCameraType] = useState<CameraType>('panorama');
    const [seed, setSeed] = useState<string>('');
    const [watermark, setWatermark] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: Seedance 1.0");
    }, []);

    useEffect(() => {
        const modeLabel = MODES.find(m => m.id === mode)?.label || mode;
        console.log(`MODE_SELECTED: ${modeLabel}`);
        
        // Reset specific defaults when switching modes
        if (mode === 'pro_text') {
            setResolution('1080p'); // Pro default
        } else {
            setResolution('480p'); // Lite default
        }
    }, [mode]);

    useEffect(() => {
        console.log("USER_BALANCE:", userCredits);
    }, [userCredits]);

    // Helpers
    const handleModeChange = (m: SeedanceMode) => {
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
    const costUSD = useMemo(() => {
        if (mode === 'pro_text') {
            // Pro pricing logic approximation for UI
            let base = COST_PRO_ESTIMATE;
            if (resolution === '1080p') base *= 2;
            if (duration === 10) base *= 1.8;
            return base;
        } else {
            // Lite pricing logic
            const base = resolution === '720p' ? COST_LITE_720P : COST_LITE_480P;
            // Lite 10s is usually 2x cost or handled by provider logic, assume linear for UI estimate
            return duration === 10 ? base * 2 : base;
        }
    }, [mode, resolution, duration]);

    const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
    const remainingCredits = userCredits - costCredits;
    const canAfford = userCredits >= costCredits;

    const isValid = useMemo(() => {
        if (mode === 'lite_image') return !!image;
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
            if (image && mode === 'lite_image') {
                imageUrl = image;
            }

            const result = await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'bytedance/seedance-1-lite',
                model_name: 'Seedance 1 Lite',
                generation_type: 'video',
                prompt: prompt.trim(),
                image_base64: imageUrl,
                parameters: {
                    mode: mode,
                    duration: `${duration}s`,
                    fps,
                    resolution,
                    aspect_ratio: aspectRatio,
                    ...(mode === 'lite_image' ? { camera_type: cameraType, seed: seed || undefined, watermark } : {}),
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
                accept="image/png, image/jpeg, image/webp" 
            />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        Seedance 1.0
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Video size={10} className="text-emerald-400" /> Efficient Video Generation
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
                    <div className="flex flex-col gap-2">
                        {MODES.map((m) => {
                            const isActive = mode === m.id;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => handleModeChange(m.id as SeedanceMode)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                                        isActive 
                                        ? 'bg-[#FFD400] border-[#FFD400] text-black shadow-lg shadow-yellow-500/20' 
                                        : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} />
                                        <div className="text-left">
                                            <span className="block text-xs font-bold">{m.label}</span>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-mono ${isActive ? 'text-black/70' : 'text-[#505055]'}`}>{m.desc}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Global Settings */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Общие настройки</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Duration */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Длительность</label>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                                <button onClick={() => {triggerSelection(); setDuration(5)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>5s</button>
                                <button onClick={() => {triggerSelection(); setDuration(10)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>10s</button>
                            </div>
                        </div>

                         {/* FPS */}
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Кадры (FPS)</label>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                                <button onClick={() => {triggerSelection(); setFps(24)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${fps === 24 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>24</button>
                                <button 
                                    onClick={() => {if(mode === 'pro_text') {triggerSelection(); setFps(30)}}} 
                                    className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${fps === 30 ? 'bg-[#24242A] text-white shadow-sm' : mode === 'pro_text' ? 'text-[#A0A0A0]' : 'text-[#2A2A30] cursor-not-allowed'}`}
                                    disabled={mode !== 'pro_text'}
                                >
                                    30
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Resolution & Ratio */}
                    <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-[#505055] ml-1">Разрешение</label>
                             <div className="grid grid-cols-2 gap-1.5">
                                 {mode === 'pro_text' ? (
                                     <>
                                        <button onClick={() => {triggerSelection(); setResolution('480p')}} className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${resolution === '480p' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>480p</button>
                                        <button onClick={() => {triggerSelection(); setResolution('1080p')}} className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${resolution === '1080p' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>1080p</button>
                                     </>
                                 ) : (
                                     <>
                                        <button onClick={() => {triggerSelection(); setResolution('480p')}} className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${resolution === '480p' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>480p</button>
                                        <button onClick={() => {triggerSelection(); setResolution('720p')}} className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${resolution === '720p' ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}>720p</button>
                                     </>
                                 )}
                             </div>
                         </div>
                         <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                             <div className="relative">
                                 <select 
                                    value={aspectRatio} 
                                    onChange={(e) => {triggerSelection(); setAspectRatio(e.target.value)}}
                                    disabled={mode === 'lite_image'}
                                    className="w-full h-[34px] bg-[#15151A] border border-[#24242A] rounded-xl text-xs font-bold text-white px-3 appearance-none focus:outline-none focus:border-[#FFD400]"
                                 >
                                     {mode === 'lite_image' ? (
                                         <option value="auto">Авто (из фото)</option>
                                     ) : (
                                        RATIOS.map(r => (
                                            <option key={r.id} value={r.id}>{r.label}</option>
                                        ))
                                     )}
                                 </select>
                             </div>
                         </div>
                    </div>
                </div>

                {/* Specific Inputs */}
                <div className="space-y-4 animate-fade-in">
                    
                    {/* Image Upload (Lite Image) */}
                    {mode === 'lite_image' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Исходное изображение</label>
                            {!image ? (
                                <div 
                                    onClick={handleUpload}
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
                                        <button onClick={handleUpload} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Заменить</button>
                                        <button onClick={clearImage} className="bg-[#2A1515] text-[#FF4D4D] p-1.5 rounded-lg border border-[#441111]"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Prompt Text */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                            {mode === 'lite_image' ? 'Промпт (Опционально)' : 'Текстовый Промпт'}
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={mode === 'pro_text' ? 5000 : 2500}
                            placeholder={mode === 'pro_text' ? "Опишите сцену, движение, стиль и атмосферу." : "Кратко опишите сцену."}
                            className="w-full h-28 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                        <div className="flex justify-end px-1">
                            <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/{mode === 'pro_text' ? 5000 : 2500}</span>
                        </div>
                    </div>

                    {/* Advanced Options for Lite Image */}
                    {mode === 'lite_image' && (
                        <div className="space-y-4 bg-[#15151A] border border-[#24242A] p-3 rounded-xl">
                            <h4 className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wider flex items-center gap-1">
                                <Sliders size={10} /> Дополнительно
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#505055]">Камера</label>
                                    <select 
                                        value={cameraType}
                                        onChange={(e) => {triggerSelection(); setCameraType(e.target.value as CameraType)}}
                                        className="w-full bg-[#0B0B0E] border border-[#24242A] rounded-lg text-[10px] font-bold text-white h-8 px-2 focus:outline-none focus:border-[#FFD400]"
                                    >
                                        {CAMERAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#505055]">Seed</label>
                                    <input 
                                        value={seed}
                                        onChange={(e) => setSeed(e.target.value)}
                                        placeholder="Случайно"
                                        className="w-full bg-[#0B0B0E] border border-[#24242A] rounded-lg text-[10px] font-bold text-white h-8 px-2 focus:outline-none focus:border-[#FFD400]"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={() => {triggerSelection(); setWatermark(!watermark)}}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${watermark ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055]'}`}
                            >
                                <span className="text-[10px] font-bold">Watermark</span>
                                <span className="text-[10px] font-bold">{watermark ? 'ВКЛ' : 'ВЫКЛ'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Расчет стоимости</span>
                         <span className="font-mono text-[#A0A0A0]">
                             {mode === 'pro_text' ? 'Зависит от токенов (~approx)' : `${duration}с × Fix Rate`}
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
                             <span className="text-[10px] text-[#505055] font-mono">(${costUSD.toFixed(3)})</span>
                         </div>
                     </div>
                     
                     {mode === 'pro_text' && (
                         <div className="flex items-center gap-2 text-orange-400 text-[10px] bg-orange-950/20 p-2 rounded-lg border border-orange-500/20">
                            <Clock size={12} />
                            <span>Высокая задержка генерации (Pro)</span>
                         </div>
                     )}

                     {!canAfford && (
                         <div className="flex items-center gap-2 text-[#FF4D4D] text-[10px] bg-[#2A1515] p-2 rounded-lg border border-[#441111]">
                            <AlertCircle size={12} />
                            <span>Недостаточно кредитов</span>
                        </div>
                     )}

                     {mode !== 'pro_text' && (
                         <div className="flex items-center gap-2 text-[#A0A0A0] text-[10px] bg-[#0B0B0E] p-2 rounded-lg border border-[#24242A]">
                             <Lock size={12} />
                             <span>Без аудио (Silent generation)</span>
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
                            Генерация Seedance...
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