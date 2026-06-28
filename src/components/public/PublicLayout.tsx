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
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div 
          onClick={() => handleLinkClick("/")}
          className="flex items-center space-x-2 cursor-pointer group"
        >
          <div className="bg-rose-500 p-2 rounded-xl text-white group-hover:scale-105 transition-all">
            <Heart size={20} fill="currentColor" />
          </div>
          <div>
            <span className="font-black text-xl tracking-tight text-slate-900">Love</span>
            <span className="font-black text-xl tracking-tight text-rose-500">Rose</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8 text-xs font-bold text-slate-600">
          {navLinks.map((link) => {
            const isActive = normalizedPath === link.path;
            return (
              <button
                key={link.path}
                onClick={() => handleLinkClick(link.path)}
                className={`transition-colors hover:text-rose-500 cursor-pointer py-1 ${
                  isActive ? "text-rose-500 font-extrabold border-b-2 border-rose-500" : ""
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Desktop Auth Controls */}
        <div className="hidden md:flex items-center space-x-4">
          <button
            onClick={() => onShowAuth(false)}
            className="text-xs font-bold text-slate-600 hover:text-rose-500 transition cursor-pointer"
          >
            Se connecter
          </button>
          <button
            onClick={() => onShowAuth(true)}
            className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>S'inscrire</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[65px] bg-white z-40 flex flex-col p-6 space-y-6 animate-fade-in border-t border-slate-100">
          <div className="flex flex-col space-y-4">
            {navLinks.map((link) => {
              const isActive = normalizedPath === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => handleLinkClick(link.path)}
                  className={`text-left text-sm font-bold py-2.5 px-4 rounded-xl transition ${
                    isActive ? "bg-rose-50 text-rose-500 font-black" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-col gap-3">
            <button
              onClick={() => { setMobileMenuOpen(false); onShowAuth(false); }}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer text-xs"
            >
              Se connecter
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); onShowAuth(true); }}
              className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-extrabold rounded-xl transition shadow-md cursor-pointer text-xs flex items-center justify-center gap-1.5"
            >
              <span>Créer un compte</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-grow min-h-0 bg-slate-50">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white border-t border-slate-850">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-10 text-left">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="bg-rose-500 p-2 rounded-xl text-white">
                <Heart size={16} fill="currentColor" />
              </div>
              <span className="font-black text-lg tracking-tight text-white">LoveRose</span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              La plateforme de rencontres sérieuses et de monétisation pour créateurs en Afrique et à l'international. Un espace chaleureux, sincère et certifié.
            </p>
            <div className="flex items-center gap-3 text-slate-500 text-xs font-semibold">
              <Globe size={14} />
              <span>FR | EN | ES</span>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-rose-400">Navigation</h4>
            <div className="flex flex-col space-y-2 text-xs">
              <button onClick={() => handleLinkClick("/accueil")} className="text-left text-slate-400 hover:text-white transition cursor-pointer">Accueil</button>
              <button onClick={() => handleLinkClick("/a-propos")} className="text-left text-slate-400 hover:text-white transition cursor-pointer">À Propos</button>
              <button onClick={() => handleLinkClick("/faq")} className="text-left text-slate-400 hover:text-white transition cursor-pointer">Foire Aux Questions</button>
              <button onClick={() => handleLinkClick("/contact")} className="text-left text-slate-400 hover:text-white transition cursor-pointer">Contactez-nous</button>
            </div>
          </div>

          {/* Legal Links */}
          <div className="space-y-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-rose-400">Légal</h4>
            <div className="flex flex-col space-y-2 text-xs">
              <button onClick={() => handleLinkClick("/conditions-d-utilisation")} className="text-left text-slate-400 hover:text-white transition cursor-pointer">Conditions d'Utilisation (CGU)</button>
              <button onClick={() => handleLinkClick("/politique-de-confidentialite")} className="text-left text-slate-400 hover:text-white transition cursor-pointer">Politique de Confidentialité</button>
              <span className="text-[10px] text-red-400 font-extrabold flex items-center gap-1.5 pt-1">
                <Shield size={12} />
                <span>Majeurs de 18 ans et plus</span>
              </span>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="font-black text-xs uppercase tracking-wider text-rose-400">Support Client</h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Pour toute question technique, d'utilisation ou de monétisation, contactez notre support officiel.
            </p>
            <div className="flex items-center gap-2 pt-1 text-xs">
              <Mail size={14} className="text-rose-400" />
              <a href="mailto:support@loverose.com" className="text-slate-300 hover:text-rose-300 transition underline">
                support@loverose.com
              </a>
            </div>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="bg-slate-950 py-6 px-6 text-center text-slate-500 text-[10px] font-medium border-t border-slate-900">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} LoveRose. Tous droits réservés. Développé pour des connexions authentiques.</p>
            <p className="text-slate-600">LoveRose International SAS - Abidjan, Côte d'Ivoire</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
