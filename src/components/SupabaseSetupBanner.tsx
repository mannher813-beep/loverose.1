import { useState, useEffect } from "react";
import { Copy, Check, Database, Key, ShieldAlert, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function SupabaseSetupBanner() {
  const [copied, setCopied] = useState(false);
  const [dbStatus, setDbStatus] = useState<{
    urlConfigured: boolean;
    anonKeyConfigured: boolean;
    serviceKeyConfigured: boolean;
    urlPrefix: string;
    testConnection: string;
    errorMessage: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/debug-supabase")
      .then((res) => res.json())
      .then((data) => {
        setDbStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching database status:", err);
        setLoading(false);
      });
  }, []);

  const sqlSchema = `-- ==========================================
-- SCHEMA DE BASE DE DONNEES POUR LOVEROSE
-- ==========================================

-- 1. Table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    uid UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    age INTEGER CHECK (age >= 18),
    location TEXT,
    gender TEXT CHECK (gender IN ('homme', 'femme', 'autre')),
    preferences TEXT CHECK (preferences IN ('homme', 'femme', 'tous')),
    relationship_intents TEXT[] DEFAULT '{}',
    role TEXT DEFAULT 'user',
    verification_status TEXT DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'verified')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Active RLS sur profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Les profils sont visibles par tous" ON public.profiles;
DROP POLICY IF EXISTS "Chaque utilisateur peut modifier son propre profil" ON public.profiles;
CREATE POLICY "Les profils sont visibles par tous" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Chaque utilisateur peut modifier son propre profil" ON public.profiles FOR ALL USING (auth.uid() = uid);

-- 2. Table user_credits (Solde de crédits)
CREATE TABLE IF NOT EXISTS public.user_credits (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    balance INTEGER DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture de son propre solde de crédits" ON public.user_credits;
CREATE POLICY "Lecture de son propre solde de crédits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);

-- 3. Table credit_transactions (Historique des transactions de crédits)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type TEXT CHECK (type IN ('purchase', 'spend')),
    description TEXT,
    reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture de son propre historique de transactions" ON public.credit_transactions;
CREATE POLICY "Lecture de son propre historique de transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- 4. Table likes
CREATE TABLE IF NOT EXISTS public.likes (
    from_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (from_uid, to_uid)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chaque utilisateur gère ses propres likes" ON public.likes;
CREATE POLICY "Chaque utilisateur gère ses propres likes" ON public.likes FOR ALL USING (auth.uid() = from_uid);

-- 5. Table matches
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    users UUID[] NOT NULL, -- [uid1, uid2]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Les utilisateurs lisent leurs propres matches" ON public.matches;
CREATE POLICY "Les utilisateurs lisent leurs propres matches" ON public.matches FOR SELECT USING (auth.uid() = ANY(users));

-- 6. Table messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    lu BOOLEAN DEFAULT false
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture des messages de ses matches" ON public.messages;
DROP POLICY IF EXISTS "Insertion de messages dans ses matches" ON public.messages;
CREATE POLICY "Lecture des messages de ses matches" ON public.messages FOR SELECT USING (
    auth.uid() IN (SELECT unnest(users) FROM public.matches WHERE id = match_id)
);
CREATE POLICY "Insertion de messages dans ses matches" ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND auth.uid() IN (SELECT unnest(users) FROM public.matches WHERE id = match_id)
);

-- 7. Table notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    lu BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chaque utilisateur lit ses propres notifications" ON public.notifications;
DROP POLICY IF EXISTS "Chaque utilisateur peut modifier le statut lu de ses notifications" ON public.notifications;
CREATE POLICY "Chaque utilisateur lit ses propres notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Chaque utilisateur peut modifier le statut lu de ses notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 8. Table posts (Fil d'actualité)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    contenu TEXT NOT NULL,
    medias TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Les posts sont visibles par tous" ON public.posts;
DROP POLICY IF EXISTS "Chaque utilisateur gère ses propres posts" ON public.posts;
CREATE POLICY "Les posts sont visibles par tous" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Chaque utilisateur gère ses propres posts" ON public.posts FOR ALL USING (auth.uid() = author_id);

-- 9. Table payments (Enregistrements de transactions Money Fusion)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    montant INTEGER NOT NULL,
    statut TEXT CHECK (statut IN ('pending', 'success', 'failed')),
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    reference TEXT UNIQUE NOT NULL,
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Les utilisateurs lisent leurs propres transactions de paiement" ON public.payments;
CREATE POLICY "Les utilisateurs lisent leurs propres transactions de paiement" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- 10. Table subscriptions (Abonnements Premium)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    type TEXT DEFAULT 'none' CHECK (type IN ('premium', 'none')),
    status TEXT DEFAULT 'none' CHECK (status IN ('active', 'expired', 'none')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chaque utilisateur lit son propre abonnement" ON public.subscriptions;
CREATE POLICY "Chaque utilisateur lit son propre abonnement" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 11. Table verification_requests
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    documents TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chaque utilisateur gère ses demandes de vérification" ON public.verification_requests;
CREATE POLICY "Chaque utilisateur gère ses demandes de vérification" ON public.verification_requests FOR ALL USING (auth.uid() = user_id);

-- 12. Table reports (Signalements)
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reported_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    motif TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chaque utilisateur lit ses propres signalements" ON public.reports;
DROP POLICY IF EXISTS "Chaque utilisateur peut insérer ses propres signalements" ON public.reports;
CREATE POLICY "Chaque utilisateur lit ses propres signalements" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "Chaque utilisateur peut insérer ses propres signalements" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);


-- ==========================================
-- TRIGGERS SQL AUTOMATIQUES (MATCH MUTUEL)
-- ==========================================

-- Trigger pour créer automatiquement un MATCH réciproque
CREATE OR REPLACE FUNCTION public.handle_reciprocal_like()
RETURNS TRIGGER AS $$
BEGIN
    -- Vérifie si l'autre personne a également liké cet utilisateur
    IF EXISTS (
        SELECT 1 FROM public.likes 
        WHERE from_uid = NEW.to_uid AND to_uid = NEW.from_uid
    ) THEN
        -- Crée le match s'il n'existe pas déjà
        IF NOT EXISTS (
            SELECT 1 FROM public.matches 
            WHERE (users @> ARRAY[NEW.from_uid, NEW.to_uid]::UUID[])
        ) THEN
            INSERT INTO public.matches (users) 
            VALUES (ARRAY[NEW.from_uid, NEW.to_uid]::UUID[]);
            
            -- Envoie des notifications de match
            INSERT INTO public.notifications (user_id, sender_id, type, content)
            VALUES 
                (NEW.from_uid, NEW.to_uid, 'match', 'Félicitations ! Vous avez un nouveau Match !'),
                (NEW.to_uid, NEW.from_uid, 'match', 'Félicitations ! Vous avez un nouveau Match !');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION public.handle_reciprocal_like();


-- Trigger pour décrémenter le crédit ou valider le message gratuit
-- Lors de l'envoi d'un message, on valide et décrémente si nécessaire
CREATE OR REPLACE FUNCTION public.validate_and_charge_message()
RETURNS TRIGGER AS $$
DECLARE
    msg_count INTEGER;
    sender_credits INTEGER;
    is_premium BOOLEAN;
    word_count INTEGER;
BEGIN
    -- 1. Vérifie si le sender est Premium (messages illimités)
    SELECT EXISTS (
        SELECT 1 FROM public.subscriptions 
        WHERE user_id = NEW.sender_id AND type = 'premium' AND status = 'active'
    ) INTO is_premium;

    IF is_premium THEN
        RETURN NEW; -- Premium a les messages gratuits illimités
    END IF;

    -- 2. Compte combien de messages ont été envoyés par ce sender dans ce match
    SELECT COUNT(*) FROM public.messages 
    WHERE match_id = NEW.match_id AND sender_id = NEW.sender_id INTO msg_count;

    -- 3. Si c'est un des 3 premiers messages gratuits
    IF msg_count < 3 THEN
        -- Validation stricte : max 10 mots, uniquement des lettres (pas de chiffres)
        -- On calcule le nombre de mots en comptant les espaces + 1
        word_count := array_length(regexp_split_to_array(trim(NEW.contenu), '\\s+'), 1);
        
        IF word_count > 10 THEN
            RAISE EXCEPTION 'Les messages gratuits sont limités à 10 mots maximum.';
        END IF;

        IF NEW.contenu ~ '[0-9]' THEN
            RAISE EXCEPTION 'Les messages gratuits ne doivent pas contenir de chiffres.';
        END IF;

        RETURN NEW;
    END IF;

    -- 4. Si les messages gratuits sont épuisés, on vérifie et décrémente le solde de crédits
    SELECT balance FROM public.user_credits WHERE user_id = NEW.sender_id INTO sender_credits;
    
    IF sender_credits IS NULL OR sender_credits < 1 THEN
        RAISE EXCEPTION 'Crédits insuffisants. Veuillez recharger votre solde de crédits.';
    END IF;

    -- Décrémente le solde
    UPDATE public.user_credits 
    SET balance = balance - 1, updated_at = NOW() 
    WHERE user_id = NEW.sender_id;

    -- Insère la transaction de crédit
    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (NEW.sender_id, 1, 'spend', 'Consommation message match');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_sending ON public.messages;
CREATE TRIGGER on_message_sending
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.validate_and_charge_message();
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="supabase-setup" className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white min-h-screen flex flex-col justify-center items-center p-6 font-sans">
      <div className="max-w-3xl w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-4">
          <div className="bg-red-500/10 p-4 rounded-2xl text-red-400">
            <ShieldAlert size={36} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuration de Supabase Requise</h1>
            <p className="text-slate-400 text-sm">Veuillez connecter votre projet Supabase réel pour démarrer LoveRose.</p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-300 space-y-2 leading-relaxed">
          <p className="font-semibold flex items-center">
            <Key className="mr-2" size={16} /> Étape 1 : Configurer les Variables d'Environnement
          </p>
          <p>
            Veuillez définir les variables d'environnement suivantes dans les <strong>Secrets</strong> de l'interface Google AI Studio :
          </p>
          <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-amber-100/90 bg-black/30 p-3 rounded-xl mt-1">
            <li>VITE_SUPABASE_URL = "https://votre-projet.supabase.co"</li>
            <li>VITE_SUPABASE_ANON_KEY = "votre-cle-anon-publique"</li>
            <li>SUPABASE_SERVICE_ROLE_KEY = "votre-cle-service-role-secrete" (requis pour les crédits de paiement)</li>
          </ul>
        </div>

        {/* Section de Diagnostic de Connexion */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-slate-200 flex items-center">
              <Wifi className="mr-2 text-indigo-400" size={16} /> Diagnostic de Connexion Supabase en Temps Réel
            </h3>
            {loading ? (
              <span className="text-xs text-slate-500 animate-pulse">Vérification en cours...</span>
            ) : dbStatus?.testConnection === "success" ? (
              <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium flex items-center">
                <CheckCircle2 size={12} className="mr-1" /> Connecté à Supabase !
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full text-xs font-medium flex items-center">
                <WifiOff size={12} className="mr-1" /> Non Connecté
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-xs text-slate-400">Analyse des variables d'environnement et de la connexion...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-2 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                <p className="text-slate-400 font-medium">Statut des Secrets (Côté Serveur) :</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>VITE_SUPABASE_URL :</span>
                    <span className={dbStatus?.urlConfigured ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                      {dbStatus?.urlConfigured ? "Détecté ✅" : "Absent ❌"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>VITE_SUPABASE_ANON_KEY :</span>
                    <span className={dbStatus?.anonKeyConfigured ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                      {dbStatus?.anonKeyConfigured ? "Détecté ✅" : "Absent ❌"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>SUPABASE_SERVICE_ROLE_KEY :</span>
                    <span className={dbStatus?.serviceKeyConfigured ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                      {dbStatus?.serviceKeyConfigured ? "Détecté ✅" : "Absent ❌"}
                    </span>
                  </div>
                </div>
                {dbStatus?.availableKeys && dbStatus.availableKeys.length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-2">
                    <span className="font-semibold text-slate-300">Clés détectées :</span>{" "}
                    <span className="font-mono text-indigo-300 bg-black/40 px-1 py-0.5 rounded break-all">
                      {dbStatus.availableKeys.map(k => `"${k}"`).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2 bg-slate-900/50 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
                <div>
                  <p className="text-slate-400 font-medium">Test de Requête (Sélect) :</p>
                  <p className={`mt-1 font-semibold ${dbStatus?.testConnection === "success" ? "text-green-400" : "text-red-400"}`}>
                    {dbStatus?.testConnection === "success" 
                      ? "La base de données répond correctement ! 🎉" 
                      : "Échec de connexion ou d'exécution."}
                  </p>
                </div>
                {dbStatus?.errorMessage && (
                  <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-[10px] font-mono leading-relaxed max-h-20 overflow-y-auto">
                    {dbStatus.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && dbStatus?.testConnection !== "success" && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-[11px] text-slate-300 leading-normal flex items-start space-x-2">
              <AlertTriangle className="text-indigo-400 shrink-0 mt-0.5" size={14} />
              <div>
                <p className="font-semibold text-indigo-300">Conseil de résolution :</p>
                <p className="mt-0.5">
                  Si vous venez d'ajouter les secrets dans l'onglet <strong>Secrets</strong> de l'interface Google AI Studio, n'oubliez pas de cliquer sur le bouton <strong>"Apply changes"</strong> en bas à droite pour redémarrer le serveur et appliquer vos nouvelles variables !
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm flex items-center text-slate-300">
              <Database className="mr-2" size={16} /> Étape 2 : Initialiser le Schéma SQL de Supabase
            </h3>
            <button
              id="copy-sql-btn"
              onClick={copyToClipboard}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-xs font-medium transition cursor-pointer text-indigo-400"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-green-400" />
                  <span className="text-green-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copier le script SQL</span>
                </>
              )}
            </button>
          </div>

          <p className="text-slate-400 text-xs leading-relaxed">
            Copiez le script ci-dessous, accédez à votre tableau de bord <a href="https://supabase.com" target="_blank" className="text-indigo-400 hover:underline">Supabase</a>, ouvrez l'onglet <strong>SQL Editor</strong>, collez le script, puis cliquez sur <strong>Run</strong>. Cela configurera instantanément les tables de matches, messages, crédits, ainsi que les triggers automatiques.
          </p>

          <div className="relative bg-slate-950/90 border border-slate-850 rounded-2xl max-h-60 overflow-y-auto p-4 font-mono text-xs text-slate-300">
            <pre>{sqlSchema}</pre>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <p>LoveRose 100% Supabase Production Stack</p>
          <p className="text-slate-500">Port 3000 Node Container</p>
        </div>
      </div>
    </div>
  );
}
