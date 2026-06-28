import React, { useState } from "react";
import { Mail, Phone, MapPin, Send, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react";

export default function PublicContact() {
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.message) {
      alert("Veuillez remplir les champs requis (Adresse Email et Message).");
      return;
    }

    setIsSubmitting(true);
    // Simulate API delay, then set success statics
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-16 text-left">
      {/* Intro */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-3 bg-rose-50 text-rose-500 rounded-3xl">
          <Mail size={32} />
        </div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">Contactez-nous</h1>
        <p className="text-slate-500 text-sm max-w-xl mx-auto">
          Une suggestion, une question ou besoin d'assistance ? Notre support client dévoué est à votre disposition pour vous répondre sous 24h.
        </p>
      </section>

      {/* Grid Contact info / Form */}
      <div className="grid md:grid-cols-5 gap-12 items-start max-w-4xl mx-auto">
        {/* Contact Info */}
        <div className="md:col-span-2 space-y-8 bg-slate-900 text-white rounded-3xl p-8 shadow-xl border border-slate-850 relative overflow-hidden">
          <div className="absolute -bottom-10 -left-10 bg-rose-500/10 w-40 h-40 rounded-full blur-3xl" />
          
          <div className="space-y-2">
            <h3 className="text-lg font-bold">Nos Coordonnées</h3>
            <p className="text-slate-400 text-xs leading-relaxed">N'hésitez pas à nous écrire directement ou à utiliser notre formulaire ci-contre.</p>
          </div>

          <div className="space-y-6 pt-4 text-xs">
            <div className="flex items-start gap-3">
              <Mail size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-200">Email d'assistance</p>
                <a href="mailto:support@loverose.com" className="text-slate-400 hover:text-rose-300 transition break-all">
                  support@loverose.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-200">Siège social</p>
                <p className="text-slate-400 leading-relaxed">
                  LoveRose International SAS<br />
                  Rue des Jardins, Cocody<br />
                  Abidjan, Côte d'Ivoire
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-200">Support téléphonique</p>
                <p className="text-slate-400">+225 07 00 00 00 00</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 text-[10px] text-slate-300 border border-slate-700/50 flex gap-2">
            <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
            <span>Pour un traitement plus rapide, veuillez préciser votre nom complet et l'adresse email associée à votre compte LoveRose si vous en possédez un.</span>
          </div>
        </div>

        {/* Contact Form Container */}
        <div className="md:col-span-3 bg-white border border-slate-100 rounded-3xl p-8 shadow-sm">
          {isSuccess ? (
            <div className="text-center py-10 space-y-5">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-inner">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900">Message envoyé avec succès !</h3>
                <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
                  Merci d'avoir contacté LoveRose. Notre équipe d'assistance a bien reçu votre demande et vous répondra à l'adresse email fournie dans les plus brefs délais.
                </p>
              </div>
              <button
                onClick={() => setIsSuccess(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
              >
                Envoyer un nouveau message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Formulaire d'assistance</h3>
                <p className="text-slate-400 text-xs">Veuillez renseigner les détails de votre demande.</p>
              </div>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Votre Nom (Optionnel)</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Jean Paul"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Adresse Email <span className="text-rose-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="nom@exemple.com"
                      className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Sujet de votre demande</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Ex: Problème technique, demande de certification créateur, partenariat"
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Votre Message <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Saisissez en détail votre demande..."
                    className="w-full mt-1.5 p-3 bg-slate-50 border border-slate-200 focus:border-rose-450 focus:bg-white focus:ring-1 focus:ring-rose-200 outline-none rounded-xl font-bold transition text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-400 text-white font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer text-xs"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Envoyer le message</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
