import React from "react";
import {
  Heart, Shield, Compass, ArrowRight, Star, CheckCircle, Store,
  BadgeCheck, Smartphone, Quote,
} from "lucide-react";

interface PublicHomeProps {
  onNavigate: (path: string) => void;
}

const FEATURES = [
  {
    Icon: Store,
    title: "Publiez une annonce",
    body: "Vendez un produit, proposez un service, un cours ou une prestation. Contact gratuit ou payant — vous choisissez, et vous encaissez directement.",
  },
  {
    Icon: Compass,
    title: "Trouvez près de chez vous",
    body: "Recherchez par catégorie, ville et budget. Le fil met en avant les annonces récentes et les profils vérifiés de votre région.",
  },
  {
    Icon: Heart,
    title: "Rencontrez des personnes",
    body: "Au-delà des annonces, likez les profils qui vous plaisent et découvrez vos matchs réciproques dans un espace bienveillant.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "J'ai rencontré Marc sur LoveRose il y a un an. Le sérieux de la plateforme m'a rassurée. Aujourd'hui nous vivons ensemble et planifions notre mariage.",
    name: "Sandrine & Marc",
    place: "Douala, Cameroun",
    initials: "S&M",
  },
  {
    quote:
      "Je vends mes créations via les annonces. Le paiement Mobile Money est direct, sans commission cachée. En trois mois j'ai doublé ma clientèle.",
    name: "Aminata D.",
    place: "Dakar, Sénégal",
    initials: "AD",
  },
];

