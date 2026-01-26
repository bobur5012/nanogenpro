import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Image as ImageIcon, Video, ArrowUpCircle, Wand2, Upload, Square, Smartphone, Monitor, Clock, Zap, AlertCircle, Info, Lock, Coins, Loader2, Gem, X } from 'lucide-react';
import { Button } from '../components/Button';
import { CreateMode, CreateViewParams } from '../types';
import * as Sim from '../utils/simulation';
import { triggerHaptic, triggerNotification, triggerSelection } from '../utils/haptics';

interface CreateViewProps {
  onBack: () => void;
  userCredits: number;
  initialMode?: CreateMode;
  initialParams?: Partial<CreateViewParams>;
}

const RATIOS = [
  { id: '1:1', label: '1:1', name: 'Квадрат', icon: Square },
  { id: '9:16', label: '9:16', name: 'Story', icon: Smartphone },
  { id: '16:9', label: '16:9', name: 'Cinema', icon: Monitor },
];

const STYLES = [
    { id: 'realistic', label: '📸 Фотореализм', prompt: ', photorealistic, 8k, highly detailed, cinematic lighting' },
    { id: 'anime', label: '🌸 Аниме', prompt: ', anime style, studio ghibli, vibrant colors' },
    { id: 'cyberpunk', label: '🤖 Cyberpunk', prompt: ', cyberpunk, neon lights, futuristic, dark atmosphere' },
    { id: '3d', label: '🧸 3D Render', prompt: ', 3d render, clay style, isometric, blender' },
    { id: 'oil', label: '🎨 Масло', prompt: ', oil painting, textured, classic art' },
];

const EXCHANGE_RATE = 1000;

// Image Pricing
const IMG_PRICE = { HD: 2, FullHD: 4 };
// Enhance Pricing
const ENHANCE_PRICE = { x2: 2, x4: 4 };

// Video Pricing
type VideoDuration = '3s' | '5s' | '10s' | '20s';
type VideoType = 'fast' | 'cinema' | 'premium';

const VIDEO_MATRIX: Record<VideoType, Record<VideoDuration, number | null>> = {
    fast: { '3s': 4, '5s': 7, '10s': 13, '20s': 25 },
    cinema: { '3s': null, '5s': 12, '10s': 22, '20s': 40 },
    premium: { '3s': null, '5s': 50, '10s': null, '20s': null },
};

const VIDEO_QUALITY_MULTIPLIER = { '720p': 1, '1080p': 1.5 };

