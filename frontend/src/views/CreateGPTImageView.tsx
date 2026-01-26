import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Image as ImageIcon, PenTool, Brain, Upload, Trash2, 
    Settings, AlertCircle, Coins, Check, Zap, Layers,
    Maximize, Minimize, Sliders, Info
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';

interface CreateGPTImageViewProps {
  userCredits: number;
  onOpenProfile: () => void;
}

type GPTMode = 'text' | 'edit';
type Size = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
type Quality = 'low' | 'medium' | 'high' | 'auto';
type Format = 'png' | 'jpeg' | 'webp';
type Transparency = 'transparent' | 'opaque' | 'auto';

const MODES = [
    { id: 'text', label: 'Text → Image', icon: ImageIcon },
    { id: 'edit', label: 'Редактирование', icon: PenTool },
];

const SIZES: { id: Size; label: string }[] = [
    { id: '1024x1024', label: '1:1 (1K)' },
    { id: '1536x1024', label: '3:2 (Landscape)' },
    { id: '1024x1536', label: '2:3 (Portrait)' },
    { id: 'auto', label: 'Auto' },
];

const BASE_COST = 2; // Credits base
const CREDITS_PER_DOLLAR = 100;

export const CreateGPTImageView: React.FC<CreateGPTImageViewProps> = ({ userCredits, onOpenProfile }) => {
    // State
    const [mode, setMode] = useState<GPTMode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    
    // Settings - Mode 1
    const [size, setSize] = useState<Size>('1024x1024');
    const [quality, setQuality] = useState<Quality>('high');
    const [format, setFormat] = useState<Format>('png');
    const [transparency, setTransparency] = useState<Transparency>('auto');
    
    // Settings - Mode 2
    const [compression, setCompression] = useState<number>(50);
    const [partialImages, setPartialImages] = useState<0 | 1 | 2 | 3>(0);
    
    // Advanced
    const [streaming, setStreaming] = useState(true);
    const [composition, setComposition] = useState(true);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: GPT Image 1.5");
    }, []);

    useEffect(() => {
        const modeLabel = MODES.find(m => m.id === mode)?.label || mode;
        console.log(`MODE_SELECTED: ${modeLabel}`);
    }, [mode]);

    // Handlers
    const handleModeChange = (m: GPTMode) => {
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

    // Cost Calculation (Mock)
    const costCredits = useMemo(() => {
        let c = BASE_COST;
        if (mode === 'edit') c += 1;
        if (quality === 'high') c += 1;
        if (size !== '1024x1024' && size !== 'auto') c += 1;
        return c;
    }, [mode, quality, size]);

    const canAfford = userCredits >= costCredits;
    const isValid = useMemo(() => {
        if (prompt.trim().length === 0) return false;
        if (mode === 'edit' && !image) return false;
        return true;
    }, [mode, prompt, image]);

    const handleSubmit = () => {
        if (!canAfford || !isValid) {
            triggerNotification('error');
            return;
        }
        setIsSubmitting(true);
        triggerHaptic('medium');

        setTimeout(() => {
            const payload = {
                type: 'image_gen', // Using generic image payload or can be custom 'gpt_gen'
                payload: {
                    model: `gpt-image-1.5-${mode}`,
                    prompt,
                    image_data: image ? 'base64_truncated' : undefined,
                    settings: {
                        size,
                        quality,
                        format,
                        transparency,
                        compression,
                        partial_images: partialImages,
                        streaming,
                        composition
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
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/png, image/jpeg, image/webp" 
            />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        GPT Image 1.5
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Brain size={10} className="text-emerald-400" /> Контролируемая генерация
                    </span>
                    <div className="mt-1 flex">
                        <span className="bg-[#15151A] border border-[#24242A] text-white text-[9px] px-1.5 py-0.5 rounded font-bold">Высокая точность prompt’ов</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <BalanceDisplay amount={userCredits} canAfford={canAfford} onClick={onOpenProfile} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-20">
                
                {/* Mode Selector */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#505055] uppercase tracking-wider ml-1">Режим работы</label>
                    <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                        {MODES.map((m) => {
                            const isActive = mode === m.id;
                            const Icon = m.icon;
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => handleModeChange(m.id as GPTMode)}
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

                {/* Main Inputs */}
                <div className="space-y-4 animate-fade-in">
                    
                    {/* Image Upload for Edit Mode */}
                    {mode === 'edit' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Исходное изображение (Обязательно)</label>
                            {!image ? (
                                <div 
                                    onClick={handleUpload}
                                    className="w-full h-32 border-2 border-dashed border-[#24242A] bg-[#15151A] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#FFD400]/50 hover:bg-[#1A1A1F] transition-all"
                                >
                                    <div className="w-8 h-8 rounded-full bg-[#1A1A22] flex items-center justify-center border border-[#24242A]">
                                        <Upload size={14} className="text-[#A0A0A0]" />
                                    </div>
                                    <span className="text-xs font-bold text-[#505055]">Загрузить для редактирования</span>
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
                            {mode === 'edit' ? 'Промпт изменений' : 'Текстовый Промпт (Обязательно)'}
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={5000}
                            placeholder={mode === 'edit' 
                                ? "Опишите, что нужно изменить, сохранив композицию и освещение..." 
                                : "Подробно опишите изображение, стиль, композицию и ограничения..."}
                            className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                        <div className="flex justify-end px-1">
                            <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/5000</span>
                        </div>
                    </div>
                </div>

                {/* Specific Mode Settings */}
                <div className="space-y-4 pt-2 border-t border-[#24242A]">
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Параметры генерации</h3>

                    {mode === 'text' ? (
                        <>
                            {/* Text Mode Settings */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#505055] ml-1">Размер</label>
                                    <div className="relative">
                                        <select 
                                            value={size} 
                                            onChange={(e) => {triggerSelection(); setSize(e.target.value as Size)}}
                                            className="w-full h-[36px] bg-[#15151A] border border-[#24242A] rounded-xl text-xs font-bold text-white px-3 appearance-none focus:outline-none focus:border-[#FFD400]"
                                        >
                                            {SIZES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#505055] ml-1">Качество</label>
                                    <div className="relative">
                                        <select 
                                            value={quality} 
                                            onChange={(e) => {triggerSelection(); setQuality(e.target.value as Quality)}}
                                            className="w-full h-[36px] bg-[#15151A] border border-[#24242A] rounded-xl text-xs font-bold text-white px-3 appearance-none focus:outline-none focus:border-[#FFD400]"
                                        >
                                            <option value="auto">Auto</option>
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                                    <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                        {(['png', 'jpeg', 'webp'] as Format[]).map(f => (
                                            <button 
                                                key={f} 
                                                onClick={() => {triggerSelection(); setFormat(f)}} 
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${format === f ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-[#505055] ml-1">Фон</label>
                                    <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                        <button onClick={() => {triggerSelection(); setTransparency('auto')}} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${transparency === 'auto' ? 'bg-[#24242A] text-white' : 'text-[#A0A0A0]'}`}>Auto</button>
                                        <button onClick={() => {triggerSelection(); setTransparency('transparent')}} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${transparency === 'transparent' ? 'bg-[#24242A] text-white' : 'text-[#A0A0A0]'}`}>Alpha</button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Edit Mode Settings */}
                             <div className="space-y-2 bg-[#15151A] p-3 rounded-xl border border-[#24242A]">
                                <div className="flex justify-between items-center text-xs font-bold text-[#A0A0A0]">
                                    <span className="flex items-center gap-1.5"><Sliders size={12} /> Сжатие</span>
                                    <span className="text-white">{compression}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="100" step="5" 
                                    value={compression} 
                                    onChange={(e) => setCompression(parseInt(e.target.value))}
                                    className="w-full h-1 bg-[#24242A] rounded-lg appearance-none cursor-pointer accent-[#FFD400]"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#505055] ml-1">Промежуточные результаты</label>
                                <div className="flex bg-[#15151A] rounded-xl p-1 border border-[#24242A]">
                                    {[0, 1, 2, 3].map(n => (
                                        <button 
                                            key={n} 
                                            onClick={() => {triggerSelection(); setPartialImages(n as any)}} 
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${partialImages === n ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-[#505055] px-1">Ускоряет восприятие процесса генерации</p>
                            </div>
                        </>
                    )}

                    {/* Advanced Options (All Modes) */}
                    <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-3 grid grid-cols-2 gap-3">
                         <button 
                            onClick={() => {triggerSelection(); setStreaming(!streaming)}}
                            className={`flex items-center justify-between px-3 h-9 rounded-lg border transition-all ${streaming ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055]'}`}
                        >
                            <span className="text-[10px] font-bold flex items-center gap-1.5"><Zap size={10} /> Streaming</span>
                            <span className="text-[10px] font-bold">{streaming ? 'ON' : 'OFF'}</span>
                        </button>

                         <button 
                            onClick={() => {triggerSelection(); setComposition(!composition)}}
                            className={`flex items-center justify-between px-3 h-9 rounded-lg border transition-all ${composition ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055]'}`}
                        >
                            <span className="text-[10px] font-bold flex items-center gap-1.5"><Layers size={10} /> Сохранить комп.</span>
                            <span className="text-[10px] font-bold">{composition ? 'ON' : 'OFF'}</span>
                        </button>
                        <p className="text-[9px] text-[#505055] col-span-2 px-1">"Сохранить комп." фиксирует освещение и перспективу.</p>
                    </div>
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Оценка токенов</span>
                         <span className="font-mono text-[#A0A0A0]">
                            ~{costCredits * 150} tokens
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
                     
                     <div className="flex items-center gap-2 text-[#A0A0A0] text-[10px] bg-[#0B0B0E] p-2 rounded-lg border border-[#24242A]">
                         <Info size={12} />
                         <span>GPT Image 1.5 использует токенную модель оплаты.</span>
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
                            Генерация...
                        </span>
                    ) : (
                        <div className="flex items-center gap-2 justify-center">
                            <ImageIcon size={18} className={canAfford && isValid ? "text-black" : "text-[#FF4D4D]"} />
                            <span>{canAfford ? (isValid ? 'Сгенерировать изображение' : 'Заполните данные') : 'Пополнить баланс'}</span>
                        </div>
                    )}
                </Button>
            </div>
        </div>
    );
};