import React from "react";
import { Lock, BookOpen } from "lucide-react";

export default function PublicPrivacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8 text-left">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 text-rose-500 rounded-3xl">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">Politique de Confidentialité</h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto uppercase tracking-widest font-extrabold text-[10px]">
          Dernière mise à jour : 28 Juin 2026
        </p>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6 text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>1. Introduction et Responsable de Traitement</span>
          </h2>
          <p>
            Chez <strong>LoveRose</strong>, la confidentialité et la sécurité de vos données personnelles sont absolues. La présente Politique de Confidentialité vous informe en toute transparence sur la manière dont nous collectons, stockons, utilisons et protégeons vos données.
          </p>
          <p>
            Le responsable du traitement des données est LoveRose International SAS. Pour toute question relative à vos données personnelles, vous pouvez nous écrire à <a href="mailto:privacy@loverose.com" className="text-rose-500 underline">privacy@loverose.com</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>2. Informations que nous collectons</span>
          </h2>
          <p>
            Nous collectons uniquement les informations strictement nécessaires au bon fonctionnement de nos services de rencontre et de l'espace créateurs :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li><strong>Données de profil d'onboarding</strong> : nom complet, adresse e-mail, âge, genre, préférences, photos de profil, description personnelle, et intentions de relation.</li>
            <li><strong>Données de géolocalisation</strong> : avec votre consentement, nous collectons les coordonnées GPS de votre appareil pour calculer la distance approximative séparant votre profil de celui d'autres membres (afin de vous suggérer des rencontres pertinentes). Vos coordonnées exactes ne sont jamais affichées.</li>
            <li><strong>Contenus publiés</strong> : publications (photos, vidéos, textes), commentaires, likes, et messages envoyés via notre messagerie interne sécurisée.</li>
            <li><strong>Données d'identité pour certification (Créateurs uniquement)</strong> : pièce d'identité officielle et selfie de vérification, collectés uniquement pour vérifier et certifier l'identité des créateurs éligibles à la monétisation.</li>
            <li><strong>Données techniques</strong> : adresse IP, informations de l'appareil de connexion, cookies techniques nécessaires à l'authentification et à la sécurité.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>3. Utilisation de vos données</span>
          </h2>
          <p>
            Vos données personnelles sont traitées pour les finalités suivantes :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>La mise en relation des profils et le calcul des distances de géolocalisation.</li>
            <li>L'administration technique de votre compte, la sécurisation de l'accès à vos informations et la lutte contre les fraudes.</li>
            <li>L'envoi de notifications de likes, de matchs et de nouveaux messages reçus.</li>
            <li>Le traitement des demandes d'assistance envoyées via nos formulaires de contact.</li>
            <li>Le traitement chiffré et le reversement des gains créateurs par Mobile Money, en conformité avec les réglementations en vigueur.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>4. Durée de conservation des données</span>
          </h2>
          <p>
            Vos données personnelles sont conservées tant que votre compte utilisateur est actif sur la Plateforme. En cas de suppression de votre compte, toutes vos données (profil, messages, photos, correspondances) sont immédiatement et définitivement supprimées de nos serveurs de production.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>5. Cookies et Publicités Personnalisées (AdSense)</span>
          </h2>
          <p>
            LoveRose utilise des cookies de session pour maintenir votre connexion ouverte et sécuriser vos requêtes. 
          </p>
          <p>
            De plus, nous diffusons des publicités via <strong>Google AdSense</strong>. Google utilise des cookies pour diffuser des annonces basées sur les visites antérieures des utilisateurs sur notre application ou sur d'autres sites web. Les cookies publicitaires de Google permettent à Google et à ses partenaires de diffuser des annonces basées sur votre navigation sur LoveRose et/ou d'autres sites. 
          </p>
          <p>
            Vous pouvez choisir de désactiver la publicité personnalisée dans les paramètres de votre compte Google, ou en consultant le site <a href="https://aboutads.info" target="_blank" rel="noreferrer" className="text-rose-500 underline">aboutads.info</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>6. Sécurité des Données</span>
          </h2>
          <p>
            Nous mettons en œuvre des mesures de sécurité physiques, techniques et organisationnelles rigoureuses pour protéger vos données contre tout accès non autorisé, altération, divulgation ou destruction. Toutes les communications avec nos bases de données sont entièrement chiffrées à l'aide de protocoles HTTPS/TLS de niveau industriel.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm sm:text-base font-black text-slate-900 border-b border-slate-100 pb-1 flex items-center gap-2">
            <BookOpen size={16} className="text-rose-500" />
            <span>7. Vos Droits d'Accès, de Rectification et de Suppression</span>
          </h2>
          <p>
            Conformément aux réglementations sur la protection des données personnelles (RGPD et législations locales), vous disposez à tout moment d'un droit d'accès, de rectification, de limitation de traitement et de suppression complète de vos données personnelles. Vous pouvez exercer ces droits :
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Directement depuis votre compte en mettant à jour vos informations ou en demandant la suppression de votre compte dans les paramètres de profil.</li>
            <li>En adressant une demande écrite accompagnée d'un justificatif d'identité à notre service de confidentialité par e-mail : <a href="mailto:privacy@loverose.com" className="text-rose-500 underline">privacy@loverose.com</a>.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
