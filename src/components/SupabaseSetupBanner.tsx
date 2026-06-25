import { useState } from "react";
import { Copy, Check, Database, Key, ShieldAlert } from "lucide-react";

export default function SupabaseSetupBanner() {
  const [copied, setCopied] = useState(false);

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
CREATE POLICY "Lecture de son propre historique de transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- 4. Table likes
CREATE TABLE IF NOT EXISTS public.likes (
    from_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    to_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (from_uid, to_uid)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chaque utilisateur gère ses propres likes" ON public.likes FOR ALL USING (auth.uid() = from_uid);

-- 5. Table matches
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    users UUID[] NOT NULL, -- [uid1, uid2]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
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
