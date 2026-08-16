export interface Profile {
  uid: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  age?: number;
  location?: string;
  gender?: 'homme' | 'femme' | 'autre';
  preferences?: 'homme' | 'femme' | 'tous';
  relationship_intents?: string[]; // Amitié, Relation amoureuse, Rencontre d'un soir, Relation libertine, Business / networking
  role?: string;
  verification_status?: 'none' | 'pending' | 'verified';
  photos?: string[];
  created_at?: string;
  is_online?: boolean;
  last_seen?: string;
  latitude?: number;
  longitude?: number;
  location_updated_at?: string;
  preferred_language?: 'fr' | 'en';
  max_distance_km?: number;
  phone_country_code?: string;
  phone_number?: string;
  is_suspended?: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  suspended_at?: string | null;
  // Censure légère (shadow-ban) : masque les posts/annonces de l'utilisateur
  // du fil public sans suspendre son compte. Indépendant de is_suspended.
  is_hidden_from_feed?: boolean;
}

export interface Like {
  from_uid: string;
  to_uid: string;
  created_at?: string;
}

export interface Match {
  id: string;
  users: string[]; // [uid1, uid2]
  created_at: string;
  // Join properties populated for UI convenience
  other_profile?: Profile;
  last_message?: string;
  last_message_time?: string;
  free_messages_left?: { [uid: string]: number }; // map uid -> remaining count
}

export interface Message {
  id?: string;
  match_id: string;
  sender_id: string;
  contenu: string;
  created_at?: string;
  lu?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  sender_id: string;
  type: string; // 'like' | 'match' | 'message' | 'payment_success'
  content: string;
  lu: boolean;
  created_at: string;
  sender_profile?: Profile;
}

export interface Post {
  id: string;
  author_id: string;
  contenu: string;
  medias?: string[];
  media_types?: string[];
  media_dimensions?: Array<{ width: number; height: number; ratio: number }>;
  created_at: string;
  author_profile?: Profile;
  // Paid "annonce" fields: when listing_price is set, the post is a service
  // listing — buyer pays via MoneyFusion then is redirected to whatsapp_link.
  listing_price?: number | null;
  whatsapp_link?: string | null;
  // true = annonce avec contact WhatsApp gratuit (pas de paiement, pas de
  // ligne listing_purchases créée — donc pas d'avis possible sur ce contact).
  is_free_listing?: boolean;
  // Type d'annonce choisi par l'utilisateur depuis l'éditeur (PublishListing).
  listing_category?: ListingCategory | null;
  listing_location?: string | null;
  listing_condition?: "neuf" | "occasion" | null;
  listing_negotiable?: boolean;
  listing_expires_at?: string | null;
  listing_quantity?: number | null;
}

export type ListingCategory = "cadeaux" | "coaching" | "contenu_exclusif" | "evenements" | "offre_service" | "autre";

export const LISTING_CATEGORIES: { value: ListingCategory; label: string; emoji: string }[] = [
  { value: "cadeaux", label: "Cadeaux", emoji: "🎁" },
  { value: "coaching", label: "Coaching", emoji: "🧠" },
  { value: "contenu_exclusif", label: "Contenu exclusif", emoji: "🔒" },
  { value: "evenements", label: "Événements", emoji: "🎉" },
  { value: "offre_service", label: "Offre de service", emoji: "🛠️" },
  { value: "autre", label: "Autre", emoji: "✨" },
];

export interface PostReview {
  id: string;
  post_id: string;
  reviewer_id: string;
  seller_id: string;
  rating: number; // 1-5
  comment?: string | null;
  created_at: string;
  is_hidden?: boolean;
  hidden_by?: string | null;
  hidden_at?: string | null;
  hidden_reason?: string | null;
  // Joined client-side for display
  reviewer_profile?: Profile;
}

export interface ListingPurchase {
  id: string;
  post_id: string;
  buyer_id: string;
  seller_id: string;
  payment_id?: string | null;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  montant: number;
  statut: 'pending' | 'success' | 'failed';
  plan_id: string;
  plan_name: string;
  reference: string;
  created_at: string;
}

export interface Subscription {
  user_id: string;
  type: 'premium' | 'none';
  status: 'active' | 'expired' | 'none';
  start_date?: string;
  end_date?: string;
}

export interface VerificationRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  documents: string[]; // Storage paths (private bucket) of ID and Selfie
  payment_status?: 'unpaid' | 'paid';
  payment_id?: string;
  reviewer_id?: string;
  reviewer_note?: string;
  rejection_reason?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  motif: string;
  created_at: string;
}

export interface UserCredits {
  user_id: string;
  balance: number;
}