export const CreateView: React.FC<CreateViewProps> = ({ 
    onBack, 
    userCredits, 
    initialMode = 'image', 
    initialParams = {} as Partial<CreateViewParams> 
}) => {
  const [activeTab, setActiveTab] = useState<CreateMode>(initialMode);
  
  // Image State
  const [imagePrompt, setImagePrompt] = useState(initialParams.initialPrompt || '');
  const [magicPrompt, setMagicPrompt] = useState(initialParams.magicPrompt || false);
  const [imageRatio, setImageRatio] = useState(RATIOS[0].id);
  const [imageQuality, setImageQuality] = useState<'HD' | 'FullHD'>('HD');
  
  // Video State
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoDuration, setVideoDuration] = useState<VideoDuration>('5s');
  const [videoQuality, setVideoQuality] = useState<'720p' | '1080p'>('720p');
  const [videoType, setVideoType] = useState<VideoType>('fast');
  
  // Enhance State
  const [enhanceScale, setEnhanceScale] = useState<'x2' | 'x4'>('x2');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Sync tab if props change
  useEffect(() => {
    if (initialMode) setActiveTab(initialMode);
    if (initialParams.initialPrompt) setImagePrompt(initialParams.initialPrompt);
    if (initialParams.magicPrompt !== undefined) setMagicPrompt(initialParams.magicPrompt);
  }, [initialMode, initialParams]);

  const handleTabChange = (mode: CreateMode) => {
      triggerSelection();
      setActiveTab(mode);
  };

  const handleStyleClick = (stylePrompt: string) => {
      triggerHaptic('light');
      setImagePrompt((prev) => {
          if (prev.includes(stylePrompt)) return prev;
          return prev + stylePrompt;
      });
  };

  const handleVideoTypeChange = (newType: VideoType) => {
      triggerSelection();
      setVideoType(newType);
      const isCurrentDurationAllowed = VIDEO_MATRIX[newType][videoDuration] !== null;
      if (!isCurrentDurationAllowed) {
          const allowedDuration = (['3s', '5s', '10s', '20s'] as VideoDuration[]).find(
              d => VIDEO_MATRIX[newType][d] !== null
          );
          if (allowedDuration) setVideoDuration(allowedDuration);
      }
  };

  const cost = useMemo(() => {
    if (activeTab === 'image') return IMG_PRICE[imageQuality];
    if (activeTab === 'enhance') return ENHANCE_PRICE[enhanceScale];
    if (activeTab === 'video') {
      const baseCost = VIDEO_MATRIX[videoType][videoDuration];
      if (baseCost === null) return 0;
      return Math.ceil(baseCost * VIDEO_QUALITY_MULTIPLIER[videoQuality]);
    }
    return 0;
  }, [activeTab, imageQuality, videoDuration, videoQuality, videoType, enhanceScale]);

  const canAfford = userCredits >= cost;
  const isVideoStateValid = activeTab !== 'video' || VIDEO_MATRIX[videoType][videoDuration] !== null;
  
  const showNativePopup = (title: string, message: string) => {
      const tg = window.Telegram?.WebApp;
      if (tg && tg.showPopup && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
          tg.showPopup({
              title,
              message,
              buttons: [{ type: 'ok' }]
          });
      } else {
          alert(`${title}\n${message}`);
      }
  };

  const handleSubmit = () => {
    if (!canAfford) {
      triggerNotification('error');
      showNativePopup("Ошибка", "Пожалуйста, пополните баланс.");
      return;
    }
    
    // Validations
    if (activeTab === 'image' && !imagePrompt.trim()) {
        triggerNotification('error');
        return;
    }
    if (activeTab === 'video' && (!videoPrompt.trim() || !isVideoStateValid)) {
        triggerNotification('error');
        return;
    }
    if (activeTab === 'enhance' && !uploadedImage) {
        triggerNotification('error');
        showNativePopup("Ошибка", "Загрузите изображение");
        return;
    }

    // Prepare Details String
    let details = '';
    let prompt = '';
    
    if (activeTab === 'image') {
        details = `${imageQuality}, ${imageRatio}, Magic: ${magicPrompt ? 'ON' : 'OFF'}`;
        prompt = imagePrompt;
    } else if (activeTab === 'video') {
        details = `${videoType.toUpperCase()} ${videoDuration}, ${videoQuality}`;
        prompt = videoPrompt;
    } else {
        details = `Upscale ${enhanceScale}`;
        prompt = "Enhance Image";
    }

    triggerNotification('success');

    // Create Job via Sim Service
    const job = Sim.createJob(activeTab, cost, prompt, details);
    
    if (job) {
        if (activeTab === 'video') {
             showNativePopup("В очереди", `Видео добавлено в обработку! Списано ${cost} CR. Ожидайте уведомление от бота.`);
        } else {
             // For images, we can just close or show success. 
             // Since simulation is instant for images, let's just go back.
        }
        onBack();
    } else {
        showNativePopup("Ошибка", "Не удалось создать задачу. Попробуйте позже.");
    }
  };

  const handleUpload = () => {
      triggerHaptic('medium');
      setUploadedImage("mock_url");
  };

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0E] animate-slide-in z-50 fixed inset-0">
      {/* Header with Tabs */}
      <div className="bg-[#15151A] border-b border-[#24242A] shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
            <button 
                onClick={onBack}
                className="p-2 -ml-2 text-[#A0A0A0] hover:text-white transition-colors"
            >
                <ChevronLeft size={24} />
            </button>
            
            <div className="bg-[#15151A] px-3 py-1.5 rounded-full border border-[#24242A] flex items-center gap-2 shadow-sm">
                <Gem size={14} className="text-[#3B82F6]" fill="#3B82F6" fillOpacity={0.2} />
                <span className={`text-sm font-bold tracking-wide ${userCredits < cost ? 'text-[#FF4D4D]' : 'text-white'}`}>
                    {userCredits}
                </span>
            </div>
        </div>
        
        <div className="flex px-4 pb-0 space-x-4 overflow-x-auto scrollbar-hide">
            <TabButton active={activeTab === 'image'} onClick={() => handleTabChange('image')} label="Картинка" icon={ImageIcon} />
            <TabButton active={activeTab === 'video'} onClick={() => handleTabChange('video')} label="Видео" icon={Video} />
            <TabButton active={activeTab === 'enhance'} onClick={() => handleTabChange('enhance')} label="Улучшение" icon={ArrowUpCircle} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-6 scrollbar-hide pb-40 bg-[#0B0B0E]">
        
        {/* --- IMAGE TAB --- */}
        {activeTab === 'image' && (
            <div className="space-y-6 animate-fade-in">
                 <div onClick={handleUpload} className={`w-full h-24 border border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${uploadedImage ? 'border-[#FFD400] bg-[#FFD400]/5' : 'border-[#24242A] bg-[#15151A] text-[#A0A0A0] hover:border-[#FFD400]'}`}>
                    {uploadedImage ? <div className="flex items-center gap-2 text-[#FFD400]"><ImageIcon size={20} /><span className="text-xs font-bold">Изображение загружено</span></div> : <><Upload size={20} /><span className="text-xs font-medium">Референс (опционально)</span></>}
                </div>
                
                {/* Prompt Section with Styles */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-white">Промпт</label>
                        <button onClick={() => { triggerSelection(); setMagicPrompt(!magicPrompt); }} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${magicPrompt ? 'bg-[#FFD400]/10 border-[#FFD400] text-[#FFD400]' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                            <Wand2 size={12} /> Magic {magicPrompt ? 'ON' : 'OFF'}
                        </button>
                    </div>
                    
                    {/* Style Chips */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        {STYLES.map(style => (
                            <button 
                                key={style.id} 
                                onClick={() => handleStyleClick(style.prompt)}
                                className={`px-3 py-1.5 rounded-lg border border-[#24242A] bg-[#15151A] text-[11px] font-bold whitespace-nowrap hover:bg-[#24242A] hover:border-[#FFD400] transition-colors ${imagePrompt.includes(style.prompt) ? 'border-[#FFD400] text-[#FFD400]' : 'text-[#A0A0A0]'}`}
                            >
                                {style.label}
                            </button>
                        ))}
                    </div>

                    <textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} placeholder="Опишите детально, что хотите увидеть..." className="w-full h-32 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-base leading-relaxed" />
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                     <div className="space-y-3">
                        <label className="text-sm font-bold text-white">Формат</label>
                        <div className="grid grid-cols-3 gap-3">
                            {RATIOS.map((ratio) => {
                                const Icon = ratio.icon;
                                return (
                                    <button key={ratio.id} onClick={() => { triggerSelection(); setImageRatio(ratio.id); }} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${imageRatio === ratio.id ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                        <Icon size={18} className="mb-2" />
                                        <span className="text-[10px] font-bold">{ratio.name}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-white">Качество</label>
                        <div className="flex gap-3">
                            {['HD', 'FullHD'].map((q) => (
                                <button key={q} onClick={() => { triggerSelection(); setImageQuality(q as any); }} className={`flex-1 p-3 rounded-xl border font-bold text-sm transition-all ${imageQuality === q ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                    {q} <span className="text-[10px] opacity-70 ml-1">{IMG_PRICE[q as keyof typeof IMG_PRICE]} CR</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- VIDEO TAB --- */}
        {activeTab === 'video' && (
            <div className="space-y-6 animate-fade-in">
                 <div className="bg-[#15151A] p-4 rounded-xl border border-[#24242A] flex gap-3">
                    <AlertCircle className="text-[#FFD400] min-w-[20px]" size={20} />
                    <p className="text-xs text-[#A0A0A0] leading-relaxed">
                        Видео генерируются асинхронно (1-2 мин). Результат придет в Telegram-бот.
                    </p>
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-bold text-white">Сценарий видео</label>
                    <textarea value={videoPrompt} onChange={(e) => setVideoPrompt(e.target.value)} placeholder="Опишите, что происходит в видео..." className="w-full h-24 bg-[#15151A] border border-[#24242A] rounded-2xl p-4 text-white placeholder-[#505055] focus:border-[#FFD400] focus:outline-none transition-all resize-none text-base leading-relaxed" />
                </div>
                <div className="space-y-3">
                     <label className="text-sm font-bold text-white">Тип генерации</label>
                     <div className="grid grid-cols-3 gap-2 bg-[#15151A] p-1 rounded-2xl border border-[#24242A]">
                        {[{ id: 'fast', label: '🚀 Быстро' }, { id: 'cinema', label: '🎥 Кино' }, { id: 'premium', label: '💎 Премиум' }].map((t) => (
                             <button key={t.id} onClick={() => handleVideoTypeChange(t.id as VideoType)} className={`py-2.5 rounded-xl font-bold text-xs transition-all ${videoType === t.id ? 'bg-[#FFD400] text-black shadow-md' : 'text-[#A0A0A0] hover:text-white'}`}>
                                {t.label}
                            </button>
                        ))}
                     </div>
                </div>
                <div className="space-y-3">
                     <label className="text-sm font-bold text-white">Длительность</label>
                     <div className="grid grid-cols-4 gap-2">
                        {(['3s', '5s', '10s', '20s'] as VideoDuration[]).map((d) => {
                            const isAllowed = VIDEO_MATRIX[videoType][d] !== null;
                            return (
                             <button key={d} onClick={() => { if(isAllowed) { triggerSelection(); setVideoDuration(d); }}} disabled={!isAllowed} className={`py-3 rounded-xl text-sm font-bold transition-all border flex items-center justify-center ${videoDuration === d && isAllowed ? 'bg-[#FFD400] border-[#FFD400] text-black' : isAllowed ? 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]' : 'bg-[#1A1A1F] border-transparent text-[#2A2A30] cursor-not-allowed opacity-50'}`}>
                                {d}
                            </button>
                        )})}
                     </div>
                </div>
                 <div className="space-y-3">
                     <label className="text-sm font-bold text-white">Качество</label>
                     <div className="grid grid-cols-2 gap-3">
                        {[{ id: '720p', label: '720p (HD)' }, { id: '1080p', label: '1080p (Full HD)' }].map((q) => (
                             <button key={q.id} onClick={() => { triggerSelection(); setVideoQuality(q.id as any); }} className={`py-3 rounded-xl border text-sm font-bold transition-all flex justify-between px-4 items-center ${videoQuality === q.id ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}>
                                <span>{q.label}</span>
                                {q.id === '1080p' && <span className="text-[10px] opacity-60">×1.5</span>}
                            </button>
                        ))}
                     </div>
                </div>
                <div className="bg-[#15151A] rounded-xl border border-[#24242A] p-4 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <span className="text-[#A0A0A0] text-sm">Стоимость:</span>
                        <div className="flex items-center gap-2">
                             <Coins size={14} className="text-[#FFD400]" />
                             <span className="text-white font-bold">{cost} CR</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- ENHANCE TAB --- */}
        {activeTab === 'enhance' && (
            <div className="space-y-6 animate-fade-in">
                 <div onClick={handleUpload} className={`w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${uploadedImage ? 'border-[#FFD400] bg-[#FFD400]/5' : 'border-[#24242A] bg-[#15151A] text-[#A0A0A0] hover:border-[#FFD400]'}`}>
                    {uploadedImage ? <div className="flex flex-col items-center gap-2 text-[#FFD400]"><ImageIcon size={32} /><span className="font-bold">Изображение выбрано</span></div> : <><Upload size={32} /><span className="font-bold">Загрузить изображение</span></>}
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-bold text-white">Увеличение</label>
                    <div className="grid grid-cols-2 gap-4">
                         <button onClick={() => { triggerSelection(); setEnhanceScale('x2'); }} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${enhanceScale === 'x2' ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}><span className="font-bold text-xl">x2</span><span className="text-xs opacity-70">2 CR</span></button>
                         <button onClick={() => { triggerSelection(); setEnhanceScale('x4'); }} className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${enhanceScale === 'x4' ? 'bg-[#FFD400] border-[#FFD400] text-black' : 'bg-[#15151A] border-[#24242A] text-[#A0A0A0]'}`}><span className="font-bold text-xl">x4</span><span className="text-xs opacity-70">4 CR</span></button>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0B0B0E] border-t border-[#24242A] p-5 shrink-0 safe-area-bottom">
        <div className="space-y-3">
             <Button 
                fullWidth 
                onClick={handleSubmit}
                className={!canAfford ? 'opacity-50' : (activeTab === 'image' && !imagePrompt) || (activeTab === 'video' && (!videoPrompt || !isVideoStateValid)) || (activeTab === 'enhance' && !uploadedImage) ? 'opacity-50 cursor-not-allowed' : ''}
            >
                <div className="flex items-center justify-between w-full px-2">
                    <span>{canAfford ? 'Сгенерировать' : 'Недостаточно средств'}</span>
                    <span className="block text-sm font-bold">{cost} CR</span>
                </div>
            </Button>
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon: Icon }: any) => (
    <button onClick={onClick} className={`flex items-center gap-2 pb-3 px-2 border-b-2 transition-colors whitespace-nowrap ${active ? 'border-[#FFD400] text-white' : 'border-transparent text-[#A0A0A0] hover:text-white'}`}>
        <Icon size={18} className={active ? "text-[#FFD400]" : ""} />
        <span className={`font-bold text-sm ${active ? "text-white" : ""}`}>{label}</span>
    </button>
);