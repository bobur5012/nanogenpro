import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Video, Image as ImageIcon, Monitor, Smartphone, Square, 
    Upload, Trash2, Coins, AlertTriangle, Mic, Music, Volume2,
    Move, Maximize, ArrowUp, ArrowRight, Focus, Film, Type, Check
} from 'lucide-react';
import { Button } from '../components/Button';
import { BalanceDisplay } from '../components/BalanceDisplay';
import { triggerHaptic, triggerSelection, triggerNotification } from '../utils/haptics';

interface CreateWanViewProps {
  userCredits: number;
  onOpenProfile: () => void;
}

type WanMode = 'text' | 'image';
type Resolution = '480p' | '720p' | '1080p' | '4K';

const MODES = [
    { id: 'text', label: 'Text → Video', icon: Type },
    { id: 'image', label: 'Image → Video', icon: ImageIcon },
];

const RESOLUTIONS: { id: Resolution; label: string; multiplier: number }[] = [
    { id: '480p', label: '480p', multiplier: 1 },
    { id: '720p', label: '720p', multiplier: 1.5 },
    { id: '1080p', label: '1080p', multiplier: 2.5 },
    { id: '4K', label: '4K', multiplier: 5 },
];

const RATIOS = [
  { id: '16:9', label: '16:9', icon: Monitor },
  { id: '9:16', label: '9:16', icon: Smartphone },
  { id: '1:1', label: '1:1', icon: Square },
];

const BASE_COST_PER_SEC = 0.5; // Credits per second base
const CREDITS_PER_DOLLAR = 100;

