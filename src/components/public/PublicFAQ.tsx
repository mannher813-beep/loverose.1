import React, { useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp, Search, MessageCircle } from "lucide-react";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

export default function PublicFAQ() {
  const [searchTerm, setSearchTerm] = useState("");
  const [openId, setOpenId] = useState<number | null>(1);

  const faqData: FAQItem[] = [
    {
      id: 1,
      category: "Général",
      question: "Qu'est-ce que LoveRose ?",
      answer: "LoveRose est une plateforme sociale et de rencontre de premier plan conçue pour connecter les célibataires sérieux en Afrique (Cameroun, Côte d'Ivoire, Sénégal, Bénin, Gabon, etc.) et à l'international. Elle intègre également un espace dédié pour les créateurs de contenu indépendants, offrant un fil d'actualité riche, des publications interactives, et des options de monétisation pour les talents locaux."
    },
    {
      id: 2,
      category: "Profil",
      question: "Comment créer un profil sur LoveRose ?",
      answer: "Pour créer un profil, cliquez sur le bouton 'S'inscrire' sur la page d'accueil. Renseignez votre nom complet, votre adresse e-mail, votre âge (minimum 18 ans obligatoire), vos préférences et votre genre. Après l'inscription, vous serez guidé à travers un onboarding fluide pour ajouter vos photos, votre description, votre localisation, et vos intentions de relation. C'est rapide, simple et 100% gratuit."
    },
    {
      id: 3,
      category: "Sécurité",
      question: "Comment LoveRose assure-t-elle ma sécurité ?",
      answer: "La sécurité est au cœur de notre service. Nous luttons activement contre les spams et les usurpations d'identité grâce à un contrôle strict des photos. De plus, toutes les pages créateurs passent par un protocole de certification d'identité officiel (pièce d'identité et selfie de contrôle). Vos données sensibles (coordonnées exactes, etc.) restent confidentielles et ne sont jamais divulguées."
    },
    {
      id: 4,
      category: "Sécurité",
      question: "Comment puis-je signaler un utilisateur suspect ou malveillant ?",
      answer: "Si vous constatez un comportement inapproprié (harcèlement, tentative de fraude, faux profil, propos déplacés), vous pouvez cliquer sur l'icône de drapeau ou l'option 'Signaler' présente sur chaque profil et publication. Notre équipe de modération étudie tous les signalements sous 24 heures et procède au bannissement immédiat des utilisateurs malveillants."
    },
    {
      id: 5,
      category: "Premium",
      question: "Quels sont les avantages de l'abonnement LoveRose Premium ?",
      answer: "L'abonnement Premium débloque des fonctionnalités exclusives : likes illimités, visibilité sur qui a visité votre profil, possibilité d'engager des conversations directes, filtres de recherche avancés et badge d'authenticité exclusif sur votre profil. Vous bénéficiez également d'un essai gratuit de 14 jours pour tester tous ces avantages dès votre inscription."
    },
    {
      id: 6,
      category: "Paiements",
      question: "Quels sont les moyens de paiement acceptés pour le Premium ?",
      answer: "Pour faciliter les transactions locales, nous acceptons les principaux opérateurs de Mobile Money largement utilisés en Afrique (Orange Money, MTN Mobile Money, Wave, Moov, etc.). Les transactions sont entièrement sécurisées et traitées de manière chiffrée. Aucune coordonnée bancaire n'est stockée sur nos serveurs."
    },
    {
      id: 7,
      category: "Créateurs",
      question: "Le programme créateur est-il payant ?",
      answer: "Non, le programme créateur LoveRose est désormais 100% gratuit ! Vous pouvez créer une page de créateur, publier du contenu, et attirer des abonnés sans aucun frais d'activation. Cependant, pour pouvoir recevoir des paiements de la part de vos abonnés (monétisation de contenu) et réclamer des reversements, votre page doit être soumise à notre protocole de certification d'identité gratuit pour des raisons réglementaires."
    },
    {
      id: 8,
      category: "Créateurs",
      question: "Comment puis-je réclamer mes revenus de créateur ?",
      answer: "Une fois votre page certifiée, vous pouvez configurer une méthode de retrait sécurisée par Mobile Money (Orange Money, MTN, etc.) directement depuis votre Tableau de bord Créateur. Vous devrez définir un code PIN de paiement de 4 chiffres. Chaque demande de paiement s'effectue simplement en saisissant votre code PIN, après vérification automatique de votre solde."
    },
    {
      id: 9,
      category: "Compte",
      question: "Comment supprimer définitivement mon compte et mes données ?",
      answer: "Vous êtes propriétaire de vos données. Vous pouvez supprimer définitivement votre profil et toutes vos publications à tout moment en accédant aux Paramètres de votre compte, puis dans la section de gestion du profil. Une fois la suppression validée, toutes vos informations personnelles, photos, messages et matchs sont définitivement supprimés de notre base de données sans possibilité de récupération."
    },
    {
      id: 10,
      category: "Confidentialité",
      question: "Où sont stockées mes données personnelles et sont-elles confidentielles ?",
      answer: "Vos données personnelles sont stockées sur des serveurs hautement sécurisés et gérées conformément à notre politique de confidentialité stricte. Seuls les éléments publics de votre profil (nom d'usage, description, photos que vous choisissez de partager) sont visibles par les autres membres inscrits. Nous ne vendons ni ne partageons vos données personnelles avec des régies publicitaires externes sans votre accord."
    }
  ];

  const filteredFaqs = faqData.filter(
    item =>
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleOpen = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-12 text-left">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 text-rose-500 rounded-3xl">
          <HelpCircle size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">Foire Aux Questions (FAQ)</h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          Trouvez des réponses rapides à toutes vos questions sur l'utilisation, la sécurité, l'abonnement Premium et l'Espace Créateurs de LoveRose.
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-md mx-auto relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Rechercher une question (ex: premium, créateur, paiement...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:border-rose-450 focus:ring-1 focus:ring-rose-200 outline-none transition shadow-sm"
        />
      </div>

      {/* Accordions */}
      <div className="space-y-4 max-w-3xl mx-auto">
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div
                key={faq.id}
                id={`faq-item-${faq.id}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleOpen(faq.id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left font-bold text-slate-800 hover:text-rose-500 transition cursor-pointer text-xs sm:text-sm"
                >
                  <div className="flex items-center space-x-3 pr-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-[9px] font-extrabold text-slate-500 rounded uppercase tracking-wider flex-shrink-0">
                      {faq.category}
                    </span>
                    <span>{faq.question}</span>
                  </div>
                  <span className="text-slate-400 flex-shrink-0">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 pt-1 border-t border-slate-50 text-xs text-slate-600 leading-relaxed font-medium">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-100 p-8 space-y-3">
            <p className="text-slate-500 text-xs font-semibold">Aucun résultat trouvé pour votre recherche.</p>
            <button
              onClick={() => setSearchTerm("")}
              className="text-xs text-rose-500 font-extrabold underline cursor-pointer hover:text-rose-600"
            >
              Réinitialiser la recherche
            </button>
          </div>
        )}
      </div>

      {/* Still need help CTA */}
      <div className="max-w-xl mx-auto bg-rose-50/50 rounded-3xl border border-rose-100/50 p-6 text-center space-y-4">
        <h3 className="font-extrabold text-slate-900 text-sm">Vous n'avez pas trouvé votre réponse ?</h3>
        <p className="text-slate-500 text-xs leading-relaxed">
          Notre équipe d'assistance est à votre écoute pour vous aider à résoudre tout problème technique ou répondre à vos suggestions.
        </p>
        <button
          onClick={() => {
            window.history.pushState(null, "", "/contact");
          }}
          className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 mx-auto cursor-pointer"
        >
          <MessageCircle size={14} />
          <span>Contacter le support</span>
        </button>
      </div>
    </div>
  );
}
