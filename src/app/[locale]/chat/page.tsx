"use client";

import { use, useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Volume2, VolumeX, Loader2, Mic, MicOff, Send, CheckCircle2, Languages } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "ai";
}

type Language = "en" | "hi" | "bn";
type Status = "ready" | "listening" | "processing" | "thinking" | "speaking";

export default function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale as Language;

  const t = useTranslations("Chat");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Language>(locale || "en");
  const [status, setStatus] = useState<Status>("ready");
  const [isSpeakingId, setIsSpeakingId] = useState<number | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  // Audio Queue refs with prefetch
  const audioCache = useRef(new Map<string, Promise<string>>());
  const sentenceQueue = useRef<string[]>([]);
  const isPlaying = useRef(false);
  const currentLangRef = useRef<string>('en');

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // Cleanup object URLs
      audioCache.current.forEach(async (promise) => {
        try {
          const url = await promise;
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    };
  }, []);

  const placeholders = {
    en: "Ask anything about college...",
    hi: "कॉलेज के बारे में कुछ भी पूछें...",
    bn: "কলেজ সম্পর্কে যেকোনো কিছু জিজ্ঞাসা করুন...",
  };

  /**
   * Prefetch system for smooth playback
   */
  async function fetchAudioBlob(text: string, lang: string) {
    const key = text + lang;
    if (audioCache.current.has(key)) return audioCache.current.get(key)!;
    
    const promise = fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: lang })
    })
    .then(r => {
      if (!r.ok) throw new Error("TTS failed");
      return r.blob();
    })
    .then(blob => URL.createObjectURL(blob));
    
    audioCache.current.set(key, promise);
    return promise;
  }

  async function startAudioQueue(sentences: string[], lang: string, messageId: number) {
    sentenceQueue.current.length = 0;
    sentenceQueue.current.push(...sentences);
    currentLangRef.current = lang;
    
    // Prefetch first 3 sentences immediately
    sentences.slice(0, 3).forEach(s => 
      fetchAudioBlob(s, lang)
    );
    
    if (!isPlaying.current) playNext(lang, messageId);
  }

  async function playNext(lang: string, messageId: number) {
    if (sentenceQueue.current.length === 0) {
      isPlaying.current = false;
      setIsSpeakingId(null);
      setStatus("ready");
      return;
    }

    isPlaying.current = true;
    setIsSpeakingId(messageId);
    setStatus("speaking");
    
    const sentence = sentenceQueue.current.shift()!;
    
    // Prefetch next sentence while current loads
    if (sentenceQueue.current.length > 0) {
      fetchAudioBlob(sentenceQueue.current[0], lang);
    }
    
    try {
      const url = await fetchAudioBlob(sentence, lang);
      const audio = new Audio(url);
      audioRef.current = audio;
      
      audio.onended = () => playNext(lang, messageId);
      audio.onerror = () => playNext(lang, messageId);
      await audio.play();
    } catch (error) {
      console.error("Playback error:", error);
      playNext(lang, messageId);
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    sentenceQueue.current = [];
    isPlaying.current = false;
    setIsSpeakingId(null);
    setStatus("ready");
  };

  /**
   * Smart Voice Flow
   */
  const startRecording = async () => {
    try {
      stopAudio(); // Stop any playing audio before recording
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleSmartSTT(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setStatus("listening");

    } catch (error) {
      console.error("Recording Error:", error);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setStatus("processing");
    }
  };

  const handleSmartSTT = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append("file", blob);
      formData.append("hint", selectedLang); // Use current toggle as hint

      const response = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("STT failed");

      const data = await response.json();
      if (data.transcript) {
        setInput(data.transcript);
        
        // AUTO LANGUAGE DETECTION update toggle
        if (data.detectedLanguage && data.detectedLanguage !== selectedLang) {
          setSelectedLang(data.detectedLanguage);
        }

        // AUTO SUBMIT
        await sendMessage(data.transcript, data.detectedLanguage || selectedLang);
      } else {
        setStatus("ready");
      }
    } catch (error) {
      console.error("STT Error:", error);
      setStatus("ready");
    }
  };

  const sendMessage = async (overrideInput?: string, overrideLang?: Language) => {
    const textToSend = overrideInput || input;
    const langToUse = overrideLang || selectedLang;
    
    if (textToSend.trim() === "" || loading) return;

    // Clear UI state
    stopAudio();
    const userMessage: Message = { id: Date.now(), text: textToSend, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setStatus("thinking");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, language: langToUse }),
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();
      const aiMessage: Message = { id: Date.now() + 1, text: data.response, sender: "ai" };
      setMessages((prev) => [...prev, aiMessage]);

      // AUTO SPEAK with prefetch
      const sentences = data.response
        .split(/(?<=[.!?।])\s+/)
        .filter((s: string) => s.trim().length > 5);
      startAudioQueue(sentences, langToUse, aiMessage.id);
      
    } catch (error) {
      console.error("Chat Error:", error);
      const errorMessage: Message = {
        id: Date.now() + 1,
        text: "Sorry, I couldn't process that. Please try again.",
        sender: "ai",
      };
      setMessages((prev) => [...prev, errorMessage]);
      setStatus("ready");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  // Helper for Status indicator
  const getStatusConfig = () => {
    switch (status) {
      case "listening": return { text: "Listening...", color: "bg-red-500", icon: <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> };
      case "processing": return { text: "Processing...", color: "bg-yellow-500", icon: <Loader2 size={14} className="animate-spin text-yellow-500" /> };
      case "thinking": return { text: "Thinking...", color: "bg-blue-500", icon: <Loader2 size={14} className="animate-spin text-blue-500" /> };
      case "speaking": return { text: "Speaking...", color: "bg-green-500", icon: <div className="w-2 h-2 rounded-full bg-green-500 animate-bounce" /> };
      default: return { text: "Ready", color: "bg-gray-400", icon: <div className="w-2 h-2 rounded-full bg-gray-400" /> };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-gray-50">
      <header className="py-4 border-b flex justify-between items-center bg-white px-4 rounded-t-xl shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-800">College AI</h1>
          {/* Status Indicator Bar */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {statusConfig.icon}
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
              {statusConfig.text}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
            {[
              { id: "en", label: "EN" },
              { id: "hi", label: "हिं" },
              { id: "bn", label: "বাং" }
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => {
                  setSelectedLang(lang.id as Language);
                  stopAudio();
                }}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  selectedLang === lang.id ? "bg-black text-white shadow-sm" : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto py-6 space-y-4 px-2 scroll-smooth">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${ message.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`relative group max-w-[85%] ${message.sender === "user" ? "flex flex-row-reverse" : "flex flex-row"}`}>
              <div
                className={`p-4 rounded-2xl shadow-sm ${
                  message.sender === "user" 
                    ? "bg-black text-white rounded-tr-none" 
                    : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                }`}
              >
                <p className="text-sm leading-relaxed">{message.text}</p>
              </div>
              
              {message.sender === "ai" && (
                <div className="flex items-end mb-1">
                  <button
                    onClick={() => {
                      if (isSpeakingId === message.id) {
                        stopAudio();
                      } else {
                        stopAudio();
                        const sentences = message.text
                          .split(/(?<=[.!?।])\s+/)
                          .filter((s: string) => s.trim().length > 5);
                        startAudioQueue(sentences, selectedLang, message.id);
                      }
                    }}
                    className={`ml-2 p-2 rounded-full transition-all ${
                      isSpeakingId === message.id 
                        ? "bg-red-50 text-red-500 scale-110" 
                        : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {isSpeakingId === message.id ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && status === "thinking" && (
          <div className="flex justify-start">
            <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-gray-400 text-sm italic">Thinking...</span>
            </div>
          </div>
        )}
        {!messages.length && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-60">
            <div className="bg-white p-8 rounded-full shadow-sm border border-gray-100 relative">
              <Languages className="w-12 h-12 text-gray-300" />
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white" />
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 font-medium">Hello! How can I help you today?</p>
              <p className="text-gray-400 text-sm">Speak or type your question in any language.</p>
            </div>
          </div>
        )}
      </div>
      
      <footer className="py-4 bg-gray-50">
        <div className="relative flex items-center gap-2">
          {/* MIC BUTTON */}
          <button
            onClick={status === "listening" ? stopRecording : startRecording}
            className={`p-5 rounded-2xl shadow-lg transition-all transform active:scale-95 ${
              status === "listening" 
                ? "bg-red-500 text-white ring-4 ring-red-100 animate-pulse" 
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {status === "listening" ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={placeholders[selectedLang]}
              className="w-full p-5 pr-14 rounded-2xl border border-gray-200 bg-white focus:ring-2 focus:ring-black outline-none shadow-sm transition-all"
              onKeyDown={handleKeyPress}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status === "listening" || status === "processing"}
            />
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-xl disabled:opacity-30 transition-all hover:bg-gray-800"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || status === "listening"}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
        
        {/* Subtle hint text */}
        <div className="mt-3 flex justify-center">
           <p className="text-[10px] text-gray-400 flex items-center gap-1">
             <CheckCircle2 size={10} /> 
             Smart language detection active
           </p>
        </div>
      </footer>
    </div>
  );
}