export const CreateWanView: React.FC<CreateWanViewProps> = ({ userCredits, onOpenProfile }) => {
    // State
    const [mode, setMode] = useState<WanMode>('text');
    const [prompt, setPrompt] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [duration, setDuration] = useState<5 | 10>(5);
    const [resolution, setResolution] = useState<Resolution>('720p');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    // Camera Controls
    const [camera, setCamera] = useState({
        pan: false,
        tilt: false,
        zoom: false,
        dolly: false,
        rackFocus: false
    });

    // Audio Files (Simulated)
    const [audioFiles, setAudioFiles] = useState<{
        voice: boolean;
        music: boolean;
        sfx: boolean;
    }>({ voice: false, music: false, sfx: false });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadTypeRef = useRef<'image' | 'voice' | 'music' | 'sfx' | null>(null);

    // Logging
    useEffect(() => {
        console.log("MODEL_SELECTED: Wan 2.5");
    }, []);

    useEffect(() => {
        console.log(`MODE_SELECTED: ${mode === 'text' ? 'Text → Video' : 'Image → Video'}`);
    }, [mode]);

    useEffect(() => {
        console.log("USER_BALANCE:", userCredits);
    }, [userCredits]);

    // Handlers
    const handleModeChange = (m: WanMode) => {
        if (mode !== m) {
            triggerSelection();
            setMode(m);
        }
    };

    const toggleCamera = (key: keyof typeof camera) => {
        triggerSelection();
        setCamera(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleUploadClick = (type: 'image' | 'voice' | 'music' | 'sfx') => {
        uploadTypeRef.current = type;
        triggerHaptic('light');
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && uploadTypeRef.current) {
            triggerHaptic('medium');
            if (uploadTypeRef.current === 'image') {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) setImage(ev.target.result as string);
                };
                reader.readAsDataURL(file);
            } else {
                setAudioFiles(prev => ({ ...prev, [uploadTypeRef.current as string]: true }));
            }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const clearImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('rigid');
        setImage(null);
    };

    const clearAudio = (type: keyof typeof audioFiles, e: React.MouseEvent) => {
        e.stopPropagation();
        triggerHaptic('rigid');
        setAudioFiles(prev => ({ ...prev, [type]: false }));
    };

    // Pricing
    const costCredits = useMemo(() => {
        const resMultiplier = RESOLUTIONS.find(r => r.id === resolution)?.multiplier || 1;
        const base = duration * BASE_COST_PER_SEC;
        return Math.ceil(base * resMultiplier * 2); // x2 factor to account for "Premium Model" credits
    }, [duration, resolution]);

    const canAfford = userCredits >= costCredits;
    const isValid = useMemo(() => {
        if (mode === 'image' && !image) return false;
        if (mode === 'text' && prompt.trim().length === 0) return false;
        return true;
    }, [mode, image, prompt]);

    const handleSubmit = () => {
        if (!canAfford || !isValid) {
            triggerNotification('error');
            return;
        }
        setIsSubmitting(true);
        triggerHaptic('medium');

        setTimeout(() => {
            const payload = {
                type: 'video_gen',
                payload: {
                    model: `wan-2.5-${mode}`,
                    prompt,
                    image_data: image ? 'base64_truncated' : undefined,
                    duration: `${duration}s`,
                    resolution,
                    ratio: aspectRatio,
                    camera_controls: camera,
                    audio_config: audioFiles,
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
                accept={uploadTypeRef.current === 'image' ? "image/*" : "audio/*"}
            />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between shrink-0 bg-[#0B0B0E] sticky top-0 z-10 border-b border-[#24242A]">
                <div>
                    <h1 className="font-bold text-lg text-white leading-none flex items-center gap-2">
                        Wan 2.5
                    </h1>
                    <span className="text-[10px] text-[#A0A0A0] font-mono mt-1 block flex items-center gap-1.5">
                        <Film size={10} className="text-indigo-400" /> Cinematic Audio-Visual
                    </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 bg-[#15151A] px-2 py-0.5 rounded border border-[#24242A]">
                        <Volume2 size={10} className="text-[#FFD400]" />
                        <span className="text-[9px] font-bold text-white uppercase">Аудио вкл.</span>
                    </div>
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
                                    onClick={() => handleModeChange(m.id as WanMode)}
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
                    <h3 className="text-[#A0A0A0] text-xs font-bold uppercase tracking-wider ml-1">Настройки</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">Длительность</label>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex">
                                <button onClick={() => {triggerSelection(); setDuration(5)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 5 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>5 сек</button>
                                <button onClick={() => {triggerSelection(); setDuration(10)}} className={`flex-1 rounded-lg text-xs font-bold py-2 transition-all ${duration === 10 ? 'bg-[#24242A] text-white shadow-sm' : 'text-[#A0A0A0]'}`}>10 сек</button>
                            </div>
                        </div>

                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-[#505055] ml-1">FPS</label>
                            <div className="bg-[#15151A] border border-[#24242A] rounded-xl p-1 flex items-center justify-center h-[42px]">
                                <span className="text-xs font-bold text-[#505055] flex items-center gap-1">
                                    <Film size={12} /> 24 (Cinematic)
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                         <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-[#505055] ml-1">Разрешение</label>
                             <div className="grid grid-cols-2 gap-1.5">
                                 {RESOLUTIONS.map(r => (
                                     <button 
                                        key={r.id}
                                        onClick={() => {triggerSelection(); setResolution(r.id)}}
                                        className={`relative py-2 rounded-xl border text-[10px] font-bold transition-all ${resolution === r.id ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}
                                     >
                                         {r.label}
                                         {r.id === '4K' && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span></span>}
                                     </button>
                                 ))}
                             </div>
                         </div>
                         <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-[#505055] ml-1">Формат</label>
                             <div className="grid grid-cols-3 gap-1.5">
                                 {RATIOS.map(r => {
                                     const Icon = r.icon;
                                     return (
                                        <button 
                                            key={r.id}
                                            onClick={() => {triggerSelection(); setAspectRatio(r.id)}}
                                            className={`flex items-center justify-center rounded-xl border transition-all ${aspectRatio === r.id ? 'bg-[#FFD400] text-black border-[#FFD400]' : 'bg-[#15151A] text-[#A0A0A0] border-[#24242A]'}`}
                                        >
                                            <Icon size={14} />
                                        </button>
                                     )
                                 })}
                             </div>
                         </div>
                    </div>
                </div>

                {/* Inputs */}
                <div className="space-y-4 animate-fade-in">
                    
                    {mode === 'image' && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Изображение (Обязательно)</label>
                            {!image ? (
                                <div 
                                    onClick={() => handleUploadClick('image')}
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
                                        <button onClick={() => handleUploadClick('image')} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold backdrop-blur-md border border-white/10">Заменить</button>
                                        <button onClick={clearImage} className="bg-[#2A1515] text-[#FF4D4D] p-1.5 rounded-lg border border-[#441111]"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">
                            {mode === 'image' ? 'Промпт (Опционально)' : 'Текстовый Промпт'}
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            maxLength={5000}
                            placeholder="Опишите сцену, персонажей, движение камеры, освещение и звук..."
                            className="w-full h-28 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-sm leading-relaxed"
                        />
                         <div className="flex justify-between px-1">
                             <span className="text-[10px] text-[#FFD400] flex items-center gap-1">
                                <Mic size={10} /> Поддерживается описание звука
                             </span>
                            <span className="text-[10px] text-[#505055] font-mono">{prompt.length}/5000</span>
                        </div>
                    </div>

                    {/* Advanced Camera Controls */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-[#A0A0A0] uppercase tracking-wider ml-1">Кино-камера</label>
                        <div className="grid grid-cols-5 gap-2">
                            <button onClick={() => toggleCamera('pan')} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${camera.pan ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                <Move size={16} /> <span className="text-[9px] font-bold">Pan</span>
                            </button>
                            <button onClick={() => toggleCamera('tilt')} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${camera.tilt ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                <ArrowUp size={16} /> <span className="text-[9px] font-bold">Tilt</span>
                            </button>
                            <button onClick={() => toggleCamera('zoom')} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${camera.zoom ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                <Maximize size={16} /> <span className="text-[9px] font-bold">Zoom</span>
                            </button>
                            <button onClick={() => toggleCamera('dolly')} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${camera.dolly ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                <ArrowRight size={16} /> <span className="text-[9px] font-bold">Dolly</span>
                            </button>
                            <button onClick={() => toggleCamera('rackFocus')} className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${camera.rackFocus ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                <Focus size={16} /> <span className="text-[9px] font-bold">Focus</span>
                            </button>
                        </div>
                    </div>

                    {/* Audio Uploads */}
                    <div className="space-y-3 bg-[#15151A] border border-[#24242A] p-3 rounded-xl">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-wider flex items-center gap-1">
                                <Volume2 size={10} /> Аудио дорожки
                            </h4>
                            <span className="text-[9px] text-[#505055]">Авто-синхронизация</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {/* Voiceover */}
                            <button 
                                onClick={(e) => audioFiles.voice ? clearAudio('voice', e) : handleUploadClick('voice')}
                                className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${audioFiles.voice ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055] hover:text-white'}`}
                            >
                                {audioFiles.voice ? <Check size={18} /> : <Mic size={18} />}
                                <span className="text-[9px] font-bold">Голос</span>
                            </button>

                            {/* Music */}
                            <button 
                                onClick={(e) => audioFiles.music ? clearAudio('music', e) : handleUploadClick('music')}
                                className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${audioFiles.music ? 'bg-pink-500/20 border-pink-500 text-pink-400' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055] hover:text-white'}`}
                            >
                                {audioFiles.music ? <Check size={18} /> : <Music size={18} />}
                                <span className="text-[9px] font-bold">Музыка</span>
                            </button>

                            {/* SFX */}
                            <button 
                                onClick={(e) => audioFiles.sfx ? clearAudio('sfx', e) : handleUploadClick('sfx')}
                                className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${audioFiles.sfx ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#0B0B0E] border-[#24242A] text-[#505055] hover:text-white'}`}
                            >
                                {audioFiles.sfx ? <Check size={18} /> : <Volume2 size={18} />}
                                <span className="text-[9px] font-bold">SFX</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Cost Preview */}
                <div className="bg-[#15151A] border border-[#24242A] rounded-2xl p-4 space-y-3">
                     <div className="flex justify-between items-center text-xs">
                         <span className="text-[#A0A0A0]">Тариф</span>
                         <span className="font-mono text-[#A0A0A0]">
                             {resolution} ({RESOLUTIONS.find(r=>r.id===resolution)?.multiplier}x)
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
                     
                     <div className="flex items-center gap-2 text-indigo-400 text-[10px] bg-indigo-950/20 p-2 rounded-lg border border-indigo-500/20">
                        <AlertTriangle size={12} />
                        <span>Генерация с физикой и аудио может занять больше времени.</span>
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
                            Генерация Wan 2.5...
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