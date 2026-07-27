import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Heart, Sparkles, AlertCircle, Loader2, Mail, Lock } from "lucide-react";

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
}

export default function Auth({ onSuccess, initialIsSignUp }: AuthProps) {
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
      setErrorMsg(err.message || "Impossible de démarrer l'authentification Google.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    setIsLoading(true);
    try {
      if (mode === "signup") {
        // Verify the human check server-side before creating the account.
        const turnstileToken = window.turnstile?.getResponse(widgetIdRef.current);
        if (turnstileEnabledRef.current) {
          if (!turnstileToken) {
            setErrorMsg("Veuillez valider la vérification anti-robot avant de continuer.");
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
            setErrorMsg(verifyData.error || "Vérification anti-robot échouée. Veuillez réessayer.");
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
      setErrorMsg(err.message || "Une erreur est survenue. Veuillez réessayer.");
      if (mode === "signup" && window.turnstile) window.turnstile.reset(widgetIdRef.current);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-page" className="min-h-screen bg-slate-50 flex flex-col justify-start md:justify-center items-center p-4 relative overflow-y-auto py-8 md:py-4 font-sans w-full">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-rose-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-300/20 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-slate-100 z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 shadow-md shadow-rose-500/10">
            <Heart size={32} fill="currentColor" className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-1">
            <span>Love</span>
            <span className="text-rose-500">Rose</span>
          </h1>
          <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">Rencontres d'Afrique & d'Ailleurs</p>
        </div>

        <div className="flex bg-slate-100 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setErrorMsg(""); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${mode === "login" ? "bg-white text-rose-500 shadow-sm" : "text-slate-500"}`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setErrorMsg(""); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${mode === "signup" ? "bg-white text-rose-500 shadow-sm" : "text-slate-500"}`}
          >
            S'inscrire
          </button>
        </div>

        <div className="p-4 bg-rose-50/60 border border-rose-100 rounded-2xl text-center space-y-2">
          <div className="flex items-center justify-center gap-1 text-rose-600 font-bold text-xs uppercase tracking-wider">
            <Sparkles size={14} />
            <span>Connexion Simple & Sécurisée</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Connectez-vous avec Google, ou avec votre email et mot de passe.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        {isInAppBrowser && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] p-3 rounded-xl flex items-start gap-2 leading-relaxed">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>
              Pour vous connecter avec Google, ouvrez ce lien dans votre navigateur (⋮ puis <b>"Ouvrir dans le navigateur"</b>). L'email et mot de passe fonctionnent ici directement.
            </span>
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          type="button"
          className="w-full py-4 bg-white hover:bg-slate-50 border-2 border-slate-200 active:bg-slate-100 text-slate-800 font-extrabold text-sm rounded-2xl transition flex items-center justify-center gap-3 cursor-pointer shadow-sm hover:shadow-md hover:border-rose-300 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="animate-spin text-rose-500" size={20} />
          ) : (
            <>
              <svg className="w-5 h-5 mr-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continuer avec Google</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ou</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-3">
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Adresse Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold text-xs transition"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">Mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 focus:border-rose-400 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold text-xs transition"
              />
            </div>
          </div>

          {mode === "signup" && (
            <div ref={turnstileRef} className="cf-turnstile flex justify-center pt-1" />
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : mode === "signup" ? (
              "Créer mon compte"
            ) : (
              "Se connecter"
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-400 leading-relaxed">
          En vous connectant, vous acceptez les{" "}
          <a
            href="/conditions-d-utilisation"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline cursor-pointer font-medium text-slate-500"
          >
            Conditions Générales d'Utilisation
          </a>{" "}
          et la{" "}
          <a
            href="/politique-de-confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline cursor-pointer font-medium text-slate-500"
          >
            politique de confidentialité
          </a>{" "}
          de LoveRose (+18 ans).
        </p>
      </div>
    </div>
  );
}
