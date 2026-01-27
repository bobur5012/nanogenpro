import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Image as ImageIcon, Zap, Star, LayoutTemplate, 
    Monitor, Smartphone, Square, Coins, AlertCircle, 
    Info, Palette, Type, Check, Upload, Trash2, CheckCircle
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';
import { generationAPI } from '../utils/api';
import { getTelegramUserData, generateIdempotencyKey } from '../utils/generationHelpers';

interface CreateImagenViewProps {
  userCredits: number;
  onOpenProfile: () => void;
  onCreditsUpdate?: (newCredits: number) => void;
}

type ImagenMode = 'fast' | 'generate' | 'ultra';
type Format = 'jpeg' | 'png';

const MODES = [
    { id: 'fast', label: 'Fast', icon: Zap, price: 0.021, desc: 'Быстрая генерация' },
    { id: 'generate', label: 'Generate', icon: ImageIcon, price: 0.042, desc: 'Баланс качества' },
    { id: 'ultra', label: 'Ultra', icon: Star, price: 0.063, desc: 'Макс. детализация' },
];

const RATIOS = [
  { id: '1:1', label: '1:1', icon: Square },
  { id: '3:4', label: '3:4', icon: Smartphone },
  { id: '4:3', label: '4:3', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '16:9', label: '16:9', icon: Monitor },
];

const STYLES = [
    { id: 'photorealism', label: 'Фотореализм' },
    { id: 'abstract', label: 'Абстрактный' },
    { id: 'illustration', label: 'Иллюстрация' },
    { id: 'branded', label: 'Брендированный' },
];

const CREDITS_PER_DOLLAR = 100;

