"use client";
import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type { UIMessage } from "ai";
import { AppSidebar } from "../components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TelegramConnect } from "@/components/ui/TelegramConnect";
import { GoogleCalendarConnect } from "@/components/ui/GoogleCalendarConnect";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useParams } from "next/navigation";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input";
import {
  ArrowUp,
  AudioLines,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Square,
} from "lucide-react";
import { useUserInfo } from "@/hooks/useUserInfo";
import { useLocation } from "@/hooks/useLocation";
import { cn } from "@/lib/utils";
import { useKeyVault } from "@/components/ui/useKeyVault";
import { KeyManagerDialog } from "@/components/ui/KeyManager";
import { AIMode, ModeToggle } from "@/components/ui/ModeToggle";
import { parseModelValue } from "@/components/ui/models";
import { ModelCombobox } from "@/components/ui/ModelSelect";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import removeMarkdown from "remove-markdown";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { VoiceOrb } from "@/components/ui/voice-orb";
import { WriteCommitStateMap } from "../components/chatComp/writeSqlCards";
import { ChatTimeline } from "../components/chatComp/chatTimeline";
import { TokenUsageDialog } from "../components/chatComp/tokenUsage";
import { NewChat } from "../components/chatComp/newChat";



type SpeechOutputProvider = "browser" | "elevenlabs";


function getMessageText(message: any): string {
  if (!message?.parts) return "";

  return message.parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("");
}

function removeToolResults(messages: UIMessage[]) {
  return messages.map((msg) => ({
    ...msg,
    parts: (Array.isArray(msg.parts) ? msg.parts : []).filter(
      (part: any) => {
        if (typeof part.type !== "string") return true;

        const isTool = part.type.startsWith("tool-");
        const isAllowed =
          part.type === "tool-read_sql" ||
          part.type === "tool-schema_info" ||
          part.type === "tool-present_data" ||
          part.type === "tool-execute_preview_write_sql" ||
          part.type === "tool-execute_write_sql";

        return !(isTool && !isAllowed);
      }
    ),
  }));
}

const VOICE_ASSISTANT_STORAGE_PREFIX = "voice-assistant-chat:";

// Stores the most recently opened chat id so we don't need to pass it around manually.
const LAST_CHAT_ID_STORAGE_KEY = "pixie:lastChatId";

function getVoiceAssistantStorageKey(chatId: string) {
  return `${VOICE_ASSISTANT_STORAGE_PREFIX}${chatId}`;
}

function loadVoiceAssistantPreference(chatId: string) {
  if (typeof window === "undefined" || !chatId || chatId === "new") {
    return false;
  }

  return localStorage.getItem(getVoiceAssistantStorageKey(chatId)) === "1";
}

function saveVoiceAssistantPreference(chatId: string, value: boolean) {
  if (typeof window === "undefined" || !chatId || chatId === "new") {
    return;
  }

  localStorage.setItem(getVoiceAssistantStorageKey(chatId), value ? "1" : "0");
}

function getSupportedAudioMimeType() {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) {
    return "";
  }

  const mimeTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
  ];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

async function loadChatFromDB(chatId: string) {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    credentials: "include",
  });
  if (!res.ok) return [];

  const dbMessages = await res.json();

  // Transform DB rows -> useChat message format
  return dbMessages.map((m: any) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
  }));
}

async function saveTurnToDB(
  user: any,
  assistant: any,
  chatId: string,
  isFirstTurn: boolean,
  isRegenerate: boolean = false,
) {
  await fetch("/api/messages", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      user_parts: user?.parts ?? null,
      assistant_parts: assistant.parts,
      is_first_turn: isFirstTurn,
      is_regenerate: isRegenerate,
    }),
  });
}

