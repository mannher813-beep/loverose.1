import React, { useState } from "react";
import { Shield, Lock, Mail, Check, AlertCircle } from "lucide-react";

interface LegalProps {
  onClose?: () => void;
  initialTab?: 'terms' | 'privacy' | 'contact';
}

export default function Legal({ onClose, initialTab = 'terms' }: LegalProps) {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'contact'>(initialTab);
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [formSent, setFormSent] = useState(false);

  const handleSubmitContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.email || !contactForm.message) {
      alert("Veuillez remplir les champs obligatoires (Email et Message).");
      return;
    }
    setFormSent(true);
    setContactForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-150 p-6 md:p-8 max-w-4xl mx-auto shadow-sm space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">Informations Légales & Contact</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Vérification AdSense & Conformité Réglementaire</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-xs font-bold text-rose-500 hover:text-rose-600 transition cursor-pointer">
            Fermer
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1.5 bg-slate-100 p-1.5 rounded-2xl">
        <button
          onClick={() => { setActiveTab('terms'); setFormSent(false); }}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${
            activeTab === 'terms' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield size={14} />
          <span>CGU</span>
        </button>
        <button
          onClick={() => { setActiveTab('privacy'); setFormSent(false); }}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${
            activeTab === 'privacy' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Lock size={14} />
          <span>Confidentialité</span>
        </button>
        <button
          onClick={() => { setActiveTab('contact'); setFormSent(false); }}
          className={`flex-1 py-2 text-center text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center justify-center space-x-1.5 ${
            activeTab === 'contact' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail size={14} />
          <span>Contactez-nous</span>
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 text-xs text-slate-600 leading-relaxed font-medium">
        {activeTab === 'terms' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-1">Conditions Générales d'Utilisation (CGU)</h3>
            <p><strong>Dernière mise à jour : 27 Juin 2026</strong></p>
            <p>Bienvenue sur <strong>LoveRose</strong>. En accédant à nos services de rencontre et d'écosystème de créateurs de contenu, vous acceptez pleinement et sans réserve les présentes conditions.</p>
            
            <h4 className="font-extrabold text-slate-800 mt-3">1. Description des Services</h4>
            <p>LoveRose est une plateforme sociale combinant des fonctionnalités de rencontre géolocalisée en Afrique Francophone (Cameroun, Côte d'Ivoire, Sénégal, etc.) et un espace de monétisation pour les créateurs de contenu indépendants. L'inscription de base est gratuite, avec des options payantes et des formules d'abonnements.</p>

            <h4 className="font-extrabold text-slate-800 mt-3">2. Éligibilité et Inscription</h4>
            <p>Vous devez être âgé d'au moins 18 ans pour vous inscrire et utiliser LoveRose. Vous vous engagez à fournir des informations exactes et sincères sur votre identité.</p>

            <h4 className="font-extrabold text-slate-800 mt-3">3. Comportement des Utilisateurs</h4>
            <p>Tout comportement malveillant, harcèlement, usurpation d'identité, fraude ou publication de contenu pornographique non consenti est strictement interdit. Nous appliquons une tolérance zéro et suspendrons immédiatement les comptes contrevenants sans remboursement.</p>

            <h4 className="font-extrabold text-slate-800 mt-3">4. Responsabilité</h4>
            <p>LoveRose ne saurait être tenue pour responsable des rencontres réelles effectuées entre membres ou des transactions de monétisation effectuées via des opérateurs de paiement tiers comme Money Fusion.</p>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-1">Politique de Confidentialité & Données</h3>
            <p><strong>Dernière mise à jour : 27 Juin 2026</strong></p>
            <p>Chez <strong>LoveRose</strong>, nous prenons la protection de vos données personnelles très au sérieux. Cette politique vous explique comment nous collectons, utilisons et protégeons vos données.</p>

            <h4 className="font-extrabold text-slate-800 mt-3">1. Informations que nous collectons</h4>
            <p>Nous collectons les données que vous fournissez directement lors de la création de votre profil (nom, email, numéro, photos, préférences de rencontre, géolocalisation pour calculer la distance des profils, et documents d'identité pour la vérification des créateurs).</p>

            <h4 className="font-extrabold text-slate-800 mt-3">2. Utilisation de vos données</h4>
            <p>Vos données sont exclusivement utilisées pour faire fonctionner l'application (calcul des distances, messagerie, notifications de likes et de matchs, traitement sécurisé des paiements et des reversements créateurs).</p>

            <h4 className="font-extrabold text-slate-800 mt-3">3. Partage et Sécurité</h4>
            <p>Nous ne vendons ni ne louons vos données personnelles à des tiers. Les transactions financières sont déléguées de manière sécurisée à notre partenaire Money Fusion via des protocoles chiffrés.</p>

            <h4 className="font-extrabold text-slate-800 mt-3">4. Vos droits (RGPD et lois locales)</h4>
            <p>Vous disposez d'un droit d'accès, de rectification et de suppression complète de vos données personnelles à tout moment, directement depuis les paramètres de votre compte ou en nous contactant.</p>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-5">
            <h3 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-1">Formulaire de Contact Officiel</h3>
            
            {formSent ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Check size={20} />
                </div>
                <h4 className="font-bold text-slate-800">Message envoyé !</h4>
                <p className="text-[11px] text-slate-500">Nous vous répondrons par e-mail dans les plus brefs délais (généralement sous 24h).</p>
                <button
                  onClick={() => setFormSent(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] rounded-lg transition"
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitContact} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Votre Nom (Optionnel)</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Ex: Jean Paul"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Adresse Email <span className="text-rose-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="votre-email@exemple.com"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Sujet / Motif</label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    placeholder="Ex: Question sur la monétisation, problème technique"
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Votre Message <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Saisissez votre message détaillé ici..."
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  <Mail size={14} />
                  <span>Envoyer ma demande</span>
                </button>
              </form>
            )}

            <div className="flex items-center space-x-2 bg-slate-50 p-4 border border-slate-150 rounded-2xl text-[10px] text-slate-500">
              <AlertCircle size={14} className="text-slate-400 flex-shrink-0" />
              <span>Pour toute question urgente concernant les paiements Money Fusion, veuillez inclure votre référence de transaction.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
