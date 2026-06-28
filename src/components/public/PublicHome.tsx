import React from "react";
import { Heart, Sparkles, Shield, Compass, MessageSquare, ArrowRight, Star, Users } from "lucide-react";

interface PublicHomeProps {
  onNavigate: (path: string) => void;
}

export default function PublicHome({ onNavigate }: PublicHomeProps) {
  return (
    <div className="space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-rose-50/50 to-white pt-20 pb-16 text-center px-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-100/30 via-transparent to-transparent -z-10" />
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-rose-600 text-xs font-semibold uppercase tracking-wider animate-pulse">
            <Heart size={12} fill="currentColor" />
            <span>La référence des rencontres authentiques</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-none">
            Trouvez l'amour sincère sur <span className="text-rose-500">LoveRose</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Connectez-vous avec des célibataires sérieux en Afrique et à l'international. Notre algorithme intelligent vous propose des profils de qualité et respectueux, certifiés pour votre sécurité.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <button
              onClick={() => onNavigate("/inscription")}
              className="w-full sm:w-auto px-8 py-4 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
            >
              <span>Créer un compte gratuit</span>
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => onNavigate("/connexion")}
              className="w-full sm:w-auto px-8 py-4 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-950 font-extrabold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-base"
            >
              Se connecter
            </button>
          </div>
          <div className="flex justify-center items-center gap-6 text-slate-500 text-xs font-semibold pt-6">
            <span className="flex items-center gap-1.5">
              <Shield size={14} className="text-emerald-500" />
              Profils 100% vérifiés
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-indigo-500" />
              Afrique & International
            </span>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="max-w-6xl mx-auto px-4 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">Une expérience de rencontre complète</h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            Découvrez nos fonctionnalités conçues pour faciliter des échanges chaleureux, bienveillants et sécurisés.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4 text-left">
            <div className="bg-rose-50 text-rose-500 w-12 h-12 rounded-2xl flex items-center justify-center">
              <Compass size={24} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Découverte intelligente</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Faites défiler des profils proches de vous ou à l'échelle internationale. Filtrez par affinités et par intentions de relation (mariage, sérieux, amitié) pour trouver la perle rare.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4 text-left">
            <div className="bg-indigo-50 text-indigo-500 w-12 h-12 rounded-2xl flex items-center justify-center">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Messagerie instantanée</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Une fois le match validé, échangez en toute sécurité avec notre messagerie fluide et rapide. Envoyez des messages textuels et partagez vos passions à votre rythme.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all space-y-4 text-left">
            <div className="bg-amber-50 text-amber-500 w-12 h-12 rounded-2xl flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">Espace Créateurs & Actualités</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              Suivez l'actualité de vos créateurs préférés et découvrez leurs publications exclusives. Un environnement de divertissement chaleureux et interactif au cœur de LoveRose.
            </p>
          </div>
        </div>
      </section>

      {/* Safety & Commitment Banner */}
      <section className="bg-slate-900 text-white py-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12 text-left">
          <div className="space-y-6 md:w-1/2">
            <div className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Shield size={10} fill="currentColor" />
              <span>Sécurité et Protection</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none">
              Votre sécurité est notre priorité absolue
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Chez LoveRose, nous luttons activement contre les faux profils et les comportements malveillants. Tous nos profils créateurs sont certifiés d'identité et notre système de signalement réactif garantit un environnement respectueux pour tous.
            </p>
            <div className="flex flex-col gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">✓</div>
                <span>Algorithmes de détection automatique des spams</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">✓</div>
                <span>Validation stricte des photos et profils</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">✓</div>
                <span>Contrôle de l'âge minimum requis (18 ans)</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-800 rounded-3xl p-8 border border-slate-700 space-y-6 md:w-1/2 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 bg-rose-500/10 w-40 h-40 rounded-full blur-3xl" />
            <h3 className="text-xl font-bold text-white">Prêt à faire de belles rencontres ?</h3>
            <p className="text-slate-400 text-xs">
              Inscrivez-vous dès aujourd'hui et commencez à découvrir des profils de qualité près de chez vous ou à l'international.
            </p>
            <div className="space-y-3 pt-2">
              <button
                onClick={() => onNavigate("/inscription")}
                className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                Commencer gratuitement
              </button>
              <button
                onClick={() => onNavigate("/connexion")}
                className="w-full py-3.5 bg-slate-700 hover:bg-slate-650 text-slate-200 hover:text-white font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                Déjà membre ? Se connecter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Testimonials */}
      <section className="max-w-5xl mx-auto px-4 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">Ils ont trouvé l'amour sur LoveRose</h2>
          <p className="text-slate-500 text-sm">
            Découvrez les témoignages de couples formés sur notre plateforme.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-8 text-left">
          <div className="bg-rose-50/30 rounded-3xl p-8 border border-rose-100/50 space-y-4">
            <div className="flex items-center gap-1 text-amber-500">
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
            </div>
            <p className="text-slate-700 text-xs italic leading-relaxed">
              "J'ai rencontré Marc sur LoveRose il y a un an. Au début, j'étais sceptique quant aux applications de rencontre, mais le sérieux de la plateforme m'a rassurée. Aujourd'hui nous vivons ensemble et planifions notre mariage. Merci LoveRose !"
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-200 font-bold text-rose-700 flex items-center justify-center text-xs">
                S&M
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">Sandrine & Marc</p>
                <p className="text-[10px] text-slate-400 font-semibold">Douala, Cameroun</p>
              </div>
            </div>
          </div>

          <div className="bg-rose-50/30 rounded-3xl p-8 border border-rose-100/50 space-y-4">
            <div className="flex items-center gap-1 text-amber-500">
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
              <Star size={16} fill="currentColor" />
            </div>
            <p className="text-slate-700 text-xs italic leading-relaxed">
              "La plateforme est vraiment sécurisée et les profils sont respectueux. On sent que ce ne sont pas de faux comptes. J'y ai rencontré Amadou et nous partageons une magnifique relation."
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-200 font-bold text-rose-700 flex items-center justify-center text-xs">
                A&F
              </div>
              <div>
                <p className="text-xs font-black text-slate-800">Aminata & Fatou</p>
                <p className="text-[10px] text-slate-400 font-semibold">Dakar, Sénégal</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
