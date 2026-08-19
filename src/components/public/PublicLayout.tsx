import React from "react";
import { Heart, Menu, X, ArrowRight, Shield, Globe, Mail } from "lucide-react";
import PublicHome from "./PublicHome";
import PublicAbout from "./PublicAbout";
import PublicFAQ from "./PublicFAQ";
import PublicContact from "./PublicContact";
import PublicTerms from "./PublicTerms";
import PublicPrivacy from "./PublicPrivacy";

interface PublicLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onShowAuth: (signUp: boolean) => void;
}

export default function PublicLayout({ currentPath, onNavigate, onShowAuth }: PublicLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Normalise path
  const normalizedPath = currentPath === "/" ? "/accueil" : currentPath;

  const renderContent = () => {
    switch (normalizedPath) {
      case "/accueil":
        return <PublicHome onNavigate={onNavigate} />;
      case "/a-propos":
        return <PublicAbout />;
      case "/faq":
        return <PublicFAQ />;
      case "/contact":
        return <PublicContact />;
      case "/conditions-d-utilisation":
        return <PublicTerms />;
      case "/politique-de-confidentialite":
        return <PublicPrivacy />;
      default:
        return <PublicHome onNavigate={onNavigate} />;
    }
  };

  const navLinks = [
    { label: "Accueil", path: "/accueil" },
    { label: "À Propos", path: "/a-propos" },
    { label: "FAQ", path: "/faq" },
    { label: "Contact", path: "/contact" },
  ];

  const handleLinkClick = (path: string) => {
    setMobileMenuOpen(false);
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800 antialiased overflow-x-hidden">
      {/* ============ EN-TÊTE ============ */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-6">
          <button
            onClick={() => handleLinkClick("/")}
            className="flex items-baseline gap-px cursor-pointer group flex-shrink-0"
            aria-label="Retour à l'accueil"
          >
            <span className="u-display text-[26px] leading-none text-slate-950">Love</span>
            <span className="u-display text-[26px] leading-none text-rose-500">Rose</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-1 mb-0.5 group-hover:scale-125 transition-transform" />
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Navigation du site">
            {navLinks.map((link) => {
              const isActive = normalizedPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => handleLinkClick(link.path)}
                  aria-current={isActive ? "page" : undefined}
                  className={`h-9 px-3.5 rounded-lg text-[13px] font-bold cursor-pointer transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => onShowAuth(false)}
              className="h-9 px-3 text-[13px] font-bold text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Connexion
            </button>
            <button
              onClick={() => onShowAuth(true)}
              className="h-9 px-4 bg-rose-500 hover:bg-rose-600 text-white text-[13px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
            >
              S'inscrire
              <ArrowRight size={14} />
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:border-slate-900 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      {/* Menu mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 flex flex-col p-5 gap-6 animate-fade-in border-t border-slate-200">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = normalizedPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => handleLinkClick(link.path)}
                  className={`text-left text-base font-bold py-3 px-4 rounded-lg transition ${
                    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 pt-5 flex flex-col gap-2.5">
            <button
              onClick={() => { setMobileMenuOpen(false); onShowAuth(false); }}
              className="w-full h-12 border border-slate-300 hover:border-slate-900 text-slate-800 font-bold rounded-lg transition cursor-pointer text-sm"
            >
              Connexion
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onShowAuth(true); }}
              className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              Créer un compte gratuit
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      <main className="flex-grow min-h-0 bg-slate-50">{renderContent()}</main>

      {/* ============ PIED DE PAGE ============ */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="max-w-6xl mx-auto px-5 py-14 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-baseline gap-px">
              <span className="u-display text-2xl text-white">Love</span>
              <span className="u-display text-2xl text-rose-400">Rose</span>
            </div>
            <p className="text-slate-400 text-[13px] leading-relaxed max-w-xs">
              Annonces, services et rencontres de confiance en Afrique francophone.
              Un espace vérifié, chaleureux et sécurisé.
            </p>
            <p className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
              <Globe size={14} />
              FR · EN · ES
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="u-kicker text-rose-400">Navigation</h4>
            <div className="flex flex-col gap-2.5 text-[13px]">
              {navLinks.map((l) => (
                <button
                  key={l.path}
                  onClick={() => handleLinkClick(l.path)}
                  className="text-left text-slate-400 hover:text-white transition cursor-pointer w-max"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="u-kicker text-rose-400">Légal</h4>
            <div className="flex flex-col gap-2.5 text-[13px]">
              <button onClick={() => handleLinkClick("/conditions-d-utilisation")} className="text-left text-slate-400 hover:text-white transition cursor-pointer w-max">
                Conditions d'utilisation
              </button>
              <button onClick={() => handleLinkClick("/politique-de-confidentialite")} className="text-left text-slate-400 hover:text-white transition cursor-pointer w-max">
                Confidentialité
              </button>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-300 pt-1">
                <Shield size={13} />
                Réservé aux 18 ans et plus
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="u-kicker text-rose-400">Support</h4>
            <p className="text-slate-400 text-[13px] leading-relaxed">
              Une question technique ou sur la monétisation ?
            </p>
            <a
              href="mailto:techsen237@gmail.com"
              className="inline-flex items-center gap-2 text-[13px] text-white hover:text-rose-300 transition underline underline-offset-4 decoration-slate-600"
            >
              <Mail size={14} className="text-rose-400" />
              techsen237@gmail.com
            </a>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} LoveRose. Tous droits réservés.</p>
            <p>LoveRose International SAS — Abidjan, Côte d'Ivoire</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
