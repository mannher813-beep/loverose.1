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
  created_at?: string;
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
  created_at: string;
  author_profile?: Profile;
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
  documents: string[]; // URLs of ID and Selfie
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
