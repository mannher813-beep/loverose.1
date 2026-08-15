import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { compressImageIfNeeded } from "../lib/imageCompression";
import { Profile } from "../types";
import { Image, Send, AlertCircle, Loader2, X, DollarSign } from "lucide-react";
import CountryDialSelect from "./CountryDialSelect";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { detectUserCountry } from "../lib/countries";

interface PublishListingProps {
  currentUser: any;
  currentUserProfile: Profile | null;
  onAuthRequired?: () => void;
  // Appelé une fois la publication enregistrée en base, pour permettre à
  // l'écran parent de renvoyer l'utilisateur vers le fil d'actualité.
  onPublished?: () => void;
}

const MAX_LISTING_PHOTOS = 6;

export default function PublishListing({ currentUser, currentUserProfile, onAuthRequired, onPublished }: PublishListingProps) {
  const [inputText, setInputText] = useState("");
  // Plusieurs photos par annonce. Chaque entrée est l'URL publique Supabase
  // Storage finale (upload dès la sélection du fichier), jamais un blob base64.
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaDimensions, setMediaDimensions] = useState<Array<{ width: number; height: number; ratio: number }>>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Champs de l'annonce payante
  const [isListing, setIsListing] = useState(false);
  const [isFreeListing, setIsFreeListing] = useState(false);
  const [listingPriceInput, setListingPriceInput] = useState("");
  // Le lien WhatsApp de l'annonce est généré automatiquement à partir de
  // l'indicatif pays + numéro local choisis ici (plus de saisie manuelle
  // d'URL wa.me, source d'erreurs de format).
  const [whatsappCountryIso, setWhatsappCountryIso] = useState<CountryCode | null>(null);
  const [whatsappPhoneLocal, setWhatsappPhoneLocal] = useState("");

  // Pré-remplit l'indicatif pays du champ WhatsApp dès l'activation du mode
  // "annonce payante" : d'abord depuis le profil (numéro déjà vérifié), sinon
  // via la géolocalisation du navigateur.
  useEffect(() => {
    if (!isListing || whatsappCountryIso) return;
    const profileIso = currentUserProfile?.phone_country_code as CountryCode | undefined;
    if (profileIso) {
      setWhatsappCountryIso(profileIso);
      return;
    }
    detectUserCountry("CM").then((iso) => setWhatsappCountryIso(iso));
  }, [isListing, whatsappCountryIso, currentUserProfile?.phone_country_code]);

  const getImageDimensions = (file: File): Promise<{ width: number; height: number; ratio: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight, ratio: img.naturalWidth / img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0 || !currentUser) return;

    const remainingSlots = MAX_LISTING_PHOTOS - mediaUrls.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`Vous pouvez ajouter jusqu'à ${MAX_LISTING_PHOTOS} photos par publication.`);
      return;
    }

    setErrorMessage("");
    setIsUploadingMedia(true);
    try {
      const filesToUpload = files.slice(0, remainingSlots);
      for (const file of filesToUpload) {
        // Compression locale d'abord, puis upload direct vers Supabase Storage —
        // stocker des blobs base64 directement dans la ligne posts ne passe
        // pas à l'échelle pour plusieurs photos par annonce.
        const optimizedFile = await compressImageIfNeeded(file);
        const dims = await getImageDimensions(optimizedFile);

        const filePath = `posts/${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("loverose")
          .upload(filePath, optimizedFile, { contentType: "image/jpeg", upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from("loverose").getPublicUrl(filePath);

        setMediaUrls((prev) => [...prev, publicUrl]);
        setMediaDimensions((prev) => [...prev, dims]);
      }
    } catch (err: any) {
      console.error("Failed to upload photo(s) for listing:", err);
      setErrorMessage(err.message || "Erreur lors de l'envoi d'une photo.");
    } finally {
      setIsUploadingMedia(false);
      e.target.value = "";
    }
  };

  const removeMediaAt = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
    setMediaDimensions((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerImageUpload = () => {
    setErrorMessage("");
    document.getElementById("publish-listing-image-upload")?.click();
  };

  const handleCreatePost = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!currentUser) {
      onAuthRequired?.();
      return;
    }
    if (!inputText.trim()) return;

    // Validation des champs d'annonce payante avant l'écriture en base
    let listingPrice: number | null = null;
    let whatsappLink: string | null = null;
    if (isListing) {
      if (!whatsappCountryIso || !whatsappPhoneLocal.trim()) {
        setErrorMessage("Indiquez votre numéro WhatsApp (indicatif + numéro) pour que l'acheteur puisse vous contacter.");
        return;
      }
      const parsedWhatsapp = parsePhoneNumberFromString(whatsappPhoneLocal.trim(), whatsappCountryIso);
      if (!parsedWhatsapp?.isValid()) {
        setErrorMessage("Le numéro WhatsApp saisi est invalide. Vérifiez l'indicatif et le format.");
        return;
      }
      whatsappLink = `https://wa.me/${parsedWhatsapp.number.replace("+", "")}`;

      if (!isFreeListing) {
        const priceNum = Number(listingPriceInput);
        if (!listingPriceInput || !Number.isFinite(priceNum) || priceNum <= 0) {
          setErrorMessage("Indiquez un prix valide (FCFA) pour votre annonce, ou activez le contact WhatsApp gratuit.");
          return;
        }
        listingPrice = priceNum;
      }
    }

    setIsPosting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .insert([
          {
            author_id: currentUser.id,
            contenu: inputText.trim(),
            medias: mediaUrls,
            media_types: mediaUrls.map(() => "image"),
            media_dimensions: mediaDimensions,
            listing_price: listingPrice,
            whatsapp_link: whatsappLink,
            is_free_listing: isListing && isFreeListing,
          }
        ])
        .select();

      if (error) throw error;

      setInputText("");
      setMediaUrls([]);
      setMediaDimensions([]);
      setIsListing(false);
      setIsFreeListing(false);
      setListingPriceInput("");
      setWhatsappPhoneLocal("");

      onPublished?.();
    } catch (err: any) {
      console.error("Post creation error:", err);
      setErrorMessage(err.message || "Erreur lors de la publication du post.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 font-sans">
      {currentUser ? (
        <div className="max-w-xl mx-auto bg-white border border-slate-150 rounded-3xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-black text-slate-900">Nouvelle publication</h2>
          <div className="flex items-start space-x-3">
            <img
              src={currentUserProfile?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUserProfile?.full_name || currentUser.id}`}
              alt="Moi"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover bg-slate-100 border border-slate-100"
            />
            <form onSubmit={handleCreatePost} className="flex-1 space-y-3">
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Décrivez votre publication ou votre annonce... ✨"
                className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white focus:outline-none rounded-2xl p-3.5 text-xs font-medium transition resize-none leading-relaxed"
              />
              {/* Sélecteur de fichier caché pour les photos, plusieurs autorisées */}
              <input
                type="file"
                id="publish-listing-image-upload"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Grille d'aperçu des photos ajoutées */}
              {mediaUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {mediaUrls.map((url, i) => (
                    <div key={url} className="relative rounded-xl overflow-hidden aspect-square bg-slate-100 border border-slate-200">
                      <img src={url} alt={`Aperçu ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeMediaAt(i)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition cursor-pointer"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Interrupteur : transformer cette publication en annonce payante avec contact WhatsApp */}
              <div className="pt-1 border-t border-slate-100">
                <label className="flex items-center justify-between gap-2 py-2 cursor-pointer select-none">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <DollarSign size={14} className="text-emerald-500" />
                    Faire de cette publication une annonce payante
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsListing((v) => !v)}
                    className={`w-11 h-6 rounded-full transition relative cursor-pointer flex-shrink-0 ${isListing ? "bg-emerald-500" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition ${isListing ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </label>

                {isListing && (
                  <div className="space-y-2.5 bg-emerald-50/40 border border-emerald-100 rounded-xl p-3">
                    <label className="flex items-center justify-between gap-2 py-1 cursor-pointer select-none">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Contact WhatsApp gratuit</span>
                      <button
                        type="button"
                        onClick={() => setIsFreeListing((v) => !v)}
                        className={`w-10 h-5.5 rounded-full transition relative cursor-pointer flex-shrink-0 ${isFreeListing ? "bg-emerald-500" : "bg-slate-200"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full transition ${isFreeListing ? "translate-x-4.5" : "translate-x-0"}`} />
                      </button>
                    </label>

                    {!isFreeListing && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Prix (FCFA)</label>
                        <input
                          type="number"
                          min={1}
                          value={listingPriceInput}
                          onChange={(e) => setListingPriceInput(e.target.value)}
                          placeholder="5000"
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-400"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Votre numéro WhatsApp</label>
                      <div className="flex gap-2 mt-1">
                        <div className="w-2/5">
                          <CountryDialSelect value={whatsappCountryIso} onChange={setWhatsappCountryIso} locale="fr" />
                        </div>
                        <div className="w-3/5">
                          <input
                            type="tel"
                            value={whatsappPhoneLocal}
                            onChange={(e) => setWhatsappPhoneLocal(e.target.value)}
                            placeholder="Votre numéro"
                            className="w-full h-[42px] bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                      {(() => {
                        if (!whatsappCountryIso || !whatsappPhoneLocal.trim()) return null;
                        const parsed = parsePhoneNumberFromString(whatsappPhoneLocal.trim(), whatsappCountryIso);
                        if (parsed?.isValid()) {
                          return (
                            <p className="text-[10px] font-bold text-emerald-600 mt-1.5">
                              ✓ Lien généré : wa.me/{parsed.number.replace("+", "")}
                            </p>
                          );
                        }
                        return (
                          <p className="text-[10px] font-bold text-slate-400 mt-1.5">
                            Numéro incomplet ou invalide
                          </p>
                        );
                      })()}
                      <p className="text-[10px] text-slate-400 mt-1">
                        {isFreeListing
                          ? "Le bouton WhatsApp sera visible immédiatement, sans paiement. Comme aucun achat n'est enregistré, ces contacts ne donnent pas lieu à un avis noté."
                          : "L'acheteur sera redirigé ici automatiquement dès que son paiement est confirmé."}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="bg-red-50 text-red-600 text-xs p-2 px-3 rounded-lg flex items-center gap-1">
                  <AlertCircle size={14} />
                  <p className="font-bold flex-1">{errorMessage}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={triggerImageUpload}
                  disabled={isUploadingMedia || mediaUrls.length >= MAX_LISTING_PHOTOS}
                  className="flex items-center gap-1.5 text-xs font-bold transition cursor-pointer px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-slate-50 disabled:opacity-50"
                >
                  {isUploadingMedia ? <Loader2 size={15} className="animate-spin" /> : <Image size={15} />}
                  <span>{isUploadingMedia ? "Envoi..." : `Ajouter des Photos (${mediaUrls.length}/${MAX_LISTING_PHOTOS})`}</span>
                </button>
                <button
                  id="create-post-btn"
                  type="submit"
                  disabled={isPosting || isUploadingMedia || !inputText.trim()}
                  className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-4 py-2 text-xs font-extrabold shadow-md shadow-rose-500/10 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isPosting ? (
                    <Loader2 className="animate-spin" size={12} />
                  ) : (
                    <>
                      <Send size={12} />
                      <span>Publier</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="max-w-xl mx-auto bg-white border border-slate-150 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            👀 Vous parcourez LoveRose sans compte. Inscrivez-vous gratuitement pour publier votre propre annonce.
          </p>
          <button
            onClick={() => onAuthRequired?.()}
            className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer flex-shrink-0"
          >
            S'inscrire
          </button>
        </div>
      )}
    </div>
  );
}
