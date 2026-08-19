import { useState, useEffect, useRef, type FormEvent } from "react";
import { useTranslation, Trans } from "react-i18next";
import { supabase } from "../lib/supabase";
import { Heart, AlertCircle, Loader2, Mail, Lock, ShieldCheck, Sparkles, MessageCircleHeart, ArrowLeft, UserRound } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, any>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    __ENV__?: { VITE_TURNSTILE_SITE_KEY?: string; [key: string]: any };
  }
}

interface AuthProps {
  onSuccess: () => void;
  initialIsSignUp?: boolean;
  onBack?: () => void;
}

// Small fixed set of decorative heart positions for the branding panel —
// deterministic (no Math.random on every render) and deliberately sparse.
const HEART_PATTERN = [
  { top: "8%", left: "12%", size: 18, delay: "0s" },
  { top: "18%", left: "78%", size: 14, delay: "0.6s" },
  { top: "32%", left: "45%", size: 22, delay: "1.2s" },
  { top: "52%", left: "16%", size: 16, delay: "0.3s" },
  { top: "64%", left: "82%", size: 20, delay: "0.9s" },
  { top: "78%", left: "34%", size: 14, delay: "1.5s" },
  { top: "88%", left: "64%", size: 18, delay: "0.2s" },
];

export default function Auth({ onSuccess, initialIsSignUp, onBack }: AuthProps) {
  const { t } = useTranslation("auth");
  const [mode, setMode] = useState<"login" | "signup">(initialIsSignUp ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    // Google blocks its OAuth flow inside in-app WebViews (Facebook,
    // Instagram, Messenger, TikTok, etc.) for security reasons — this can't
    // be worked around, only detected so we can point the user to their
    // real browser instead of letting Google's login silently fail.
    const ua = navigator.userAgent || "";
    const inAppSignals = [
      "FBAN", "FBAV", "FB_IAB", // Facebook / Messenger
      "Instagram",
      "Line/",
      "MicroMessenger", // WeChat
      "TikTok",
      "Twitter",
      "; wv)", // generic Android WebView marker
    ];
    setIsInAppBrowser(inAppSignals.some((s) => ua.includes(s)));
  }, []);

  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const turnstileEnabledRef = useRef(false);

  // Only render/require the anti-bot widget for account creation — Google
  // sign-in already has its own bot protection, and gating login too would
  // just add friction for existing, already-verified users.
  useEffect(() => {
    if (mode !== "signup") return;
    const siteKey = window.__ENV__?.VITE_TURNSTILE_SITE_KEY;
    if (!siteKey || !turnstileRef.current) return;
    turnstileEnabledRef.current = true;

    let attempts = 0;
    const tryRender = () => {
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          theme: "light",
        });
      } else if (attempts < 40) {
        attempts += 1;
        setTimeout(tryRender, 500);
      } else {
        turnstileEnabledRef.current = false;
      }
    };
    tryRender();

    return () => {
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = undefined;
      }
    };
  }, [mode]);

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`
        }
      });
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || t("errors.googleFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setErrorMsg("");
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg(t("errors.missingFields"));
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setErrorMsg(t("errors.passwordTooShort"));
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "signup") {
        // Verify the human check server-side before creating the account.
        const turnstileToken = window.turnstile?.getResponse(widgetIdRef.current);
        if (turnstileEnabledRef.current) {
          if (!turnstileToken) {
            setErrorMsg(t("errors.captchaRequired"));
            setIsLoading(false);
            return;
          }
          const verifyRes = await fetch("/api/verify-turnstile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turnstileToken }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            setErrorMsg(verifyData.error || t("errors.captchaFailed"));
            if (window.turnstile) window.turnstile.reset(widgetIdRef.current);
            setIsLoading(false);
            return;
          }
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}` },
        });
        if (error) throw error;
        onSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("errors.generic"));
      if (mode === "signup" && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-page" className="min-h-screen min-h-[100dvh] bg-white flex flex-col md:flex-row font-sans">

      {/* Branding panel — full identity on desktop, compact strip on mobile */}
      <div className="relative overflow-hidden bg-slate-950 text-white flex-shrink-0 md:w-[42%] md:min-h-screen">
        {/* Scattered heart motif — the one signature flourish, kept quiet everywhere else */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.07] hidden md:block">
          {HEART_PATTERN.map((h, i) => (
            <Heart
              key={i}
              size={h.size}
              className="absolute fill-rose-400"
              style={{ top: h.top, left: h.left, animationDelay: h.delay, animationDuration: "3s" }}
            />
          ))}
        </div>
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-rose-500/20 rounded-full blur-3xl hidden md:block" />

        <div className="relative z-10 px-6 py-6 md:px-10 md:py-14 md:h-full md:flex md:flex-col md:justify-between">
          <div className="flex items-center gap-3 md:gap-3">
            {onBack && (
              <button
                onClick={onBack}
                type="button"
                className="md:hidden -ml-1 mr-1 p-1.5 rounded-full hover:bg-white/10 transition cursor-pointer"
                title={t("back")}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="flex items-baseline gap-px leading-none">
                <span className="u-display text-2xl md:text-3xl text-white">Love</span>
                <span className="u-display text-2xl md:text-3xl text-rose-400">Rose</span>
              </h1>
              <p className="u-kicker text-rose-400/80 mt-1.5 hidden md:block">
                {t("tagline", { ns: "common" })}
              </p>
            </div>
          </div>

          {/* Value proposition — desktop only, mobile keeps the strip minimal */}
          <div className="hidden md:block mt-10 space-y-8">
            <h2 className="u-display text-4xl leading-[1.08] text-white">
              {t("heroTitleLine1")}<br />{t("heroTitleLine2")}
            </h2>
            <ul className="space-y-5 text-[15px] text-slate-300">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 bg-rose-500/15 text-rose-400 rounded-lg p-1.5"><ShieldCheck size={16} /></span>
                <span>{t("heroBullet1")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 bg-rose-500/15 text-rose-400 rounded-lg p-1.5"><MessageCircleHeart size={16} /></span>
                <span>{t("heroBullet2")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 bg-rose-500/15 text-rose-400 rounded-lg p-1.5"><Sparkles size={16} /></span>
                <span>{t("heroBullet3")}</span>
              </li>
            </ul>
          </div>

          <p className="hidden md:block text-xs text-slate-500">
            {t("copyrightNotice", { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col">
        {onBack && (
          <div className="hidden md:block px-10 pt-8">
            <button
              onClick={onBack}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-500 transition cursor-pointer"
            >
              <ArrowLeft size={15} />
              {t("backToHome")}
            </button>
          </div>
        )}

        <div className="flex-1 flex items-start md:items-center justify-center px-5 py-8 md:px-10">
          <div className="w-full max-w-sm space-y-6">
            <div className="flex border-b border-slate-200" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                onClick={() => { setMode("login"); setErrorMsg(""); }}
                className={`flex-1 pb-3 text-sm font-bold transition cursor-pointer border-b-2 -mb-px ${mode === "login" ? "border-rose-500 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"}`}
              >
                {t("login")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                onClick={() => { setMode("signup"); setErrorMsg(""); }}
                className={`flex-1 pb-3 text-sm font-bold transition cursor-pointer border-b-2 -mb-px ${mode === "signup" ? "border-rose-500 text-slate-950" : "border-transparent text-slate-400 hover:text-slate-700"}`}
              >
                {t("signup")}
              </button>
            </div>

            <div>
              <h2 className="u-display text-3xl text-slate-950">
                {mode === "signup" ? t("createYourAccount") : t("welcomeBack")}
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                {mode === "signup" ? t("signupDescription") : t("connectDescription")}
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <p className="flex-1 font-medium">{errorMsg}</p>
              </div>
            )}

            {isInAppBrowser && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] p-3 rounded-xl flex items-start gap-2 leading-relaxed">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <Trans i18nKey="inAppBrowserWarning" ns="auth" components={{ b: <b /> }} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                type="button"
                className="w-full py-4 bg-white hover:bg-slate-50 border-2 border-slate-200 active:bg-slate-100 text-slate-800 font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md hover:border-rose-300 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-rose-500" size={18} />
                ) : (
                  <>
                    <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>{t("continueWithGoogle")}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAnonymousLogin}
                disabled={isLoading}
                type="button"
                className="w-full py-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 active:bg-slate-200 text-slate-600 font-extrabold text-xs rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin text-slate-400" size={18} />
                ) : (
                  <>
                    <UserRound size={16} className="flex-shrink-0" />
                    <span>{t("continueAsGuest")}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[12px] text-slate-400 leading-relaxed px-1 -mt-2">
              {t("guestModeNote")}
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">{t("or")}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">{t("emailLabel")}</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="w-full h-12 pl-10 pr-3 bg-white border border-slate-300 focus:border-slate-900 outline-none rounded-lg font-medium text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-[12px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">{t("passwordLabel")}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-10 pr-3 bg-white border border-slate-300 focus:border-slate-900 outline-none rounded-lg font-medium text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-normal transition-colors"
                  />
                </div>
              </div>

              {mode === "signup" && (
                <div ref={turnstileRef} className="cf-turnstile flex justify-center pt-1" />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-rose-500 hover:bg-rose-600 disabled:opacity-45 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : mode === "signup" ? (
                  t("createAccount")
                ) : (
                  t("loginButton")
                )}
              </button>
            </form>

            <p className="text-center text-[11px] text-slate-400 leading-relaxed pb-4">
              <Trans
                i18nKey="legalNotice"
                ns="auth"
                components={{
                  1: <a href="/conditions-d-utilisation" target="_blank" rel="noopener noreferrer" className="hover:underline cursor-pointer font-medium text-slate-500" />,
                  2: <a href="/politique-de-confidentialite" target="_blank" rel="noopener noreferrer" className="hover:underline cursor-pointer font-medium text-slate-500" />,
                }}
              />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
