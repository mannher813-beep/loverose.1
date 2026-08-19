import { useState, useEffect, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { compressImageIfNeeded } from "../lib/imageCompression";
import { Profile, ListingCategory, LISTING_CATEGORIES, LISTING_FIELD_CONFIG } from "../types";
import { Image, Send, AlertCircle, Loader2, X, DollarSign, MapPin, Tag, Clock, Boxes } from "lucide-react";
import CountryDialSelect from "./CountryDialSelect";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { detectUserCountry } from "../lib/countries";

// Durées de publication proposées pour une annonce. `null` = pas d'expiration.
const LISTING_DURATIONS: { value: number | null; label: string }[] = [
  { value: 3, label: "3 jours" },
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: null, label: "Sans limite" },
];

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

  // Nouvelles fonctionnalités de l'éditeur d'annonce : type d'annonce (choisi
  // par l'utilisateur), localisation, état, prix négociable, durée de
  // publication et quantité disponible.
  const [listingCategory, setListingCategory] = useState<ListingCategory | null>(null);
  const [listingLocation, setListingLocation] = useState("");
  const [listingCondition, setListingCondition] = useState<"neuf" | "occasion" | null>(null);
  const [listingNegotiable, setListingNegotiable] = useState(false);
  const [listingDurationDays, setListingDurationDays] = useState<number | null>(7);
  const [listingQuantityInput, setListingQuantityInput] = useState("");

  // Les options proposées plus bas (localisation, état, quantité...)
  // dépendent de la catégorie choisie en premier. Quand l'utilisateur change
  // de catégorie, on réinitialise les champs devenus non pertinents pour
  // éviter d'enregistrer une valeur orpheline (ex: "neuf" gardé alors que
  // la nouvelle catégorie ne propose plus ce champ).
  const activeFieldConfig = listingCategory ? LISTING_FIELD_CONFIG[listingCategory] : null;

  const handleSelectCategory = (cat: ListingCategory) => {
    setListingCategory(cat);
    const config = LISTING_FIELD_CONFIG[cat];
    if (!config.location) setListingLocation("");
    if (!config.condition) setListingCondition(null);
    if (!config.quantity) setListingQuantityInput("");
  };

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
    let listingQuantity: number | null = null;
    if (isListing) {
      if (!listingCategory) {
        setErrorMessage("Choisissez le type d'annonce.");
        return;
      }
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

      if (listingQuantityInput.trim()) {
        const qtyNum = Number(listingQuantityInput);
        if (!Number.isFinite(qtyNum) || qtyNum < 0) {
          setErrorMessage(`${LISTING_FIELD_CONFIG[listingCategory].quantityLabel} doit être un nombre positif.`);
          return;
        }
        listingQuantity = qtyNum;
      }
    }

    const listingExpiresAt =
      isListing && listingDurationDays
        ? new Date(Date.now() + listingDurationDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

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
            listing_category: isListing ? listingCategory : null,
            listing_location: isListing && listingLocation.trim() ? listingLocation.trim() : null,
            listing_condition: isListing ? listingCondition : null,
            listing_negotiable: isListing ? listingNegotiable : false,
            listing_expires_at: listingExpiresAt,
            listing_quantity: listingQuantity,
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
      setListingCategory(null);
      setListingLocation("");
      setListingCondition(null);
      setListingNegotiable(false);
      setListingDurationDays(7);
      setListingQuantityInput("");

      onPublished?.();
    } catch (err: any) {
      console.error("Post creation error:", err);
      setErrorMessage(err.message || "Erreur lors de la publication du post.");
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      {/* En-tête éditorial de l'écran */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-5">
          <span className="u-kicker text-rose-600">Nouvelle publication</span>
          <h1 className="u-display text-3xl sm:text-4xl text-slate-950 mt-1.5">
            Publier une annonce
          </h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg leading-relaxed">
            Décrivez votre offre, ajoutez des photos et choisissez si le contact
            est gratuit ou payant.
          </p>
        </div>
      </div>

      <div className="p-4">
      {currentUser ? (
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-5 space-y-4">
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
                placeholder="Que proposez-vous ? Décrivez votre annonce…"
                className="w-full bg-white border border-slate-300 focus:border-slate-900 focus:outline-none rounded-lg p-3.5 text-[15px] font-medium transition-colors resize-none leading-relaxed placeholder:text-slate-400 placeholder:font-normal"
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
                    {/* Type d'annonce : choisi par l'utilisateur, affiché ensuite comme
                        badge de catégorie dans le fil (Feed.tsx). Les options ci-dessous
                        s'adaptent ensuite à ce choix (voir LISTING_FIELD_CONFIG). */}
                    <div>
                      <label className="text-[12px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Tag size={11} /> Type d'annonce
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {LISTING_CATEGORIES.map((cat) => (
                          <button
                            key={cat.value}
                            type="button"
                            onClick={() => handleSelectCategory(cat.value)}
                            className={`py-2 px-2 rounded-lg text-[12px] font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                              listingCategory === cat.value
                                ? "bg-slate-900 border-slate-900 text-white"
                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-900"
                            }`}
                          >
                            <span className="text-sm leading-none">{cat.emoji}</span>
                            <span className="leading-tight text-left">{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {!listingCategory && (
                      <p className="text-[12px] text-slate-400 italic">
                        Choisissez d'abord un type d'annonce pour voir les options adaptées.
                      </p>
                    )}

                    {activeFieldConfig && (activeFieldConfig.location || activeFieldConfig.condition) && (
                      <div className={`grid gap-2 ${activeFieldConfig.location && activeFieldConfig.condition ? "grid-cols-2" : "grid-cols-1"}`}>
                        {activeFieldConfig.location && (
                          <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              <MapPin size={11} /> {activeFieldConfig.locationLabel}
                            </label>
                            <input
                              type="text"
                              value={listingLocation}
                              onChange={(e) => setListingLocation(e.target.value)}
                              placeholder="Douala, Yaoundé..."
                              className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3.5 py-3 text-sm font-medium outline-none focus:border-slate-900"
                            />
                          </div>
                        )}
                        {activeFieldConfig.condition && (
                          <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase flex items-center gap-1">
                              <Boxes size={11} /> État
                            </label>
                            <div className="flex gap-1.5 mt-1">
                              {(["neuf", "occasion"] as const).map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setListingCondition((prev) => (prev === c ? null : c))}
                                  className={`flex-1 py-2.5 rounded-xl text-[12px] font-bold capitalize transition cursor-pointer border ${
                                    listingCondition === c
                                      ? "bg-slate-900 border-slate-900 text-white"
                                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-900"
                                  }`}
                                >
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {listingCategory && (
                      <div className={`grid gap-2 ${activeFieldConfig?.quantity ? "grid-cols-2" : "grid-cols-1"}`}>
                        <div>
                          <label className="text-[12px] font-bold text-slate-500 uppercase flex items-center gap-1">
                            <Clock size={11} /> Durée
                          </label>
                          <select
                            value={listingDurationDays === null ? "none" : listingDurationDays}
                            onChange={(e) => setListingDurationDays(e.target.value === "none" ? null : Number(e.target.value))}
                            className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3.5 py-3 text-sm font-medium outline-none focus:border-slate-900"
                          >
                            {LISTING_DURATIONS.map((d) => (
                              <option key={d.label} value={d.value === null ? "none" : d.value}>
                                {d.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {activeFieldConfig?.quantity && (
                          <div>
                            <label className="text-[12px] font-bold text-slate-500 uppercase">{activeFieldConfig.quantityLabel}</label>
                            <input
                              type="number"
                              min={0}
                              value={listingQuantityInput}
                              onChange={(e) => setListingQuantityInput(e.target.value)}
                              placeholder="Illimité"
                              className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3.5 py-3 text-sm font-medium outline-none focus:border-slate-900"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <label className="flex items-center justify-between gap-2 py-1 cursor-pointer select-none">
                      <span className="text-[12px] font-bold text-slate-500 uppercase">Contact WhatsApp gratuit</span>
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
                        <div className="flex items-center justify-between">
                          <label className="text-[12px] font-bold text-slate-500 uppercase">Prix (FCFA)</label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none">
                            <span className="text-[12px] font-bold text-slate-500">Négociable</span>
                            <button
                              type="button"
                              onClick={() => setListingNegotiable((v) => !v)}
                              className={`w-9 h-5 rounded-full transition relative cursor-pointer flex-shrink-0 ${listingNegotiable ? "bg-emerald-500" : "bg-slate-200"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition ${listingNegotiable ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </label>
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={listingPriceInput}
                          onChange={(e) => setListingPriceInput(e.target.value)}
                          placeholder="5000"
                          className="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3.5 py-3 text-sm font-medium outline-none focus:border-slate-900"
                        />
                      </div>
                    )}
                    <div>
                      <label className="text-[12px] font-bold text-slate-500 uppercase">Votre numéro WhatsApp</label>
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
                            className="w-full h-[42px] bg-white border border-slate-200 rounded-lg px-3.5 py-3 text-sm font-medium outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                      {(() => {
                        if (!whatsappCountryIso || !whatsappPhoneLocal.trim()) return null;
                        const parsed = parsePhoneNumberFromString(whatsappPhoneLocal.trim(), whatsappCountryIso);
                        if (parsed?.isValid()) {
                          return (
                            <p className="text-[12px] font-bold text-emerald-600 mt-1.5">
                              ✓ Lien généré : wa.me/{parsed.number.replace("+", "")}
                            </p>
                          );
                        }
                        return (
                          <p className="text-[12px] font-bold text-slate-400 mt-1.5">
                            Numéro incomplet ou invalide
                          </p>
                        );
                      })()}
                      <p className="text-[12px] text-slate-400 mt-1">
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
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Vous parcourez LoveRose sans compte. Inscrivez-vous gratuitement pour
            publier votre propre annonce.
          </p>
          <button
            onClick={() => onAuthRequired?.()}
            className="h-11 px-5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer flex-shrink-0"
          >
            S'inscrire gratuitement
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
