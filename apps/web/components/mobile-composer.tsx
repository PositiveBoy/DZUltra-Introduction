"use client";

import { Keyboard } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface MobileComposerProps {
  view: string;
  draft: string;
  setDraft: (value: string) => void;
  inputMode: "text" | "voice";
  setInputMode: (mode: "text" | "voice") => void;
  keyboardOpen: boolean;
  setKeyboardOpen: (open: boolean) => void;
  voicePressed: boolean;
  setVoicePressed: (pressed: boolean) => void;
  onSubmit: (text?: string) => void;
  routePlanningEnabled: boolean;
  onRoutePlanningToggle: () => void;
}

/* ------------------------------------------------------------------ */
/*  Web Speech API types (not in standard TS lib)                      */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRecognitionLike = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

/* ------------------------------------------------------------------ */
/*  Inline Toast                                                       */
/* ------------------------------------------------------------------ */

function InlineToast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute -top-12 left-1/2 z-50 -translate-x-1/2">
      <div className="whitespace-nowrap rounded-lg bg-black/75 px-4 py-2 text-[13px] leading-5 text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MockKeyboard (kept local — only used inside composer)              */
/* ------------------------------------------------------------------ */

function MockKeyboard({ onAction }: { onAction: () => void }) {
  return (
    <button
      aria-label="模拟 iPhone 键盘"
      onClick={onAction}
      className="absolute bottom-0 left-0 right-0 z-10 h-[342px] bg-contain bg-bottom bg-no-repeat"
      style={{ backgroundImage: "url('/dianping-assets/Keyboard.png')" }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  voiceMockTextForView                                               */
/* ------------------------------------------------------------------ */

function voiceMockTextForView(view: string) {
  if (view === "plans" || view === "refining") {
    return "换掉咖啡馆，少走一点路";
  }
  if (view === "clarifying") {
    return "三个人，今天下午，微辣可以";
  }
  if (view === "summary") {
    return "预算控制在人均一百五以内";
  }
  return "今天下午想在北京约会，不想排队，想吃饭加看展";
}

/* ------------------------------------------------------------------ */
/*  MobileComposer                                                     */
/* ------------------------------------------------------------------ */

export function MobileComposer({
  view,
  draft,
  setDraft,
  inputMode,
  setInputMode,
  keyboardOpen,
  setKeyboardOpen,
  voicePressed,
  setVoicePressed,
  onSubmit,
  routePlanningEnabled,
  onRoutePlanningToggle,
}: MobileComposerProps) {
  const [voiceCancelArmed, setVoiceCancelArmed] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState("按住说话");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const voiceStartYRef = useRef<number | null>(null);
  const voiceCancelArmedRef = useRef(false);
  const textLongPressTimerRef = useRef<number | undefined>(undefined);
  const textLongPressActiveRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);
  const isStartView = view === "start";

  /* ---- cleanup ---- */
  useEffect(() => {
    return () => {
      if (textLongPressTimerRef.current) {
        window.clearTimeout(textLongPressTimerRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      stopRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- toast helper ---- */
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2500);
  }, []);

  /* ---- speech recognition ---- */
  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
  }, []);

  const startRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      showToast("当前浏览器不支持语音输入");
      return false;
    }

    stopRecognition();

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        setVoiceStatusText(`识别中：${transcript}`);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        showToast("请在浏览器设置中允许麦克风权限");
      } else if (event.error === "no-speech" || event.error === "aborted") {
        showToast("没听清，请再试一次");
      } else {
        showToast("语音识别出错，请再试一次");
      }
      setVoicePressed(false);
      setVoiceCancelArmed(false);
      setVoiceStatusText("按住说话");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      const rec = recognitionRef.current;
      if (!rec) return;
      /* Read final transcript from the recognition object */
      let finalTranscript = "";
      const results = rec.results;
      if (results) {
        for (let i = 0; i < results.length; i++) {
          if (results[i].isFinal) {
            finalTranscript += results[i][0].transcript;
          }
        }
      }
      recognitionRef.current = null;

      if (voiceCancelArmedRef.current) {
        setVoicePressed(false);
        setVoiceCancelArmed(false);
        setVoiceStatusText("按住说话");
        return;
      }

      setVoicePressed(false);
      setVoiceCancelArmed(false);

      if (finalTranscript) {
        setDraft(finalTranscript);
        setVoiceStatusText(`识别到：${finalTranscript}`);
        /* Auto-send after brief display of recognized text */
        window.setTimeout(() => {
          setVoiceStatusText("按住说话");
          onSubmit(finalTranscript);
        }, 180);
      } else {
        /* Fallback to mock text if no real result */
        const mockSpeech = voiceMockTextForView(view);
        setDraft(mockSpeech);
        setVoiceStatusText(`识别到：${mockSpeech}`);
        window.setTimeout(() => {
          setVoiceStatusText("按住说话");
          onSubmit(mockSpeech);
        }, 180);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch {
      showToast("语音识别启动失败");
      return false;
    }
  }, [showToast, stopRecognition, setDraft, setVoicePressed, onSubmit, view]);

  /* ---- permission check before voice mode ---- */
  const checkMicPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.permissions) {
      /* Can't check — try starting recognition and let it fail */
      return true;
    }
    try {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (status.state === "denied") {
        showToast("请在浏览器设置中允许麦克风权限");
        return false;
      }
      return true;
    } catch {
      /* permissions.query not supported for microphone — proceed */
      return true;
    }
  }, [showToast]);

  /* ---- placeholder ---- */
  const placeholder =
    view === "plans" || view === "refining" || view === "selected"
      ? "试试说\"换掉咖啡馆\"或\"不想走太多\""
      : inputMode === "voice"
        ? "按住说话"
        : "发消息或按住说话";

  /* ---- voice field state ---- */
  const voiceFieldStateClass = voiceCancelArmed
    ? "bg-[rgba(255,165,178,0.95)] text-[#f70000]"
    : voicePressed
      ? "bg-[rgba(15,111,255,0.95)] text-white"
      : "bg-[rgba(243,243,243,0.9)] text-[#727272]";
  const showVoiceControl = inputMode === "voice" || voicePressed;

  /* ---- mode toggle ---- */
  async function toggleInputMode() {
    if (inputMode === "text") {
      const permitted = await checkMicPermission();
      if (!permitted) return;
      setInputMode("voice");
      setKeyboardOpen(false);
      return;
    }
    setInputMode("text");
    setKeyboardOpen(true);
  }

  /* ---- voice press handlers ---- */
  function beginVoice(pointerY: number) {
    voiceStartYRef.current = pointerY;
    voiceCancelArmedRef.current = false;
    setVoiceCancelArmed(false);
    setVoiceStatusText("松手发送，上滑取消");
    setVoicePressed(true);
    startRecognition();
  }

  function moveVoice(pointerY: number) {
    if (voiceStartYRef.current === null) return;
    const shouldCancel = voiceStartYRef.current - pointerY > 50;
    voiceCancelArmedRef.current = shouldCancel;
    setVoiceCancelArmed(shouldCancel);
    setVoiceStatusText(shouldCancel ? "松手取消" : "松手发送，上滑取消");
  }

  function finishVoice() {
    const shouldCancel = voiceCancelArmedRef.current;
    voiceStartYRef.current = null;

    if (shouldCancel) {
      stopRecognition();
      voiceCancelArmedRef.current = false;
      setVoicePressed(false);
      setVoiceCancelArmed(false);
      setVoiceStatusText("按住说话");
      if (inputMode === "text") {
        setInputMode("text");
      }
      return;
    }

    /* Stop recognition — onend handler will process the result */
    stopRecognition();
  }

  /* ---- text long-press (press-hold in text mode to switch to voice) ---- */
  function clearTextLongPressTimer() {
    if (textLongPressTimerRef.current) {
      window.clearTimeout(textLongPressTimerRef.current);
      textLongPressTimerRef.current = undefined;
    }
  }

  function beginTextLongPress(event: ReactPointerEvent<HTMLDivElement>) {
    if (inputMode !== "text") return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    textLongPressActiveRef.current = false;
    voiceStartYRef.current = event.clientY;
    clearTextLongPressTimer();
    textLongPressTimerRef.current = window.setTimeout(async () => {
      const permitted = await checkMicPermission();
      if (!permitted) {
        textLongPressActiveRef.current = false;
        return;
      }
      textLongPressActiveRef.current = true;
      setKeyboardOpen(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      beginVoice(event.clientY);
    }, 260);
  }

  function moveTextLongPress(pointerY: number) {
    if (!textLongPressActiveRef.current) return;
    moveVoice(pointerY);
  }

  function finishTextLongPress() {
    clearTextLongPressTimer();
    if (!textLongPressActiveRef.current) {
      voiceStartYRef.current = null;
      return;
    }
    textLongPressActiveRef.current = false;
    finishVoice();
  }

  if (view === "settings") return null;

  return (
    <footer
      data-mobile-composer="true"
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 px-[25px] pt-0 transition-[padding] duration-300",
        keyboardOpen && inputMode === "text" ? "pb-[354px]" : isStartView ? "pb-[27px]" : "pb-10"
      )}
    >
      {/* Toast */}
      {toastMessage && <InlineToast message={toastMessage} />}

      {isStartView && (
        <div className="relative z-20 mb-2">
          <button
            type="button"
            aria-label={routePlanningEnabled ? "路线规划已开启" : "路线规划已关闭"}
            aria-pressed={routePlanningEnabled}
            onClick={onRoutePlanningToggle}
            className="block h-[25px] w-[113px] bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('/dianping-assets/${routePlanningEnabled ? "路线规划按钮开启态.png" : "路线规划按钮关闭态.png"}')`,
            }}
          />
          {!routePlanningEnabled && (
            <p className="mt-1 text-[11px] font-medium leading-4 text-amber-600">
              路线规划已关闭，将按普通问答回复
            </p>
          )}
        </div>
      )}
      <div
        className={cn(
          "relative z-20 flex h-11 items-center gap-2 rounded-full border border-white transition-colors",
          "overflow-visible py-[11px] pl-4 pr-[4px] shadow-[0_10px_24px_rgba(0,0,0,0.055),0_0_22px_rgba(255,102,43,0.08)]",
          showVoiceControl ? voiceFieldStateClass : "bg-[rgba(243,243,243,0.9)] text-[#727272]"
        )}
        onPointerDown={beginTextLongPress}
        onPointerMove={(event) => moveTextLongPress(event.clientY)}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          finishTextLongPress();
        }}
        onPointerCancel={finishTextLongPress}
      >
        {/* Blue glow effect when recording */}
        {showVoiceControl && voicePressed && !voiceCancelArmed && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-full border border-[rgba(0,122,255,0.5)]"
            style={{ boxShadow: "0 0 12px rgba(0, 122, 255, 0.5)" }}
            animate={{
              scale: [1, 1.04, 1],
              opacity: [0.8, 0.3, 0.8],
              boxShadow: [
                "0 0 12px rgba(0, 122, 255, 0.5)",
                "0 0 28px rgba(0, 122, 255, 0.7)",
                "0 0 12px rgba(0, 122, 255, 0.5)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
          />
        )}

        {/* Cancel overlay when sliding up past threshold */}
        {showVoiceControl && voicePressed && voiceCancelArmed && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-full border border-[rgba(255,0,0,0.3)]"
            style={{ boxShadow: "0 0 12px rgba(255, 0, 0, 0.3)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          />
        )}

        <button
          onClick={toggleInputMode}
          className={cn("flex shrink-0 items-center justify-center", "h-[22px] w-[22px]")}
          aria-label={inputMode === "text" ? "切换到语音输入" : "切换到文字输入"}
        >
          {inputMode === "text" ? (
            <span
              aria-hidden="true"
              className="block h-[22px] w-[22px] bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage:
                  "url('/dianping-assets/ugc_review_add_voice_new_icon_Normal@3x.png')",
              }}
            />
          ) : (
            <Keyboard className="h-4 w-4 text-current" />
          )}
        </button>
        {showVoiceControl ? (
          <button
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              beginVoice(event.clientY);
            }}
            onPointerMove={(event) => moveVoice(event.clientY)}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              finishVoice();
            }}
            onPointerCancel={() => {
              stopRecognition();
              voiceCancelArmedRef.current = false;
              setVoicePressed(false);
              setVoiceCancelArmed(false);
              setVoiceStatusText("按住说话");
              voiceStartYRef.current = null;
            }}
            onPointerLeave={() => {
              if (voicePressed) {
                voiceCancelArmedRef.current = true;
                setVoiceCancelArmed(true);
                setVoiceStatusText("松手取消");
              }
            }}
            className={cn(
              "relative flex min-w-0 flex-1 items-center justify-center rounded-full text-[14px] transition",
              "h-[22px] font-normal"
            )}
          >
            {voicePressed || voiceStatusText !== "按住说话" ? voiceStatusText : placeholder}
          </button>
        ) : (
          <>
            <input
              value={draft}
              onFocus={() => setKeyboardOpen(true)}
              onClick={() => setKeyboardOpen(true)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSubmit();
                }
              }}
              placeholder={placeholder}
              className={cn(
                "min-w-0 flex-1 bg-transparent text-[14px] outline-none",
                "font-normal leading-[22px] tracking-[-0.08px] placeholder:text-[#727272]"
              )}
            />
            <button
              onClick={() => onSubmit()}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-[#f26b43] bg-contain bg-center bg-no-repeat text-white",
                "h-[35px] w-[35px]"
              )}
              style={{ backgroundImage: "url('/dianping-assets/submit.png')" }}
              aria-label="发送"
            />
          </>
        )}
      </div>
      {keyboardOpen && inputMode === "text" && <MockKeyboard onAction={onSubmit} />}
    </footer>
  );
}
