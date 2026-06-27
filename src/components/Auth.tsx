import { useState, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Heart, Mail, Lock, User, Sparkles, LogIn, UserPlus, AlertCircle, Loader2 } from "lucide-react";

interface AuthProps {
  onSuccess: () => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState(18);
  const [gender, setGender] = useState<'homme' | 'femme' | 'autre'>('homme');
  const [preferences, setPreferences] = useState<'homme' | 'femme' | 'tous'>('femme');
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          throw new Error("Veuillez saisir votre nom complet.");
        }
        if (age < 18) {
          throw new Error("Vous devez avoir au moins 18 ans pour vous inscrire.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              age: age,
              gender: gender,
              preferences: preferences
            }
          }
        });

        if (error) throw error;

        // Auto insert into profiles if user is created successfully
        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert([
              {
                uid: data.user.id,
                full_name: fullName,
                username: email.split("@")[0] + "_" + Math.floor(Math.random() * 1000),
                age: age,
                gender: gender,
                preferences: preferences,
                relationship_intents: ["Amitié"],
                verification_status: "none"
              }
            ]);
          
          if (profileError) {
            console.error("Error creating initial profile row:", profileError);
          }

          // Initialize user credits balance with 0
          await supabase.from("user_credits").upsert([{ user_id: data.user.id, balance: 0 }]);
        }

        alert("Inscription réussie ! Vous pouvez maintenant vous connecter ou votre session va s'ouvrir.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible de démarrer l'authentification Google.");
    }
  };

  return (
    <div id="auth-page" className="min-h-screen bg-slate-50 flex flex-col justify-start md:justify-center items-center p-4 relative overflow-y-auto py-8 md:py-4 font-sans">
      {/* Absolute background accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-rose-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-rose-300/20 rounded-full blur-3xl"></div>

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-xl border border-slate-100 z-10 space-y-6">
        {/* Brand Header */}
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

        {/* Form Error */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Tab selection */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl text-sm font-semibold text-slate-600">
          <button
            onClick={() => { setIsSignUp(false); setErrorMsg(""); }}
            className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer ${!isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'}`}
          >
            Se Connecter
          </button>
          <button
            onClick={() => { setIsSignUp(true); setErrorMsg(""); }}
            className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer ${isSignUp ? 'bg-white text-slate-800 shadow-sm' : 'hover:text-slate-800'}`}
          >
            S'inscrire
          </button>
        </div>

        {/* Standard Email Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <>
              {/* Nom Complet */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom complet</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: David Mensah"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-sm font-medium transition"
                  />
                </div>
              </div>

              {/* Age, Gender, Preferences Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Âge</label>
                  <input
                    type="number"
                    required
                    min={18}
                    max={100}
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-sm font-bold transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Je suis</label>
                  <select
                    value={gender}
                    onChange={(e: any) => setGender(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-bold transition"
                  >
                    <option value="homme">Homme</option>
                    <option value="femme">Femme</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cherche</label>
                  <select
                    value={preferences}
                    onChange={(e: any) => setPreferences(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-xs font-bold transition"
                  >
                    <option value="femme">Femmes</option>
                    <option value="homme">Hommes</option>
                    <option value="tous">Tous</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Adresse e-mail</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: nom@domaine.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-sm font-medium transition"
              />
            </div>
          </div>

          {/* Mot de passe */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mot de passe</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl text-sm font-medium transition"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:from-rose-700 text-white font-bold text-sm rounded-xl transition shadow-md shadow-rose-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : isSignUp ? (
              <>
                <UserPlus size={16} />
                <span>Créer mon compte</span>
              </>
            ) : (
              <>
                <LogIn size={16} />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-full border-t border-slate-100"></div>
          <span className="relative bg-white px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">ou utiliser</span>
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          type="button"
          className="w-full py-3.5 bg-white hover:bg-slate-50 border border-slate-200 active:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
        >
          {/* Flat Google vector SVG */}
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span>Continuer avec Google</span>
        </button>

        <p className="text-center text-[11px] text-slate-400">
          En vous inscrivant, vous acceptez les <span className="hover:underline cursor-pointer">Conditions Générales d'Utilisation</span> de LoveRose. Réservé aux personnes majeures (+18 ans).
        </p>
      </div>
    </div>
  );
}
