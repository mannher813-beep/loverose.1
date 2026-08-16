import { supabase } from "./supabase";

export type KycSlot = "photo_id_front" | "photo_id_back" | "selfie_face" | "selfie_left" | "selfie_right";

// Chemin de stockage : kyc-documents/{user_id}/{slot}.jpg
// Le préfixe {user_id} est ce qui permet aux policies RLS de restreindre
// chacun à son propre dossier (voir migration_kyc.sql).
export async function uploadKycFile(userId: string, slot: KycSlot, blob: Blob): Promise<string> {
  const path = `${userId}/${slot}.jpg`;
  const { error } = await supabase.storage
    .from("kyc-documents")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path; // on stocke le chemin, pas une URL — les URLs signées expirent
}

// ---------------------------------------------------------------------------
// Transformation d'un compte ANONYME (Supabase Auth signInAnonymously) en
// vrai compte, EN GARDANT le même auth.uid() — donc sans perdre le
// portefeuille créateur, les gains, l'historique, etc.
//
// ⚠️ Piège classique à éviter : NE PAS appeler supabase.auth.signUp() ou
// signInWithOAuth() ici, ça créerait un NOUVEL utilisateur déconnecté de
// l'ancien uid anonyme et de son solde. Il faut updateUser()/linkIdentity()
// sur la session anonyme existante.
// ---------------------------------------------------------------------------

// Email + mot de passe : lie l'email à la session anonyme actuelle. Selon la
// config Supabase (confirmations email activées ou non), un email de
// confirmation peut être nécessaire avant que is_anonymous passe à false.
export async function upgradeAnonymousWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return data;
}

// Google : lie l'identité OAuth à la session anonyme actuelle (redirige,
// puis revient sur redirectTo avec le même uid, maintenant non-anonyme).
export async function upgradeAnonymousWithGoogle(redirectTo: string) {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
  return data;
}