export const CreateImagenView: React.FC<CreateImagenViewProps> = ({ userCredits, onOpenProfile, onCreditsUpdate }) => {
    // State
    const [mode, setMode] = useState<ImagenMode>('generate');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [format, setFormat] = useState<Format>('jpeg');
    const [style, setStyle] = useState('photorealism');
    
    // References
    const [refImages, setRefImages] = useState<string[]>([]);
    const refInputRef = useRef<HTMLInputElement>(null);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const currentMode = MODES.find(m => m.id === mode) || MODES[1];

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: Imagen 4.0");
    }, []);

    useEffect(() => {
        const modeLabel = MODES.find(m => m.id === mode)?.label || mode;
        console.log(`MODE_SELECTED: Imagen 4.0 ${modeLabel}`);
    }, [mode]);

    // Handlers
    const handleModeChange = (m: ImagenMode) => {
        if (mode !== m) {
            triggerSelection();
            setMode(m);
        }
    };

    // Reference Handlers
    const handleRefUpload = () => {
        triggerHaptic('light');
        refInputRef.current?.click();
    };

    const handleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            triggerHaptic('medium');
            const maxToAdd = 8 - refImages.length;
            const filesToProcess = Array.from(files).slice(0, maxToAdd);

            filesToProcess.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) {
                        setRefImages(prev => {
                            if (prev.length >= 8) return prev;
                            return [...prev, ev.target!.result as string];
                        });
                    }
                };
                reader.readAsDataURL(file);
            });
        }
        if (refInputRef.current) refInputRef.current.value = '';
    };

    const removeRefImage = (index: number) => {
        triggerHaptic('rigid');
        setRefImages(prev => prev.filter((_, i) => i !== index));
    };

    // Cost Calculation
    const costUSD = currentMode.price;
    const costCredits = Math.ceil(costUSD * CREDITS_PER_DOLLAR);
    const canAfford = userCredits >= costCredits;
    const isValid = prompt.trim().length > 0;

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

            // Use first reference image if available
            let imageUrl: string | undefined;
            if (refImages.length > 0) {
                imageUrl = refImages[0];
            }

            const result = await generationAPI.start({
                user_id: userData.userId,
                init_data: userData.initData,
                model_id: 'imagen/4.0',
                model_name: 'Imagen 4.0',
                generation_type: 'image',
                prompt: prompt.trim(),
                image_url: imageUrl,
                parameters: {
                    mode: mode,
                    aspect_ratio: aspectRatio,
                    format,
                    style,
                    resolution: '2048x2048',
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
                ref={refInputRef} 
                onChange={handleRefChange} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
                multiple
            />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        Imagen 4.0
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <LayoutTemplate size={10} className="text-blue-400" /> Высокая точность
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
                                    onClick={() => handleModeChange(m.id as ImagenMode)}
                                    className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-all ${
                                        isActive 
                                        ? 'bg-[#24242A] text-white shadow-sm' 
                                        : 'text-[#A0A0A0] hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Icon size={14} />
                                        <span className="text-xs font-bold">{m.label}</span>
                                    </div>
                                    <span className="text-[9px] font-mono opacity-70">${m.price}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Common Settings */}
                <div className="space-y-4 pt-2">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        {/* Aspect Ratio */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                            <div className="relative">
                                <select 
                                   value={aspectRatio} 
                                   onChange={(e) => {triggerSelection(); setAspectRatio(e.target.value)}}
                                   className="w-full h-[36px] bg-[#15151A] border border-[#24242A] rounded-xl text-xs font-bold text-white px-3 appearance-none focus:outline-none focus:border-[#FFD400]"
                                >
                                    {RATIOS.map(r => (
                                        <option key={r.id} value={r.id}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Format */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Вывод</label>
                            <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                <button onClick={() => {triggerSelection(); setFormat('jpeg')}} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${format === 'jpeg' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>JPEG</button>
                                <button onClick={() => {triggerSelection(); setFormat('png')}} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${format === 'png' ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>PNG</button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Resolution Read-only */}
                     <div className="flex items-center gap-2 px-1">
                         <Info size={12} className="text-[#A0A0A0]" />
                         <span className="text-[10px] text-[#505055] font-mono">Разрешение: До 2048×2048 (2K)</span>
                     </div>
                </div>

                {/* Prompt Section */}
                <div className="space-y-4 animate-fade-in">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                            Текстовый Промпт (Обязательно)
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={2000} // Approx 480 tokens
                            placeholder="Подробно опишите изображение, стиль, композицию и текст на изображении."
                            className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                        <div className="flex justify-end px-1">
                            <span className="text-[10px] text-[#505055] font-mono">Max 480 tokens</span>
                        </div>
                    </div>

                    {/* Reference Input Section */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider">
                                Референсы (ориентир по стилю)
                            </label>
                            <span className="text-[10px] text-[#505055] font-mono">{refImages.length}/8</span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2">
                            {refImages.map((img, idx) => (
                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#24242A] group bg-[#15151A]">
                                    <img src={img} className="w-full h-full object-cover" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removeRefImage(idx); }}
                                        className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                            
                            {refImages.length < 8 && (
                                <button 
                                    onClick={handleRefUpload}
                                    className="aspect-square rounded-xl border border-dashed border-[#24242A] bg-[#15151A] flex flex-col items-center justify-center gap-1 hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all active:scale-95"
                                >
                                    <Upload size={16} className="text-[#A0A0A0]" />
                                    <span className="text-[9px] text-[#505055] font-bold">Add</span>
                                </button>
                            )}
                        </div>
                        <p className="text-[9px] text-[#505055] px-1">
                            Опционально. Используется только для стиля и композиции.
                        </p>
                    </div>

                    {/* Style Control */}
                    <div className="space-y-2">
                         <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1 flex items-center gap-1.5">
                             <Palette size={10} /> Стиль
                         </label>
                         <div className="grid grid-cols-2 gap-2">
                             {STYLES.map((s) => (
                                 <button
                                     key={s.id}
                                     onClick={() => {triggerSelection(); setStyle(s.id)}}
                                     className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                                         style === s.id 
                                         ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' 
                                         : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'
                                     }`}
                                 >
                                     <span className="text-xs font-bold">{s.label}</span>
                                     {style === s.id && <Check size={12} />}
                                 </button>
                             ))}
                         </div>
                         <p className="text-[9px] text-[#505055] px-1 pt-1 flex items-center gap-1.5">
                             <Type size={10} />
                             Imagen хорошо справляется с читаемым текстом и UI-элементами.
                         </p>
                    </div>
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Стоимость режима {currentMode.label}</span>
                         <span className="font-mono text-[#A0A0A0]">${costUSD}</span>
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
                            Генерация Imagen 4.0...
                        </span>
                    ) : (
                        <div className="flex items-center gap-2 justify-center">
                            <ImageIcon size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                            <span>{canAfford ? (isValid ? 'Сгенерировать изображение' : 'Заполните промпт') : 'Пополнить баланс'}</span>
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};