export default function PublicHome({ onNavigate }: PublicHomeProps) {
  return (
    <div className="pb-0">
      {/* ================= HERO ================= */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="max-w-3xl">
            <span className="u-kicker text-rose-600">
              Afrique francophone · 100 % gratuit à l'inscription
            </span>

            <h1 className="u-display text-[2.75rem] leading-[0.98] sm:text-6xl lg:text-7xl text-slate-950 mt-5">
              Vendez, proposez,
              <br />
              <span className="u-underline">rencontrez</span>.
            </h1>

            <p className="mt-7 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
              LoveRose réunit les annonces, les services et les rencontres dans une
              seule application. Publiez en deux minutes, encaissez par Mobile Money,
              échangez en toute confiance.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => onNavigate("/inscription")}
                className="h-13 px-7 bg-rose-500 hover:bg-rose-600 text-white font-bold text-base rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                Créer un compte gratuit
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => onNavigate("/connexion")}
                className="h-13 px-7 bg-white border border-slate-300 hover:border-slate-900 text-slate-800 hover:text-slate-950 font-bold text-base rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
              >
                J'ai déjà un compte
              </button>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-2">
                <BadgeCheck size={16} className="text-rose-500" />
                Profils vérifiés
              </span>
              <span className="inline-flex items-center gap-2">
                <Shield size={16} className="text-rose-500" />
                Paiement sécurisé
              </span>
              <span className="inline-flex items-center gap-2">
                <Smartphone size={16} className="text-rose-500" />
                Installable sur mobile
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FONCTIONNALITÉS ================= */}
      <section className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
        <div className="max-w-2xl">
          <span className="u-kicker text-rose-600">Ce que vous pouvez faire</span>
          <h2 className="u-display text-3xl sm:text-5xl text-slate-950 mt-3">
            Une seule app, trois usages
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 border-t border-slate-200">
          {FEATURES.map(({ Icon, title, body }, i) => (
            <div
              key={title}
              className={`py-9 md:px-8 md:py-10 border-b md:border-b-0 border-slate-200 ${
                i > 0 ? "md:border-l" : "md:pl-0"
              } ${i === FEATURES.length - 1 ? "md:pr-0" : ""}`}
            >
              <span className="u-display text-5xl text-slate-200 leading-none">
                0{i + 1}
              </span>
              <Icon size={24} className="text-rose-500 mt-5" />
              <h3 className="u-display text-2xl text-slate-950 mt-4">{title}</h3>
              <p className="mt-3 text-[15px] text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= SÉCURITÉ (bloc encre) ================= */}
      <section className="bg-slate-950 text-white">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="u-kicker text-rose-400">Confiance & sécurité</span>
            <h2 className="u-display text-3xl sm:text-5xl text-white mt-3 leading-[1.05]">
              Un environnement que nous surveillons de près
            </h2>
            <p className="mt-6 text-slate-300 text-base leading-relaxed">
              Nous luttons activement contre les faux profils et les arnaques.
              Vérification d'identité, modération des photos et signalement réactif :
              chaque échange se fait sur des bases saines.
            </p>
            <ul className="mt-8 space-y-3.5">
              {[
                "Vérification d'identité des vendeurs et créateurs",
                "Détection automatique des spams et contenus interdits",
                "Signalement traité par une équipe humaine",
                "Plateforme strictement réservée aux 18 ans et plus",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] text-slate-200">
                  <CheckCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 sm:p-10">
            <h3 className="u-display text-3xl text-white">Prêt à commencer ?</h3>
            <p className="mt-3 text-slate-400 text-[15px] leading-relaxed">
              L'inscription est gratuite et prend moins de deux minutes. Aucune carte
              bancaire n'est demandée.
            </p>
            <div className="mt-8 space-y-3">
              <button
                onClick={() => onNavigate("/inscription")}
                className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                Commencer gratuitement
                <ArrowRight size={17} />
              </button>
              <button
                onClick={() => onNavigate("/connexion")}
                className="w-full h-12 border border-slate-700 hover:border-slate-500 text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TARIFS ================= */}
      <section className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <span className="u-kicker text-rose-600">Tarifs</span>
            <h2 className="u-display text-3xl sm:text-5xl text-slate-950 mt-3 leading-[1.05]">
              Gratuit. Vraiment.
            </h2>
            <p className="mt-6 text-slate-600 text-base leading-relaxed">
              LoveRose ne vend ni abonnement, ni option de mise en avant. Seuls les
              membres fixent le prix de leurs propres annonces, encaissé directement
              par Mobile Money via Money&nbsp;Fusion.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
              <h3 className="u-display text-2xl text-slate-950">Compte membre</h3>
              <p className="u-display text-4xl text-rose-500">0 F</p>
            </div>
            <ul className="mt-6 space-y-3.5">
              {[
                "Publication d'annonces illimitée",
                "Recherche et navigation sans restriction",
                "Matchs et messagerie inclus",
                "Jusqu'à 20 photos de profil",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[15px] text-slate-700">
                  <CheckCircle size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= TÉMOIGNAGES ================= */}
      <section className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-24">
          <div className="max-w-2xl">
            <span className="u-kicker text-rose-600">Témoignages</span>
            <h2 className="u-display text-3xl sm:text-5xl text-slate-950 mt-3">
              Ils utilisent LoveRose
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="bg-slate-50 border border-slate-200 rounded-xl p-8 flex flex-col"
              >
                <Quote size={26} className="text-rose-300" />
                <blockquote className="mt-4 flex-1 font-display text-xl leading-snug text-slate-900">
                  « {t.quote} »
                </blockquote>
                <div className="flex items-center gap-1 text-amber-500 mt-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <figcaption className="flex items-center gap-3 mt-4 pt-5 border-t border-slate-200">
                  <span className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {t.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{t.name}</span>
                    <span className="block text-xs text-slate-500">{t.place}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ================= APPEL À L'ACTION FINAL ================= */}
      <section className="bg-rose-500">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20 flex flex-col md:flex-row items-center justify-between gap-8">
          <h2 className="u-display text-3xl sm:text-4xl text-white text-center md:text-left max-w-xl">
            Votre prochaine vente — ou votre prochaine rencontre — commence ici.
          </h2>
          <button
            onClick={() => onNavigate("/inscription")}
            className="h-13 px-8 bg-white text-rose-600 hover:bg-rose-50 font-bold text-base rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2 flex-shrink-0"
          >
            Rejoindre LoveRose
            <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
