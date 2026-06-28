import React from "react";
import { Shield, Award, Heart, CheckCircle2 } from "lucide-react";

export default function PublicAbout() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-16 text-left">
      {/* Intro */}
      <section className="space-y-6 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 text-rose-500 rounded-3xl">
          <Heart size={32} fill="currentColor" />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">À Propos de LoveRose</h1>
          <p className="text-slate-500 text-sm max-w-xl mx-auto uppercase tracking-widest font-extrabold text-[10px]">
            La mission d'unir les cœurs de manière authentique et sécurisée
          </p>
        </div>
        <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Fondée avec la volonté de révolutionner les rencontres en ligne en Afrique francophone et à l'international, <strong>LoveRose</strong> est bien plus qu'une simple application. C'est un espace bienveillant où la sincérité, le respect et la sécurité sont au cœur de chaque échange.
        </p>
      </section>

      {/* Mission & Vision */}
      <section className="grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Notre Mission</h2>
          <p className="text-slate-600 text-xs leading-relaxed">
            Nous pensons que tout le monde mérite de trouver un partenaire sérieux qui partage ses valeurs et ses aspirations de vie. Notre mission est de fournir la technologie la plus humaine, fluide et sécurisée possible pour connecter les célibataires qui recherchent de vraies relations, sans fioritures et en toute sérénité.
          </p>
          <p className="text-slate-600 text-xs leading-relaxed">
            De plus, nous valorisons l'expression personnelle et le divertissement à travers un écosystème créateurs intégré, permettant de s'abonner et d'interagir avec des influenceurs et créateurs talentueux de la communauté.
          </p>
        </div>
        <div className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100/50 space-y-4">
          <h3 className="font-extrabold text-slate-900 text-lg">Nos engagements clés</h3>
          <ul className="space-y-3 text-xs text-slate-600">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <span><strong>Zéro tolérance pour les faux profils</strong> : Chaque membre est incité à s'identifier de manière authentique.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <span><strong>Respect de la vie privée</strong> : Vos données de localisation et de contact ne sont jamais vendues ou partagées.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <span><strong>Accessibilité</strong> : Un service conçu pour fonctionner parfaitement même avec des connexions de données variables.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Values */}
      <section className="space-y-8">
        <h2 className="text-2xl font-black text-slate-900 text-center tracking-tight">Nos valeurs fondamentales</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Sécurité accrue</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Nous mettons en place des procédures de vérification par selfie et d'analyse des comportements pour garantir des échanges sans danger de fraude ou d'usurpation d'identité.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
              <Award size={20} />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Rencontres Authentiques</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Nous encourageons la sincérité des profils. Les membres indiquent clairement leurs intentions dès leur inscription afin d'éviter les malentendus.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Heart size={20} />
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm">Inclusivité & Respect</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              LoveRose accueille chaleureusement tous les horizons culturels et nationaux, en promouvant le respect mutuel entre tous les genres et origines.
            </p>
          </div>
        </div>
      </section>

      {/* Strict 18+ policy notice */}
      <section className="bg-slate-950 text-white rounded-3xl p-8 md:p-10 space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-black">
            18+
          </span>
          <h2 className="text-lg font-bold text-white">Politique d'âge strict et d'éligibilité</h2>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed max-w-2xl">
          L'utilisation de LoveRose est strictement réservée aux personnes majeures, âgées de 18 ans et plus au moment de leur inscription. Toute fausse déclaration sur l'âge entraînera le bannissement immédiat et irréversible du compte. Nous appliquons des vérifications automatiques et manuelles des profils afin de protéger notre communauté et d'assurer un espace conforme aux législations en vigueur.
        </p>
      </section>
    </div>
  );
}
