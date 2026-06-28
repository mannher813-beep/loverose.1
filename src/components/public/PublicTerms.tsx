import React from "react";
import { Shield, BookOpen } from "lucide-react";

export default function PublicTerms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 text-left">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 text-rose-500 rounded-3xl">
          <Shield size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">Conditions Générales d'Utilisation (CGU)</h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto uppercase tracking-widest font-extrabold text-[10px]">
          Dernière mise à jour : 28 Juin 2026
        </p>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>1. Préambule et Acceptation</span>
          </h2>
          <p>
            Bienvenue sur <strong>LoveRose</strong> (ci-après désignée "l'Application" ou "la Plateforme"), une marque éditée par LoveRose International SAS. Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de tous les services fournis par LoveRose.
          </p>
          <p>
            En accédant à l'Application, en créant un compte d'utilisateur ou en consultant nos pages publiques, vous acceptez expressément et sans réserve l'intégralité des présentes conditions. Si vous n'acceptez pas l'une quelconque de ces clauses, veuillez cesser immédiatement l'utilisation de nos services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>2. Éligibilité et Âge Minimum Requis</span>
          </h2>
          <p>
            L'utilisation de la Plateforme LoveRose est strictement réservée aux personnes majeures, âgées de <strong>18 ans et plus</strong>. L'inscription des mineurs est strictement interdite. 
          </p>
          <p>
            En créant un compte, vous certifiez sur l'honneur avoir la capacité juridique de contracter et être majeur. LoveRose se réserve le droit de procéder à des vérifications et de suspendre ou supprimer immédiatement tout compte suspecté d'appartenir à un mineur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>3. Description des Services</span>
          </h2>
          <p>
            LoveRose est une plateforme sociale hybride regroupant :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Un service de rencontre géolocalisé permettant aux membres de découvrir d'autres profils, de s'envoyer des "likes", de "matcher" et d'échanger des messages textuels confidentiels.</li>
            <li>Un espace d'expression pour les créateurs de contenu indépendants ("Espace Créateurs") leur permettant de publier des photos, vidéos et articles dans un fil d'actualité public ou à destination de leurs abonnés.</li>
            <li>Des formules d'abonnements "Premium" payantes destinées à débloquer des avantages exclusifs sur la plateforme.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>4. Comportement des Membres et Règles de Conduite</span>
          </h2>
          <p>
            Dans le but de préserver un espace sain et respectueux, chaque membre s'engage à :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Fournir des informations véridiques lors de l'onboarding (vrai nom, vrai âge, description sincère).</li>
            <li>Ne publier aucun contenu obscène, pornographique, haineux, raciste, diffamatoire ou contraire aux bonnes mœurs.</li>
            <li>Respecter les autres membres. Le harcèlement, l'intimidation, l'usurpation d'identité et les spams sont rigoureusement interdits.</li>
            <li>Ne pas tenter d'escroquer les autres membres (demande d'argent sous de faux prétextes, phishing).</li>
          </ul>
          <p>
            Tout manquement à ces consignes entraînera la suspension immédiate et irréversible de votre compte sans indemnité, et pourra faire l'objet de poursuites judiciaires.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>5. Programme Créateurs et Reversements</span>
          </h2>
          <p>
            La création d'une page créateur est gratuite et ouverte à tous les membres éligibles. Toutefois, l'activation des options de monétisation (réception de paiements de soutien) est strictement subordonnée à la <strong>certification officielle de la page</strong>. 
          </p>
          <p>
            Les créateurs s'engagent à respecter les réglementations fiscales de leurs pays respectifs concernant les revenus perçus sur LoveRose. Les demandes de reversements s'effectuent par Mobile Money sécurisé à l'aide d'un code PIN défini par le créateur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>6. Propriété Intellectuelle</span>
          </h2>
          <p>
            Tous les contenus (textes, logos, chartes graphiques, codes sources, technologies) propres à LoveRose sont protégés par le droit d'auteur et restent notre propriété exclusive.
          </p>
          <p>
            En publiant du contenu (photos, textes, vidéos) sur LoveRose, vous nous concédez une licence mondiale, non exclusive et gratuite pour afficher, héberger et diffuser ce contenu uniquement dans le cadre du fonctionnement normal de la Plateforme.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>7. Résiliation de Compte</span>
          </h2>
          <p>
            Vous pouvez résilier votre compte à tout moment et gratuitement depuis les paramètres de votre profil. Cette action supprimera définitivement l'ensemble de vos données de nos bases de données.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>8. Droit Applicable et Litiges</span>
          </h2>
          <p>
            Les présentes CGU sont régies par le droit en vigueur au siège social de l'Application (Côte d'Ivoire). Pour tout différend, nous vous invitons à contacter notre support à l'adresse <a href="mailto:support@loverose.com" className="text-rose-500 underline">support@loverose.com</a> pour trouver une solution amiable avant toute action contentieuse.
          </p>
        </section>
      </div>
    </div>
  );
}
