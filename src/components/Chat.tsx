import { useState, useEffect, useRef, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { Match, Message, Profile, UserCredits } from "../types";
import { Send, ArrowLeft, MessageSquare, ShieldAlert, Sparkles, AlertCircle, ShoppingBag, Loader2, Coins, HelpCircle } from "lucide-react";
import ProfileDetailModal from "./ProfileDetailModal";
import { playMessageSentSound, playMessageReceivedSound } from "../lib/sounds";
import { triggerPushNotification } from "../lib/notifications";

interface ChatProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  isPremium?: boolean;
  onOpenShop: () => void;
  targetChatPartnerId?: string | null;
  onClearTargetChatPartner?: () => void;
}

export default function Chat({ 
  currentUser, 
  currentUserProfile, 
  isPremium = false, 
  onOpenShop,
  targetChatPartnerId = null,
  onClearTargetChatPartner
}: ChatProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [credits, setCredits] = useState<number>(0);
  const [isLoadingMatches, setIsLoadingMatches] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedViewProfile, setSelectedViewProfile] = useState<Profile | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-focus selected conversation partner
  useEffect(() => {
    if (targetChatPartnerId && matches.length > 0) {
      const matchingMatch = matches.find(m => m.other_profile?.uid === targetChatPartnerId);
      if (matchingMatch) {
        setSelectedMatch(matchingMatch);
        if (onClearTargetChatPartner) {
          onClearTargetChatPartner();
        }
      }
    }
  }, [targetChatPartnerId, matches, onClearTargetChatPartner]);

  useEffect(() => {
    if (!currentUser) return;
    loadMatches();
    loadCredits();

    // Subscribe to credit balance updates in real-time
    const creditsChannel = supabase
      .channel(`user-credits-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${currentUser.id}`
        },
        (payload) => {
          if (payload.new) {
            setCredits((payload.new as any).balance);
          }
        }
      )
      .subscribe();

    // Subscribe to matches updates in real-time (to refresh conversation list)
    const matchesChannel = supabase
      .channel(`user-matches-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches"
        },
        () => {
          loadMatches();
        }
      )
      .subscribe();

    // Subscribe to profiles changes in real-time (to refresh presence status)
    const profilesChannel = supabase
      .channel(`chat-profiles-realtime`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles"
        },
        (payload) => {
          const updatedProfile = payload.new as Profile;
          
          // Update selectedMatch if they are the one updated
          setSelectedMatch(prev => {
            if (prev && prev.other_profile && prev.other_profile.uid === updatedProfile.uid) {
              return {
                ...prev,
                other_profile: { ...prev.other_profile, ...updatedProfile }
              };
            }
            return prev;
          });

          // Update matches list profile
          setMatches(prev => prev.map(m => {
            if (m.other_profile && m.other_profile.uid === updatedProfile.uid) {
              return {
                ...m,
                other_profile: { ...m.other_profile, ...updatedProfile }
              };
            }
            return m;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(creditsChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [currentUser]);

  // Handle scrolling to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription setup
  useEffect(() => {
    if (!selectedMatch) return;

    // Load initial messages
    loadMessages(selectedMatch.id);

    // Subscribe to new messages for this specific match
    const channel = supabase
      .channel(`match_${selectedMatch.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${selectedMatch.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only append if it's not already in our state to avoid duplicates
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== currentUser.id) {
            playMessageReceivedSound();
            const senderName = selectedMatch.partner_profile?.full_name || "Nouveau message";
            const senderAvatar = selectedMatch.partner_profile?.avatar_url;
            triggerPushNotification(`Nouveau message de ${senderName} 🌹`, newMsg.contenu, senderAvatar);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMatch]);

  const loadCredits = async () => {
    try {
      const { data, error } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", currentUser.id)
        .single();
      
      if (!error && data) {
        setCredits(data.balance);
      } else if (error && error.code === "PGRST116") {
        // Not found, upsert with 0 balance
        await supabase.from("user_credits").upsert([{ user_id: currentUser.id, balance: 0 }]);
        setCredits(0);
      }
    } catch (err) {
      console.error("Failed to load credits:", err);
    }
  };

  const loadMatches = async () => {
    setIsLoadingMatches(true);
    try {
      // 1. Fetch blocked users involving current user
      const { data: blockedData } = await supabase
        .from("blocked_users")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${currentUser.id},blocked_id.eq.${currentUser.id}`);

      const blockedSet = new Set<string>();
      if (blockedData) {
        blockedData.forEach(b => {
          blockedSet.add(b.blocker_id);
          blockedSet.add(b.blocked_id);
        });
      }

      // Query matches involving the current user
      const { data: matchesData, error } = await supabase
        .from("matches")
        .select("*")
        .contains("users", [currentUser.id]);

      if (error) throw error;

      // Map match records to populate candidates profile
      const populatedMatches = await Promise.all(
        (matchesData || []).map(async (m) => {
          const otherUserId = m.users.find((id: string) => id !== currentUser.id);
          
          // Get candidate profile
          const { data: otherProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("uid", otherUserId)
            .single();

          // Get latest message for summary
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("*")
            .eq("match_id", m.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...m,
            other_profile: otherProfile || { uid: otherUserId, full_name: "Membre LoveRose" },
            last_message: lastMsg && lastMsg[0] ? lastMsg[0].contenu : "Nouvelle affinité ! Dites bonjour 👋",
            last_message_time: lastMsg && lastMsg[0] ? new Date(lastMsg[0].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""
          } as Match;
        })
      );

      // Filter out any matches involving a blocked user
      const filteredMatches = populatedMatches.filter(m => {
        const otherUserId = m.users.find((id: string) => id !== currentUser.id);
        return !blockedSet.has(otherUserId);
      });

      setMatches(filteredMatches);
    } catch (err) {
      console.error("Failed to fetch matches:", err);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const loadMessages = async (matchId: string) => {
    setIsLoadingChat(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleBlockUser = async (targetUid: string) => {
    if (!currentUser || !targetUid) return;
    const confirmBlock = window.confirm("Êtes-vous sûr de vouloir bloquer ce membre ? Vous ne verrez plus son profil et vos conversations seront masquées définitivement.");
    if (!confirmBlock) return;

    try {
      const { error } = await supabase
        .from("blocked_users")
        .insert([
          {
            blocker_id: currentUser.id,
            blocked_id: targetUid
          }
        ]);

      if (error) throw error;

      alert("Membre bloqué avec succès.");
      setSelectedMatch(null);
      loadMatches();
    } catch (err: any) {
      console.error("Error blocking user:", err);
      alert("Impossible de bloquer ce membre : " + err.message);
    }
  };

  // Count how many messages the current user has sent in this match
  const getSentMessagesCount = (): number => {
    return messages.filter(m => m.sender_id === currentUser.id).length;
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!inputText.trim() || !selectedMatch) return;

    const messagesSentCount = getSentMessagesCount();
    const isFreeMessage = messagesSentCount < 3;

    // 1. Client-Side Validation for Free Messages
    if (isFreeMessage) {
      // Split by whitespaces to check word count
      const words = inputText.trim().split(/\s+/);
      
      if (words.length > 10) {
        setErrorMessage("Les messages gratuits sont limités à 10 mots maximum.");
        return;
      }

      // Check for any digit [0-9]
      if (/[0-9]/.test(inputText)) {
        setErrorMessage("Les messages gratuits ne doivent pas contenir de chiffres.");
        return;
      }
    } else {
      // It's a paid message. Check credits before sending.
      if (credits < 1) {
        setShowPurchaseModal(true);
        return;
      }
    }

    try {
      // Send message to Supabase
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            match_id: selectedMatch.id,
            sender_id: currentUser.id,
            contenu: inputText.trim()
          }
        ])
        .select();

      if (error) {
        // Catch database trigger block errors (credits or validation)
        throw error;
      }

      // Optimistically append the sent message instantly for zero lag
      if (data && data[0]) {
        const sentMsg = data[0] as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === sentMsg.id)) return prev;
          return [...prev, sentMsg];
        });
        playMessageSentSound();
      }

      setInputText("");
      
      // Instantly load credits to update balance
      await loadCredits();
    } catch (err: any) {
      console.error("Failed to insert message:", err);
      if (err.message && err.message.includes("Crédits insuffisants")) {
        setShowPurchaseModal(true);
      } else {
        setErrorMessage(err.message || "Impossible d'envoyer le message. Veuillez vérifier vos crédits.");
      }
    }
  };

  const messagesSent = getSentMessagesCount();
  const freeMessagesLeft = Math.max(0, 3 - messagesSent);

  return (
    <div className="flex-1 flex h-full bg-slate-50 relative overflow-hidden font-sans">
      
      {/* Left Column: Match listings */}
      <div className={`w-full md:w-80 border-r border-slate-150 flex flex-col bg-white h-full ${selectedMatch ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="font-extrabold text-slate-800 text-lg">Vos Matchs</h2>
          <div className="flex items-center space-x-1 bg-amber-50 text-amber-700 text-xs px-2.5 py-1 rounded-full border border-amber-200">
            <Coins size={12} className="fill-amber-500 text-amber-600" />
            <span className="font-bold">{credits} crédits</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoadingMatches ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Loader2 className="animate-spin mx-auto mb-2 text-rose-500" size={20} />
              <span>Chargement des conversations...</span>
            </div>
          ) : matches.length > 0 ? (
            matches.map(m => {
              const other = m.other_profile;
              const isSelected = selectedMatch?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMatch(m)}
                  className={`w-full p-4 flex items-center space-x-3 text-left transition cursor-pointer hover:bg-slate-50 ${isSelected ? 'bg-rose-50/50 hover:bg-rose-50' : ''}`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={other?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${other?.full_name || other?.uid}`}
                      alt={other?.full_name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover bg-slate-100 border border-slate-100"
                    />
                    {other?.is_online && (
                      <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-bold text-slate-800 truncate text-sm">{other?.full_name || "Membre LoveRose"}</span>
                      <span className="text-[10px] text-slate-400">{m.last_message_time}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{m.last_message}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs space-y-2 mt-4">
              <MessageSquare className="mx-auto text-slate-300" size={36} />
              <p className="font-medium text-slate-500">Pas de conversation en cours</p>
              <p className="text-slate-400 px-4">Liké des profils compatibles pour commencer à chatter !</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Active Chat */}
      <div className={`flex-1 flex flex-col bg-slate-50 h-full ${!selectedMatch ? 'hidden md:flex justify-center items-center p-8' : 'flex'}`}>
        {selectedMatch ? (
          <>
            {/* Active chat header */}
            <div className="bg-white border-b border-slate-150 px-4 py-3 flex items-center justify-between sticky top-0 z-10 flex-shrink-0">
              <div 
                onClick={() => setSelectedViewProfile(selectedMatch.other_profile)}
                className="flex items-center space-x-3 cursor-pointer hover:opacity-85 transition"
                title="Visiter le profil public"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedMatch(null); }}
                  className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 md:hidden transition cursor-pointer"
                >
                  <ArrowLeft size={20} />
                </button>
                <img
                  src={selectedMatch.other_profile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${selectedMatch.other_profile?.full_name}`}
                  alt={selectedMatch.other_profile?.full_name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover bg-slate-100 border border-slate-100"
                />
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight flex items-center gap-1">
                    <span>{selectedMatch.other_profile?.full_name}</span>
                    {selectedMatch.other_profile?.verification_status === "verified" && (
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block border border-white" title="Profil vérifié"></span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    {selectedMatch.other_profile?.is_online ? (
                      <>
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] text-emerald-600 font-bold">En ligne</span>
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
                        <span className="text-[10px] text-slate-450 font-medium">
                          {selectedMatch.other_profile?.last_seen ? (
                            (() => {
                              const lastSeenDate = new Date(selectedMatch.other_profile.last_seen);
                              const now = new Date();
                              const diffMs = now.getTime() - lastSeenDate.getTime();
                              const diffMins = Math.floor(diffMs / 60000);
                              const diffHours = Math.floor(diffMins / 60);
                              const diffDays = Math.floor(diffHours / 24);

                              if (diffMins < 1) return "Hors-ligne (à l'instant)";
                              if (diffMins < 60) return `Vu(e) il y a ${diffMins} min`;
                              if (diffHours < 24) return `Vu(e) il y a ${diffHours} h`;
                              return `Vu(e) il y a ${diffDays} j`;
                            })()
                          ) : "Hors-ligne"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & dynamic counters */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleBlockUser(selectedMatch.other_profile?.uid)}
                  className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition cursor-pointer"
                  title="Bloquer cet utilisateur"
                >
                  <ShieldAlert size={18} />
                </button>
                <div className="text-right flex flex-col items-end gap-1">
                  {freeMessagesLeft > 0 ? (
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1 shadow-sm">
                      <Sparkles size={11} className="fill-emerald-400 text-emerald-500" />
                      <span>{freeMessagesLeft} messages gratuits restants</span>
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-amber-150 flex items-center gap-1">
                      <Coins size={11} className="fill-amber-500 text-amber-600" />
                      <span>{credits} crédits disponibles</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Free Message Explanation Notice */}
            {freeMessagesLeft > 0 && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3 px-4 text-xs font-semibold flex items-center justify-between shadow-md">
                <p className="flex items-center gap-1.5">
                  <Sparkles size={14} className="fill-white" />
                  <span>Messagerie gratuite active (10 mots max, pas de chiffres)</span>
                </p>
                <div className="flex items-center gap-1 text-[10px] bg-white/20 px-2 py-0.5 rounded-full">
                  <span>One-shot</span>
                </div>
              </div>
            )}

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {isLoadingChat ? (
                <div className="text-center p-8 text-slate-400 text-xs">
                  <Loader2 className="animate-spin mx-auto mb-2 text-rose-500" size={16} />
                  <span>Chargement de l'historique...</span>
                </div>
              ) : messages.length > 0 ? (
                messages.map((m, index) => {
                  const isMine = m.sender_id === currentUser.id;
                  return (
                    <div
                      key={m.id || index}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl p-3 px-4 text-xs font-medium leading-relaxed shadow-xs ${
                          isMine
                            ? 'bg-rose-500 text-white rounded-br-none'
                            : 'bg-white border border-slate-150 text-slate-800 rounded-bl-none'
                        }`}
                      >
                        <p>{m.contenu}</p>
                        <p className={`text-[9px] mt-1 text-right ${isMine ? 'text-rose-100' : 'text-slate-400'}`}>
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Envoi..."}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center p-8 text-slate-400 text-xs space-y-2 mt-8">
                  <MessageSquare className="mx-auto text-rose-300" size={32} />
                  <p className="font-bold text-slate-600">Aucun message pour l'instant</p>
                  <p className="text-slate-400">Écrivez un premier mot poli pour briser la glace !</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Send form */}
            <div className="bg-white border-t border-slate-150 p-3 sticky bottom-0 z-10 flex-shrink-0">
              {errorMessage && (
                <div className="bg-red-50 text-red-600 text-xs p-2 px-3 rounded-lg flex items-center gap-1.5 mb-2 border border-red-100">
                  <AlertCircle size={14} />
                  <p className="font-bold flex-1">{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    freeMessagesLeft > 0
                      ? "Message gratuit (max 10 mots, sans chiffres)..."
                      : "Message payant (1 crédit)..."
                  }
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-xl p-3 px-4 text-xs font-medium transition"
                />
                <button
                  id="chat-send-btn"
                  type="submit"
                  className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl p-3.5 transition flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/10"
                >
                  <Send size={16} />
                </button>
              </form>

              {/* Mini Helper details */}
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-400 font-medium px-1">
                {freeMessagesLeft > 0 ? (
                  <span>Contraintes : Lettres uniquement. Mots : {inputText.trim() ? inputText.trim().split(/\s+/).length : 0}/10</span>
                ) : (
                  <span>Coût : 1 crédit. Solde : {credits} crédits</span>
                )}
                <span className="flex items-center gap-0.5 hover:underline cursor-pointer" onClick={() => alert("Chaque message envoyé après vos 3 messages gratuits consomme 1 crédit de votre solde.")}>
                  <HelpCircle size={10} /> Aide sur les crédits
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center p-8 max-w-sm space-y-3">
            <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
              <MessageSquare size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800">Votre boîte de messagerie</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Sélectionnez une conversation dans la colonne de gauche pour commencer à échanger des messages et faire plus ample connaissance.
            </p>
          </div>
        )}

        {/* Purchase Credits Modal trigger inside chat */}
        {showPurchaseModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-100 shadow-2xl text-center space-y-5">
              <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
                <Coins size={28} className="fill-amber-400 text-amber-500" />
              </div>
              <div className="space-y-1.5">
                <h4 className="font-extrabold text-slate-900 text-base">Solde de Crédits Épuisé !</h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Vous avez consommé vos messages gratuits et votre solde est de 0 crédit. Veuillez recharger votre compte pour continuer à discuter avec vos matchs.
                </p>
              </div>
              <div className="flex gap-2 text-xs font-bold pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                >
                  Plus tard
                </button>
                <button
                  type="button"
                  onClick={() => { setShowPurchaseModal(false); onOpenShop(); }}
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag size={14} />
                  <span>Acheter des crédits</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render profile detail view modal */}
        {selectedViewProfile && (
          <ProfileDetailModal
            profile={selectedViewProfile}
            currentUserProfile={currentUserProfile}
            isPremium={isPremium}
            onClose={() => setSelectedViewProfile(null)}
          />
        )}
      </div>
    </div>
  );
}
