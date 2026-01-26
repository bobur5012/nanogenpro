import React, { useState, useEffect, useRef } from 'react';
import { 
    Image as ImageIcon, Zap, Star, 
    Monitor, Smartphone, Square, Coins, AlertCircle, 
    Info, Upload, Trash2
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';

interface CreateNanoBananaViewProps {
  userCredits: number;
  onOpenProfile: () => void;
}

type BananaMode = 'standard' | 'pro';
type Format = 'jpeg' | 'png';

const MODES = [
    { id: 'standard', label: 'Nano Banana', icon: Zap, price: 0.04095, desc: 'Быстрая генерация (Flash)' },
    { id: 'pro', label: 'Nano Banana Pro', icon: Star, price: 0.1575, desc: 'Высокое качество (Pro Image)' },
];

const RATIOS = [
  { id: '1:1', label: '1:1', icon: Square },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '1024x1792', label: 'Portrait', icon: Smartphone },
];

const CREDITS_PER_DOLLAR = 100;

export const CreateNanoBananaView: React.FC<CreateNanoBananaViewProps> = ({ userCredits, onOpenProfile }) => {
    // State
    const [mode, setMode] = useState<BananaMode>('standard');
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [format, setFormat] = useState<Format>('jpeg');
    
    // References
    const [refImages, setRefImages] = useState<string[]>([]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const refInputRef = useRef<HTMLInputElement>(null);

    const currentMode = MODES.find(m => m.id === mode) || MODES[0];

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: Nano Banana");
    }, []);

    useEffect(() => {
        const modeLabel = MODES.find(m => m.id === mode)?.label || mode;
        console.log(`MODE_SELECTED: ${modeLabel}`);
    }, [mode]);

    useEffect(() => {
        console.log("USER_BALANCE:", userCredits);
    }, [userCredits]);

    // Handlers
    const handleModeChange = (m: BananaMode) => {
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

    const handleSubmit = () => {
        if (!canAfford || !isValid) {
            triggerNotification('error');
            return;
        }
        setIsSubmitting(true);
        triggerHaptic('medium');

        setTimeout(() => {
            const payload = {
                type: 'image_gen',
                payload: {
                    model: `nano-banana-${mode}`,
                    prompt,
                    settings: {
                        ratio: aspectRatio,
                        format,
                        reference_images: refImages.length > 0 ? 'base64_array_truncated' : undefined
                    },
                    cost: costCredits
                }
            };
            window.Telegram.WebApp.sendData(JSON.stringify(payload));
        }, 2000);
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
                        Nano Banana
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <ImageIcon size={10} className="text-yellow-400" /> Генерация от Google
                    </span>
                </div>
                <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
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
                                    onClick={() => handleModeChange(m.id as BananaMode)}
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
                    <p className="text-[9px] text-[#505055] px-1">
                        {mode === 'standard' 
                            ? 'Оптимизировано для скорости и масштабируемости.' 
                            : 'Enterprise-grade стабильность и 2K/4K качество.'}
                    </p>
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
                            maxLength={3000}
                            placeholder="Опишите изображение, стиль, композицию и ключевые детали."
                            className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                        <div className="flex justify-between px-1">
                            <span className="text-[10px] text-[#FFD400] flex items-center gap-1">
                                <Info size={10} /> Стиль Google фотореализм
                            </span>
                            <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/3000</span>
                        </div>
                    </div>

                    {/* References Section */}
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
                            Опционально. Используется только для стиля и композиции. Не для редактирования.
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
                            Генерация Nano Banana...
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