export default function Page() {
  const params = useParams();
  const chatId = params.id as string;

  const router = useRouter();
  const { user, loading } = useUserInfo();
  const { keys } = useKeyVault();
  const { location: currentLocation, error: locationError, loading: locationLoading, requestLocation } = useLocation();

  const [mode, setMode] = useState<AIMode>("server-key");
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-flash");
  const [chatList, setChatList] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastSentTranscript, setLastSentTranscript] = useState("");
  const [speechOutputProvider, setSpeechOutputProvider] =
    useState<SpeechOutputProvider>("browser");
  const [activeOutputAudioElement, setActiveOutputAudioElement] =
    useState<HTMLAudioElement | null>(null);
  const [voiceAssistantEnabled, setVoiceAssistantEnabled] = useState(false);
  const [voiceSidebarOpen, setVoiceSidebarOpen] = useState(true);
  const [voiceSidebarExpanded, setVoiceSidebarExpanded] = useState(false);
  const [writeCommitState, setWriteCommitState] = useState<WriteCommitStateMap>({});
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const useServerSpeechRecognitionRef = useRef(true);
  const speechQueueRef = useRef<Array<{ messageId: string; text: string }>>([]);
  const isSpeechActiveRef = useRef(false);
  const spokenCursorByMessageRef = useRef<Record<string, number>>({});
  const rawAssistantLengthByMessageRef = useRef<Record<string, number>>({});
  const speechPermissionToastShownRef = useRef(false);
  const finalVoiceTranscriptRef = useRef("");
  const recognitionHadErrorRef = useRef(false);
  const shouldSkipInitialVoicePlaybackRef = useRef(chatId !== "new");
  const isRegeneratingRef = useRef(false);
  const modeRef = useRef(mode);
  const selectedModelRef = useRef(selectedModel);
  const speechOutputProviderRef = useRef<SpeechOutputProvider>(speechOutputProvider);
  const voiceAssistantEnabledRef = useRef(voiceAssistantEnabled);
  const elevenLabsAudioRef = useRef<HTMLAudioElement | null>(null);
  const elevenLabsAbortControllerRef = useRef<AbortController | null>(null);
  const elevenLabsObjectUrlRef = useRef<string | null>(null);
  const sendRef = useRef(
    async (
      _message?: string,
      _modelIdOvr?: string,
      _modeOvr?: AIMode,
      _voiceAssistantOvr?: boolean,
    ) => {},
  );

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    speechOutputProviderRef.current = speechOutputProvider;
  }, [speechOutputProvider]);

  useEffect(() => {
    voiceAssistantEnabledRef.current = voiceAssistantEnabled;
  }, [voiceAssistantEnabled]);

  const stopElevenLabsPlayback = useCallback(() => {
    if (elevenLabsAbortControllerRef.current) {
      elevenLabsAbortControllerRef.current.abort();
      elevenLabsAbortControllerRef.current = null;
    }

    if (elevenLabsAudioRef.current) {
      try {
        elevenLabsAudioRef.current.pause();
        elevenLabsAudioRef.current.src = "";
      } catch {
        // Ignore pause/cleanup errors from interrupted playback.
      }
      elevenLabsAudioRef.current = null;
    }

    setActiveOutputAudioElement(null);

    if (elevenLabsObjectUrlRef.current) {
      URL.revokeObjectURL(elevenLabsObjectUrlRef.current);
      elevenLabsObjectUrlRef.current = null;
    }
  }, []);

  const stopSpeechPlayback = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    stopElevenLabsPlayback();

    speechQueueRef.current = [];
    isSpeechActiveRef.current = false;
    setSpeakingId(null);
  }, [stopElevenLabsPlayback]);

  const streamSpeechWithElevenLabs = useCallback(
    async (text: string, messageId: string) => {
      if (typeof window === "undefined") {
        throw new Error("ElevenLabs playback is not available in this environment.");
      }

      const voiceId =
        process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
      const modelId =
        process.env.NEXT_PUBLIC_ELEVENLABS_MODEL_ID ?? "eleven_turbo_v2_5";

      const abortController = new AbortController();
      elevenLabsAbortControllerRef.current = abortController;

      const requestBody = JSON.stringify({
        text,
        voiceId,
        modelId,
      });

      const response = await fetch("/api/ai/voice/elevenlabs/stream", {
        method: "POST",
        signal: abortController.signal,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      if (!response.ok) {
        let message = `ElevenLabs request failed (${response.status}).`;
        try {
          const data = await response.json();
          if (typeof data?.error === "string" && data.error) {
            message = data.error;
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(message);
      }

      const audioBuffer = await response.arrayBuffer();
      if (!audioBuffer.byteLength) {
        throw new Error("ElevenLabs returned empty audio.");
      }

      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const objectUrl = URL.createObjectURL(blob);
      elevenLabsObjectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      audio.preload = "auto";
      elevenLabsAudioRef.current = audio;
      setActiveOutputAudioElement(audio);
      setSpeakingId(messageId);

      try {
        await audio.play();
      } catch {
        throw new Error("Audio autoplay was blocked. Interact with the page and try again.");
      }

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          resolve();
        };
        audio.onerror = () => {
          reject(new Error("ElevenLabs audio playback failed."));
        };
      });
    },
    [],
  );

  const playNextSpeechChunk = useCallback(() => {
    if (isSpeechActiveRef.current) return;
    if (isRecording) return;

    const next = speechQueueRef.current.shift();
    if (!next) {
      setSpeakingId(null);
      return;
    }

    if (speechOutputProviderRef.current === "elevenlabs") {
      isSpeechActiveRef.current = true;

      void (async () => {
        try {
          await streamSpeechWithElevenLabs(next.text, next.messageId);
        } catch (error: any) {
          if (!speechPermissionToastShownRef.current) {
            speechPermissionToastShownRef.current = true;
          }
          toast.error(error?.message ?? "ElevenLabs playback failed.");
        } finally {
          stopElevenLabsPlayback();
          isSpeechActiveRef.current = false;
          playNextSpeechChunk();
        }
      })();

      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.resume();
    isSpeechActiveRef.current = true;
    setSpeakingId(next.messageId);

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = "en-US";
    utterance.onend = () => {
      isSpeechActiveRef.current = false;
      playNextSpeechChunk();
    };

    utterance.onerror = (event) => {
      isSpeechActiveRef.current = false;

      if (
        (event as unknown as { error?: string })?.error === "not-allowed" &&
        !speechPermissionToastShownRef.current
      ) {
        speechPermissionToastShownRef.current = true;
        toast.error("Voice playback is blocked. Click anywhere, then try again.");
      }

      playNextSpeechChunk();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      isSpeechActiveRef.current = false;
      if (!speechPermissionToastShownRef.current) {
        speechPermissionToastShownRef.current = true;
        toast.error("Voice playback is blocked. Click anywhere, then try again.");
      }
      playNextSpeechChunk();
    }
  }, [
    isRecording,
    stopElevenLabsPlayback,
    streamSpeechWithElevenLabs,
  ]);

  const queueSpeechChunk = useCallback(
    (messageId: string, text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;

      speechQueueRef.current.push({ messageId, text: cleaned });
      if (!isSpeechActiveRef.current) {
        playNextSpeechChunk();
      }
    },
    [playNextSpeechChunk],
  );

  const queueStreamingAssistantAudio = useCallback(
    (assistantMessage: any, isFinalChunk: boolean) => {
      if (!voiceAssistantEnabled || !assistantMessage?.id) return;

      const messageId = assistantMessage.id;
      const rawText = getMessageText(assistantMessage);
      const rawLength = rawText.length;
      const previousRawLength = rawAssistantLengthByMessageRef.current[messageId] ?? -1;
      
      // Throttle parsing: only parse if we accumulated enough new chars or it's the final chunk
      if (!isFinalChunk && previousRawLength !== -1 && (rawLength - previousRawLength < 25)) {
        return;
      }

      rawAssistantLengthByMessageRef.current[messageId] = rawLength;

      const cleanedText = removeMarkdown(rawText).replace(/\s+/g, " ").trim();
      const previousCursor = spokenCursorByMessageRef.current[messageId] ?? 0;
      const safeCursor = Math.min(previousCursor, cleanedText.length);
      if (safeCursor !== previousCursor) {
        spokenCursorByMessageRef.current[messageId] = safeCursor;
      }

      if (cleanedText.length <= safeCursor) return;

      const pending = cleanedText.slice(safeCursor);

      if (isFinalChunk) {
        const finalChunk = pending.trim();
        if (!finalChunk) return;

        spokenCursorByMessageRef.current[messageId] = cleanedText.length;
        queueSpeechChunk(messageId, finalChunk);
        return;
      }

      const sentenceBoundaryRegex = /[.!?](?=\s|$)/g;
      let emittedCursor = safeCursor;
      let lastSliceStart = 0;
      let hasEmitted = false;

      for (const match of pending.matchAll(sentenceBoundaryRegex)) {
        const boundaryEnd = (match.index ?? -1) + match[0].length;
        if (boundaryEnd <= lastSliceStart) continue;

        const chunk = pending.slice(lastSliceStart, boundaryEnd).trim();
        lastSliceStart = boundaryEnd;
        if (!chunk) continue;

        hasEmitted = true;
        emittedCursor = safeCursor + boundaryEnd;
        queueSpeechChunk(messageId, chunk);
      }

      if (hasEmitted) {
        spokenCursorByMessageRef.current[messageId] = emittedCursor;
        return;
      }

      // If no boundary appears for a while, force a chunk at a word boundary.
      if (pending.length >= 180) {
        const preferred = 140;
        const splitAtSpace = pending.lastIndexOf(" ", preferred);
        const splitIndex = splitAtSpace > 60 ? splitAtSpace : preferred;
        const chunk = pending.slice(0, splitIndex).trim();
        if (!chunk) return;

        spokenCursorByMessageRef.current[messageId] = safeCursor + splitIndex;
        queueSpeechChunk(messageId, chunk);
      }
    },
    [queueSpeechChunk, voiceAssistantEnabled],
  );

  const cleanupMediaRecording = useCallback(() => {
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const handleRecognizedVoiceText = useCallback((text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    if (voiceAssistantEnabledRef.current) {
      setLastSentTranscript(trimmedText);
      setLiveTranscript("");
      void sendRef.current(trimmedText, selectedModelRef.current, modeRef.current, true);
      return;
    }

    setInput((prev) => (prev ? `${prev} ${trimmedText}` : trimmedText));
    setLiveTranscript("");
  }, []);

  const transcribeRecordedAudio = useCallback(
    async (audioBlob: Blob) => {
      if (audioBlob.size < 800) {
        setLiveTranscript("");
        toast.error("No speech detected. Try speaking a little louder.");
        return;
      }

      setLiveTranscript("Transcribing...");

      const formData = new FormData();
      const extension = audioBlob.type.includes("mp4")
        ? "mp4"
        : audioBlob.type.includes("mpeg")
          ? "mp3"
          : "webm";
      formData.append("audio", audioBlob, `voice-input.${extension}`);

      const response = await fetch("/api/ai/voice/transcribe", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Voice transcription failed.",
        );
      }

      const transcript = typeof data?.text === "string" ? data.text.trim() : "";
      if (!transcript) {
        setLiveTranscript("");
        toast.error("No speech detected. Try speaking a little louder.");
        return;
      }

      handleRecognizedVoiceText(transcript);
    },
    [handleRecognizedVoiceText],
  );

  const startServerSpeechRecognition = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof window === "undefined" ||
      !("MediaRecorder" in window)
    ) {
      toast.error("Voice input is not available in this browser.");
      return;
    }

    try {
      stopSpeechPlayback();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = mediaChunksRef.current;
        const type = recorder.mimeType || mimeType || "audio/webm";
        cleanupMediaRecording();
        setIsRecording(false);

        void transcribeRecordedAudio(new Blob(chunks, { type })).catch((error: any) => {
          setLiveTranscript("");
          toast.error(error?.message ?? "Voice transcription failed.");
        });
      };

      recorder.onerror = () => {
        cleanupMediaRecording();
        setIsRecording(false);
        setLiveTranscript("");
        toast.error("Voice recording failed. Check microphone permissions and try again.");
      };

      recorder.start();
      setIsRecording(true);
      setLiveTranscript("Listening...");
    } catch (error: any) {
      cleanupMediaRecording();
      setIsRecording(false);
      setLiveTranscript("");
      toast.error(
        error?.message ?? "Could not start voice input. Check microphone permissions.",
      );
    }
  }, [cleanupMediaRecording, stopSpeechPlayback, transcribeRecordedAudio]);

  const stopServerSpeechRecognition = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording" || recorder.state === "paused") {
      recorder.stop();
      return;
    }

    cleanupMediaRecording();
    setIsRecording(false);
  }, [cleanupMediaRecording]);

  /* Initialize Web Speech API */
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = async () => {
      stopSpeechPlayback();
      setIsRecording(true);
      setLiveTranscript("");
      finalVoiceTranscriptRef.current = "";
      recognitionHadErrorRef.current = false;
    };
    recognition.onend = () => {
      setIsRecording(false);

      const finalText = finalVoiceTranscriptRef.current.trim();
      if (
        voiceAssistantEnabledRef.current &&
        !recognitionHadErrorRef.current &&
        finalText.length > 0
      ) {
        handleRecognizedVoiceText(finalText);
      }

      finalVoiceTranscriptRef.current = "";
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        if (voiceAssistantEnabledRef.current) {
          finalVoiceTranscriptRef.current = `${finalVoiceTranscriptRef.current} ${finalTranscript}`.trim();
        } else {
          setInput((prev) => (prev + " " + finalTranscript).trim());
        }
      }

      const currentTranscript = Array.from(event.results)
        .map((result: any) => result?.[0]?.transcript ?? "")
        .join(" ")
        .trim();

      setLiveTranscript(currentTranscript || interimTranscript.trim());
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      recognitionHadErrorRef.current = true;
      setIsRecording(false);
      
      let errorMessage = "Voice input failed.";
      let shouldUseServerFallback = false;
      
      switch (event?.error) {
        case "not-allowed":
          errorMessage = "Microphone permission was blocked. Allow mic access and try again.";
          break;
        case "no-speech":
          errorMessage = "No speech detected. Try speaking a little louder.";
          break;
        case "network":
          errorMessage = "Browser speech recognition is unavailable. Switching to server transcription.";
          shouldUseServerFallback = true;
          break;
        case "service-not-allowed":
          errorMessage = "Speech recognition service is not available in your region.";
          break;
        case "bad-grammar":
          errorMessage = "Speech recognition configuration error.";
          break;
        case "language-not-supported":
          errorMessage = "The selected language is not supported for speech recognition.";
          break;
        case "aborted":
          errorMessage = "Speech recognition was cancelled.";
          break;
        default:
          errorMessage = `Voice input error: ${event?.error || "Unknown error"}`;
      }
      
      toast.error(errorMessage);

      if (shouldUseServerFallback) {
        useServerSpeechRecognitionRef.current = true;
        void startServerSpeechRecognition();
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      cleanupMediaRecording();
    };
  }, [
    cleanupMediaRecording,
    handleRecognizedVoiceText,
    startServerSpeechRecognition,
    stopSpeechPlayback,
  ]);

  const toggleVoiceInput = useCallback(() => {
    if (mediaRecorderRef.current) {
      stopServerSpeechRecognition();
      return;
    }

    if (useServerSpeechRecognitionRef.current) {
      void startServerSpeechRecognition();
      return;
    }

    if (!recognitionRef.current) {
      useServerSpeechRecognitionRef.current = true;
      void startServerSpeechRecognition();
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch {
        toast.error("Could not stop voice input.");
      }
    } else {
      try {
        stopSpeechPlayback();
        recognitionRef.current.start();
      } catch (error: any) {
        console.error("Failed to start speech recognition", error);
        toast.error(
          error?.message ?? "Could not start voice input. Check microphone permissions and internet connection."
        );
      }
    }
  }, [isRecording, startServerSpeechRecognition, stopServerSpeechRecognition, stopSpeechPlayback]);

  useEffect(() => {
    if (!isRecording && speechQueueRef.current.length > 0 && !isSpeechActiveRef.current) {
      playNextSpeechChunk();
    }
  }, [isRecording, playNextSpeechChunk]);

  useEffect(() => {
    if (chatId === "new") return;
    setVoiceAssistantEnabled(loadVoiceAssistantPreference(chatId));
  }, [chatId]);

  useEffect(() => {
    if (voiceAssistantEnabled) {
      setVoiceSidebarOpen(true);
    }
  }, [voiceAssistantEnabled]);

  useEffect(() => {
    if (!voiceSidebarOpen) {
      setVoiceSidebarExpanded(false);
    }
  }, [voiceSidebarOpen]);

  useEffect(() => {
    if (!voiceAssistantEnabled) {
      stopSpeechPlayback();
    }
  }, [stopSpeechPlayback, voiceAssistantEnabled]);

  // If user lands on /ai-assistant/new, auto-redirect to the last opened chat.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (chatId !== "new") return;

    try {
      const lastChatId = localStorage.getItem(LAST_CHAT_ID_STORAGE_KEY);
      if (!lastChatId || lastChatId === "new") return;

      router.replace(`/ai-assistant/${lastChatId}`);
    } catch {
      // ignore storage read errors
    }
  }, [chatId, router]);

  useEffect(() => {
    stopSpeechPlayback();
    spokenCursorByMessageRef.current = {};
    rawAssistantLengthByMessageRef.current = {};
    speechPermissionToastShownRef.current = false;
  }, [chatId, stopSpeechPlayback]);

  /* ---------------- AUTH GUARD ---------------- */

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  /* ---------------- CHAT HOOK ---------------- */

  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    setMessages,
    regenerate,
  } = useChat({
    id: chatId === "new" ? undefined : chatId,
    transport: new DefaultChatTransport({
      api: "/api/ai/chat",
      prepareSendMessagesRequest({ messages, id, body, trigger, messageId }) {
        return {
          body: {
            ...body,
            id,
            messages,
            trigger,
            messageId,
            currentLocation: currentLocation ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              address: currentLocation.address,
            } : undefined,
          },
        };
      },
    }),
    onFinish: async ({ messages, finishReason }) => {
      // Only save if chat succeeded and we have valid messages
      if (chatId === "new" || !finishReason) return;

      const isRegenerate = isRegeneratingRef.current;
      const assistant = messages[messages.length - 1];
      if (!assistant || !assistant.id || assistant.role !== "assistant") return;

      if (isRegenerate) {
        try {
          isRegeneratingRef.current = false;
          setIsRegenerating(false);
          await saveTurnToDB(null, assistant, chatId, false, true);
          console.log("saving regen")
        } catch (error) {
          isRegeneratingRef.current = false;
          setIsRegenerating(false);
          console.error("Failed to save regenerated assistant to DB:", error);
        }
        return;
      }

      const user = messages
        .slice(0, -1)
        .reverse()
        .find((m) => m.role === "user");

      if (!user || !user.id) return;

      try {
        await saveTurnToDB(
          user,
          assistant,
          chatId,
          messages.length === 2,
          false,
        );

        if (messages.length === 2) {
          loadChats();
        }
      } catch (error) {
        console.error("Failed to save turn to DB:", error);
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
  });

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "assistant") {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);
  useEffect(() => {
    shouldSkipInitialVoicePlaybackRef.current = chatId !== "new";
  }, [chatId]);

  useEffect(() => {
    if (!voiceAssistantEnabled || messages.length === 0) return;

    if (shouldSkipInitialVoicePlaybackRef.current) {
      shouldSkipInitialVoicePlaybackRef.current = false;
      return;
    }

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const isStreaming = status === "streaming" || status === "submitted";
    queueStreamingAssistantAudio(lastAssistant, !isStreaming);
  }, [messages, queueStreamingAssistantAudio, status, voiceAssistantEnabled]);

  /* ---------------- LOAD CHAT META + HISTORY ---------------- */

  async function init() {
    try {
      setIsLoadingHistory(true);

      // Load chat meta
      const res = await fetch(`/api/chats/${chatId}`);
      const chat = await res.json();

      setSelectedModel(chat.model_id);
      setMode(chat.mode);
      const persistedVoiceMode = loadVoiceAssistantPreference(chatId);
      setVoiceAssistantEnabled(persistedVoiceMode);

      // Load history
      const first = sessionStorage.getItem("firstMessage");

      if (first) {
        send(first, chat.model_id, chat.mode, persistedVoiceMode);
        sessionStorage.removeItem("firstMessage");
      } else {
        const history: UIMessage[] = await loadChatFromDB(chatId);
        setMessages(history);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }

  const lastLoadedChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait until chat system ready
    if (status !== "ready") return;

    // Ignore new chat placeholder
    if (chatId === "new") return;

    // If this chat was already loaded, skip
    if (lastLoadedChatIdRef.current === chatId) return;

    // Mark this chat as loaded
    lastLoadedChatIdRef.current = chatId;
    init();
  }, [chatId, status]);

  /* ---------------- LOAD SIDEBAR CHATS ---------------- */

  async function loadChats() {
    const res = await fetch("/api/chats/list", {
      credentials: "include",
    });
    const data = await res.json();
    setChatList(data);
  }

  useEffect(() => {
    loadChats();
  }, [chatId]);

  /* ---------------- SEND FUNCTION ---------------- */

  const send = useCallback(async (
    message?: string,
    modelIdOvr?: string,
    modeOvr?: AIMode,
    voiceAssistantOvr?: boolean,
  ) => {
    if (!input.trim() && !message) return;
    const effectiveVoiceAssistantEnabled = voiceAssistantOvr ?? voiceAssistantEnabled;
    if (effectiveVoiceAssistantEnabled && (speakingId || isSpeechActiveRef.current || speechQueueRef.current.length > 0)) {
      toast.info("Stop voice playback before sending a new message.");
      return;
    }

    const text = message || input;
    const trimmedText = text.trim();
    if (effectiveVoiceAssistantEnabled && trimmedText) {
      setLastSentTranscript(trimmedText);
    }
    setInput("");

    // NEW CHAT → server handles first exchange
    if (chatId === "new") {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModel,
          mode,
          voiceAssistantEnabled: effectiveVoiceAssistantEnabled,
        }),
      });

      const data = await res.json();

      // store first message temporarily
      sessionStorage.setItem("firstMessage", text);
      saveVoiceAssistantPreference(data.id, effectiveVoiceAssistantEnabled);

      router.replace(`/ai-assistant/${data.id}`);
      return;
    }

    const { provider } = parseModelValue(selectedModel);
    const userApiKey = keys[provider];

    sendMessage(
      { text },
      {
        body: {
          mode: modeOvr || mode,
          modelId: modelIdOvr || selectedModel,
          userApiKey,
          chatId,
          voiceAssistantEnabled: effectiveVoiceAssistantEnabled,
        },
      },
    );
  }, [
    chatId,
    input,
    keys,
    mode,
    router,
    selectedModel,
    sendMessage,
    speakingId,
    voiceAssistantEnabled,
  ]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const handleConfirmWritePreview = useCallback(async (previewId: string) => {
    setWriteCommitState((prev) => ({
      ...prev,
      [previewId]: { status: "loading" },
    }));

    try {
      const res = await fetch("/api/ai/write/confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_id: previewId }),
      });

      const payload = await res.json();

      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to commit write.");
      }

      setWriteCommitState((prev) => ({
        ...prev,
        [previewId]: {
          status: "success",
          message:
            payload?.summary ??
            `Committed successfully. Affected rows: ${payload?.affected_rows ?? 0}`,
          output: {
            preview_id: previewId,
            operation: payload?.operation ?? null,
            table: payload?.table_name ?? null,
            affected_rows: payload?.affected_rows ?? 0,
            committed_at: payload?.committed_at ?? null,
            summary:
              payload?.summary ??
              `Committed successfully. Affected rows: ${payload?.affected_rows ?? 0}`,
          },
        },
      }));
    } catch (error: any) {
      setWriteCommitState((prev) => ({
        ...prev,
        [previewId]: {
          status: "error",
          message: error?.message ?? "Failed to commit write.",
        },
      }));
    }
  }, []);

  const handleRegenerate = useCallback((messageId: string) => {
    const { provider } = parseModelValue(selectedModel);
    const userApiKey = keys[provider];
    isRegeneratingRef.current = true;
    setIsRegenerating(true);

    regenerate({
      messageId,
      body: {
        mode,
        modelId: selectedModel,
        userApiKey,
        chatId,
        voiceAssistantEnabled,
      },
    });
  }, [chatId, keys, mode, regenerate, selectedModel, voiceAssistantEnabled]);

  const handleReadAloud = useCallback((message: any) => {
    const plainText = removeMarkdown(getMessageText(message));

    // Toggle OFF if same message
    if (speakingId === message.id) {
      stopSpeechPlayback();
      return;
    }

    stopSpeechPlayback();
    spokenCursorByMessageRef.current[message.id] = plainText.length;
    queueSpeechChunk(message.id, plainText);
  }, [queueSpeechChunk, speakingId, stopSpeechPlayback]);

  const handleCopyMessage = useCallback(async (message: any) => {
    const plainText = getMessageText(message);
    const htmlText = await Promise.resolve(marked.parse(plainText));

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([htmlText], { type: "text/html" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plainText);
    }

    setCopiedId(message.id);
    setTimeout(() => setCopiedId(""), 2000);
  }, []);

  function handleToggleVoiceAssistant() {
    const next = !voiceAssistantEnabled;

    if (next) {
      const hasExistingAssistantHistory = messages.some((m) => m.role === "assistant");
      shouldSkipInitialVoicePlaybackRef.current = hasExistingAssistantHistory;
    }

    setVoiceAssistantEnabled(next);
    if (!next) {
      setVoiceSidebarOpen(false);
    }

    if (chatId !== "new") {
      saveVoiceAssistantPreference(chatId, next);
    }

    if (!next) {
      stopSpeechPlayback();
    }
  }

  function openChat(id: string) {
    if (id === chatId) return;

    try {
      localStorage.setItem(LAST_CHAT_ID_STORAGE_KEY, id);
    } catch {
      // ignore storage write errors (e.g. blocked cookies)
    }

    router.push(`/ai-assistant/${id}`);
  }

  const promptSection = useMemo(() => (
    <div className="shrink-0 p-4">
      <PromptInput
        value={input}
        onValueChange={setInput}
        isLoading={status === "streaming" || status === "submitted"}
        onSubmit={() => send()}
        className="max-w-6xl mx-auto w-full"
      >
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full gap-2 items-center justify-center">
            <PromptInputTextarea
              placeholder="Ask me anything..."
              className="rounded-xl"
            />
            <PromptInputActions className="justify-end pt-2">
              <PromptInputAction
                tooltip={
                  status === "streaming" || status === "submitted"
                    ? "Stop generation"
                    : "Send message"
                }
              >
                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => {
                    if (
                      status === "streaming" ||
                      status === "submitted"
                    ) {
                      stop();
                    } else {
                      send();
                    }
                  }}
                >
                  {status === "streaming" || status === "submitted" ? (
                    <Square className="size-5 fill-current" />
                  ) : (
                    <ArrowUp className="size-5" />
                  )}
                </Button>
              </PromptInputAction>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-full border border-ring",
                      isRecording && "bg-red-500/20 border-red-500/50"
                    )}
                    onClick={toggleVoiceInput}
                  >
                    {isRecording ? (
                      <AudioLines className="size-6 fill-current text-red-500 animate-pulse" />
                    ) : (
                      <Mic className="size-6" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isRecording ? "Stop recording" : "Start voice input"}
                </TooltipContent>
              </Tooltip>
            </PromptInputActions>
          </div>
          <div className="flex items-center justify-between gap-2">
            <ModelCombobox
              value={selectedModel}
              onChange={setSelectedModel}
            />
            <ModeToggle value={mode} onChange={setMode} />
          </div>
        </div>
      </PromptInput>
    </div>
  ), [
    input,
    isRecording,
    mode,
    selectedModel,
    send,
    status,
    stop,
    toggleVoiceInput
  ]);

  const emptyStateContainer = useMemo(() => (
      (chatId === "new" ||
        (messages.length == 0 && !isLoadingHistory)) && (
        <NewChat setInput={setInput}/>
      )
  ), [chatId, isLoadingHistory, messages.length]);

  const renderHeaderContent = () => (
    <header className="flex h-14 shrink-0 items-center justify-between px-4 border-b bg-background/80 backdrop-blur">
      <div className="flex items-center w-full justify-between gap-2">
        <div className="flex items-center">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-md font-medium tracking-wide text-muted-foreground" onClick={()=>console.log(messages.slice(-4))}>
            Pixie
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="gap-2 rounded-lg text-foreground hover:text-foreground"
          >
            <Home />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() =>
              setSpeechOutputProvider((prev) =>
                prev === "browser" ? "elevenlabs" : "browser",
              )
            }
            aria-label={`Audio output ${speechOutputProvider}`}
            title="Toggle audio output provider"
          >
            {speechOutputProvider === "browser" ? "B" : "E"}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={devMode ? "default" : "outline"}
                  size="icon"
                  onClick={() => setDevMode((prev) => !prev)}
                  className="rounded-lg"
                  aria-pressed={devMode}
                  aria-label={`Dev mode ${devMode ? "on" : "off"}`}
                >
                  <Bug className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {devMode ? "Dev mode off" : "Dev mode on"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TokenUsageDialog messages={messages} />
          <KeyManagerDialog />
        </div>
      </div>
    </header>
  );

  const renderChatSurface = (showHeader: boolean) => (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col bg-background">
      {showHeader ? (
        renderHeaderContent()
      ) : null}

      <div className="grid gap-3 border-b px-4 py-3 md:grid-cols-2">
        <TelegramConnect />
        <GoogleCalendarConnect />
      </div>

      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        <ChatTimeline
          chatId={chatId}
          messages={messages}
          status={status}
          isLoadingHistory={isLoadingHistory}
          copiedId={copiedId}
          devMode={devMode}
          error={error}
          speakingId={speakingId}
          writeCommitState={writeCommitState}
          onCopyMessage={handleCopyMessage}
          onRegenerate={handleRegenerate}
          onReadAloud={handleReadAloud}
          onConfirmWritePreview={handleConfirmWritePreview}
          setMessages={setMessages}
          send={send}
        />
        {emptyStateContainer}
      </div>

      <div className="shrink-0">
        {promptSection}
      </div>
    </div>
  );

  /* ====== MAIN RETURN ====== */
  
  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (voiceAssistantEnabled) {
    // ====== VOICE MODE LAYOUT ======
    return (
      <SidebarProvider defaultOpen={true}>
        <AppSidebar
          chats={chatList}
          activeChatId={chatId}
          onOpenChat={openChat}
          refreshChats={loadChats}
          voiceAssistantEnabled={voiceAssistantEnabled}
          onToggleVoiceAssistant={handleToggleVoiceAssistant}
        />

        <SidebarInset className="h-screen overflow-hidden bg-background relative">
          {/* Sidebar Toggle */}
          <div className="absolute top-4 left-4 z-40">
            <SidebarTrigger className="-ml-1" />
          </div>
          {/* Voice Orb Content Area */}
          <div
            className={cn(
              "relative z-0 flex h-full w-full items-center justify-center overflow-hidden transition-[padding] duration-300",
              voiceSidebarOpen && !voiceSidebarExpanded && "md:pr-[24rem] xl:pr-[28rem]"
            )}
          >
            <VoiceOrb
              isListening={isRecording}
              isSpeaking={speakingId !== null}
              isProcessing={status === "streaming"}
              outputAudioElement={activeOutputAudioElement}
              transcript={liveTranscript}
              sentTranscript={lastSentTranscript}
              onToggleMic={toggleVoiceInput}
              onStop={() => {
                stop();
                stopSpeechPlayback();
                if (mediaRecorderRef.current) {
                  stopServerSpeechRecognition();
                } else if (recognitionRef.current && isRecording) {
                  try {
                    recognitionRef.current.stop();
                  } catch {
                    // Ignore transient recognition stop errors.
                  }
                }
              }}
            />
          </div>

          {!voiceSidebarOpen ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setVoiceSidebarOpen(true)}
                className="hidden md:flex absolute right-0 top-1/2 z-50 -translate-y-1/2 rounded-l-xl rounded-r-none border-r-0"
                aria-label="Open chat panel"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVoiceSidebarOpen(true)}
                className="md:hidden absolute bottom-4 right-4 z-50"
                aria-label="Open chat panel"
              >
                Open Chat
              </Button>
            </>
          ) : null}

          {voiceSidebarOpen ? (
            <div
              className={cn(
                "absolute right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-background shadow-2xl",
                !voiceSidebarExpanded && "md:w-[24rem] xl:w-[28rem]"
              )}
            >
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
                <h2 className="text-sm font-semibold tracking-wide">Pixie Chat</h2>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="hidden md:flex"
                    onClick={() => setVoiceSidebarExpanded((prev) => !prev)}
                    aria-label={voiceSidebarExpanded ? "Restore chat panel" : "Expand chat panel"}
                    title={voiceSidebarExpanded ? "Restore" : "Fullscreen"}
                  >
                    {voiceSidebarExpanded ? (
                      <Minimize2 className="size-4" />
                    ) : (
                      <Maximize2 className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setVoiceSidebarOpen(false)}
                    aria-label="Close chat panel"
                  >
                    <ChevronRight className="hidden md:block size-4" />
                    <ChevronDown className="block md:hidden size-4" />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1">
                {renderChatSurface(true)}
              </div>
            </div>
          ) : null}
        </SidebarInset>
      </SidebarProvider>
    );
  } else {
    // ====== STANDARD CHAT LAYOUT ======
    return (
      <SidebarProvider defaultOpen={true}>
        <AppSidebar
          chats={chatList}
          activeChatId={chatId}
          onOpenChat={openChat}
          refreshChats={loadChats}
          voiceAssistantEnabled={voiceAssistantEnabled}
          onToggleVoiceAssistant={handleToggleVoiceAssistant}
        />

        <SidebarInset className="h-screen overflow-hidden">
          {renderHeaderContent()}

          <div className="flex flex-1 min-h-0 flex-col w-full min-w-0 items-center overflow-hidden">
            {renderChatSurface(false)}
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }
}
