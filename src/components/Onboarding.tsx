import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { compressImageIfNeeded } from "../lib/imageCompression";
import { Profile } from "../types";
import { Heart, Phone, MapPin, Smile, Compass, FileText, Camera, ArrowRight, ArrowLeft, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { detectUserCountry } from "../lib/countries";
import CountryDialSelect from "./CountryDialSelect";

interface OnboardingProps {
  currentUser: any;
  onComplete: () => void;
}

export default function Onboarding({ currentUser, onComplete }: OnboardingProps) {
  const { t, i18n } = useTranslation("onboarding");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saveProgress, setSaveProgress] = useState("");

  // Slow/unstable mobile connections can leave a storage upload hanging
  // indefinitely with no error and no progress — this wraps any promise so
  // it always settles one way or another within `ms`. Default raised to 45s:
  // 20s was cutting off real uploads on common 2G/3G connections, which then
  // fell back to embedding multi-MB base64 images directly in the profile
  // row — that huge payload was itself timing out on the final save (15s),
  // producing the exact "connexion trop lente" failure at step 7/7.
  const withTimeout = <T,>(promise: Promise<T>, ms = 45000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
    ]);

  // Form states
  // Pays + indicatif : plus de liste statique ni de table Supabase dédiée.
  // selectedCountryIso est un code ISO 3166-1 alpha-2 ("CM", "FR", "US"...)
  // résolu via libphonenumber-js (voir src/lib/countries.ts).
  const [selectedCountryIso, setSelectedCountryIso] = useState<CountryCode | null>(null);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState<number>(25);
  const [location, setLocation] = useState("");
  const [gender, setGender] = useState<"homme" | "femme" | "autre">("homme");
  const [preferences, setPreferences] = useState<"homme" | "femme" | "tous">("femme");
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<(File | null)[]>([null, null, null]);
  const [galleryPreviews, setGalleryPreviews] = useState<(string | null)[]>([null, null, null]);

  const totalSteps = 7;

  const hobbiesList = [
    "Voyages", "Cuisine & Gastronomie", "Musique & Concerts", "Cinéma & Séries",
    "Sports & Fitness", "Gaming", "Lecture & Littérature", "Art & Design",
    "Nature & Randonnée", "Photographie", "Mode & Beauté", "Animaux de compagnie"
  ];

  const intentsList = [
    "Amitié",
    "Relation amoureuse",
    "Rencontre d'un soir",
    "Relation libertine",
    "Business / networking"
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t("validation.photoTooLarge"));
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t("validation.photoTooLarge"));
        return;
      }
      setGalleryFiles(prev => {
        const next = [...prev];
        next[index] = file;
        return next;
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        setGalleryPreviews(prev => {
          const next = [...prev];
          next[index] = reader.result as string;
          return next;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleHobby = (hobby: string) => {
    setSelectedHobbies(prev =>
      prev.includes(hobby) ? prev.filter(h => h !== hobby) : [...prev, hobby]
    );
  };

  const toggleIntent = (intent: string) => {
    setSelectedIntents(prev =>
      prev.includes(intent) ? prev.filter(i => i !== intent) : [...prev, intent]
    );
  };

  React.useEffect(() => {
    // Détection automatique du pays (géo-IP puis langue du navigateur),
    // avec repli sur le Cameroun si la détection échoue. L'utilisateur
    // reste toujours libre de changer le pays sélectionné ensuite.
    let cancelled = false;
    detectUserCountry("CM").then((iso) => {
      if (!cancelled) setSelectedCountryIso(iso);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNext = () => {
    // Basic validation per step
    if (step === 1) {
      if (!selectedCountryIso) {
        alert(t("validation.selectCountry"));
        return;
      }
      if (!phoneLocal.trim()) {
        alert(t("validation.phoneRequired"));
        return;
      }
      const parsed = parsePhoneNumberFromString(phoneLocal.trim(), selectedCountryIso);
      if (!parsed || !parsed.isValid()) {
        alert(t("validation.phoneInvalid"));
        return;
      }
    }
    if (step === 2) {
      if (!fullName.trim()) {
        alert(t("validation.fullNameRequired"));
        return;
      }
      if (!username.trim()) {
        alert(t("validation.usernameRequired"));
        return;
      }
      if (!age || age < 18) {
        alert(t("validation.ageMinimum"));
        return;
      }
      if (!location.trim()) {
        alert(t("validation.locationRequired"));
        return;
      }
    }
    if (step === 3 && selectedHobbies.length === 0) {
      alert(t("validation.hobbiesRequired"));
      return;
    }
    if (step === 4 && selectedIntents.length === 0) {
      alert(t("validation.intentsRequired"));
      return;
    }
    if (step === 5 && bio.trim().length < 10) {
      alert(t("validation.bioTooShort"));
      return;
    }
    if (step === 6 && !avatarFile && !avatarPreview) {
      alert(t("validation.avatarRequired"));
      return;
    }
    // Step 7 (gallery photos) is optional — no minimum enforced anymore.

    if (step < totalSteps) {
      setStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!avatarFile && !avatarPreview) {
      alert(t("validation.avatarRequired"));
      return;
    }

    setLoading(true);
    try {
      let finalAvatarUrl = "";

      // 1. Upload avatar to Supabase Storage if a real file is chosen
      if (avatarFile) {
        setSaveProgress(t("uploadingAvatar"));
        const optimizedAvatar = await compressImageIfNeeded(avatarFile);
        const fileExt = optimizedAvatar.name.split('.').pop();
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${currentUser.id}/${fileName}`;

        try {
          const { error: uploadErr } = await withTimeout(
            supabase.storage.from("loverose").upload(filePath, optimizedAvatar, {
              cacheControl: "3600",
              upsert: true,
            })
          );

          if (uploadErr) throw uploadErr;
          const { data: { publicUrl } } = supabase.storage.from("loverose").getPublicUrl(filePath);
          finalAvatarUrl = publicUrl;
        } catch (uploadErr: any) {
          // The avatar is required, so we can't just skip it like optional
          // gallery photos. But embedding a multi-MB base64 fallback here
          // was the real culprit behind "connexion trop lente" at the final
          // step: it bloats the profile row past the save timeout below.
          // Fail clearly instead, so the user knows exactly what to retry.
          console.warn("Avatar upload failed or timed out:", uploadErr);
          throw new Error("AVATAR_UPLOAD_FAILED");
        }
      } else if (avatarPreview) {
        finalAvatarUrl = avatarPreview;
      }

      // 2. Upload gallery photos to Supabase Storage
      const galleryUrls: string[] = [];
      let galleryUploadFailures = 0;
      for (let i = 0; i < galleryFiles.length; i++) {
        const file = galleryFiles[i];
        if (file) {
          setSaveProgress(t("uploadingGalleryPhoto", { current: i + 1, total: galleryFiles.length }));
          const optimizedFile = await compressImageIfNeeded(file);
          const fileExt = optimizedFile.name.split('.').pop();
          const fileName = `photo_${i + 1}_${Date.now()}.${fileExt}`;
          const filePath = `gallery/${currentUser.id}/${fileName}`;

          try {
            const { error: uploadErr } = await withTimeout(
              supabase.storage.from("loverose").upload(filePath, optimizedFile, {
                cacheControl: "3600",
                upsert: true,
              })
            );

            if (uploadErr) throw uploadErr;
            const { data: { publicUrl } } = supabase.storage.from("loverose").getPublicUrl(filePath);
            galleryUrls.push(publicUrl);
          } catch (uploadErr: any) {
            // Gallery photos are optional: rather than stuffing a multi-MB
            // base64 fallback into the profile row (which then blows past
            // the save timeout below), we just skip this one. The user can
            // add it later from Settings once on a better connection.
            console.warn(`Gallery upload ${i + 1} failed or timed out, skipping it:`, uploadErr);
            galleryUploadFailures++;
          }
        }
      }

      setSaveProgress(t("finalizing"));

      // 3. Format centers of interest nicely to be saved in bio since hobbies column is not yet in profiles table
      const formattedHobbies = `Centres d'intérêt : ${selectedHobbies.join(", ")}`;
      const finalBio = bio.trim() ? `${bio.trim()}\n\n${formattedHobbies}` : formattedHobbies;

      // 4. Try to update phone in Auth metadata
      // Numéro toujours enregistré au format international E.164 (ex: +237699887766),
      // produit par libphonenumber-js plutôt que concaténé à la main.
      const parsedPhone = selectedCountryIso
        ? parsePhoneNumberFromString(phoneLocal.trim(), selectedCountryIso)
        : null;
      const formattedAuthPhone = parsedPhone?.number || phoneLocal.trim();
      try {
        await withTimeout(
          supabase.auth.updateUser({
            phone: formattedAuthPhone,
            data: { phone_number: formattedAuthPhone }
          }),
          10000
        );
      } catch (phoneErr) {
        console.warn("Could not save phone to Auth service, saving to profile metadata:", phoneErr);
      }

      // 5. Update the profiles table row
      // Payload here is now lean (Storage URLs only, never raw base64 images),
      // so a generous-but-bounded 25s is enough even on a slow connection.
      const { error: profileErr } = await withTimeout(
        supabase
          .from("profiles")
          .upsert({
            uid: currentUser.id,
            username: username.toLowerCase().trim(),
            full_name: fullName.trim(),
            age: parseInt(age.toString()),
            location: location.trim(),
            gender,
            preferences,
            relationship_intents: selectedIntents,
            bio: finalBio,
            avatar_url: finalAvatarUrl,
            photos: galleryUrls,
            verification_status: "none",
            phone_country_code: selectedCountryIso || "",
            phone_number: parsedPhone?.number || phoneLocal.trim(),
            updated_at: new Date().toISOString()
          }),
        25000
      );

      if (profileErr) throw profileErr;

      if (galleryUploadFailures > 0) {
        alert(
          galleryUploadFailures === 1
            ? t("errors.gallerySkippedOne")
            : t("errors.gallerySkippedMany", { count: galleryUploadFailures })
        );
      }

      // Complete!
      onComplete();
    } catch (err: any) {
      console.error("Onboarding submission error:", err);
      const timedOut = err?.message === "TIMEOUT";
      const avatarFailed = err?.message === "AVATAR_UPLOAD_FAILED";
      alert(
        timedOut
          ? t("errors.timeout")
          : avatarFailed
          ? t("errors.avatarUploadFailed")
          : t("errors.genericSubmit", { message: err.message || err })
      );
    } finally {
      setLoading(false);
      setSaveProgress("");
    }
  };

  return (
    <div className="min-h-screen bg-rose-50/30 flex flex-col justify-start md:justify-center items-center p-4 overflow-y-auto font-sans py-8 md:py-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col relative">
        {/* Progress bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-100">
          <div 
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        {/* Header decoration */}
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Heart size={18} className="text-rose-500 fill-rose-500 animate-pulse" />
            <span className="text-xs font-black text-rose-500 uppercase tracking-widest">LoveRose</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
            {t("stepIndicator", { current: step, total: totalSteps })}
          </span>
        </div>

        {/* Content stages wrapper */}
        <div className="p-6 flex-1 min-h-[360px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <Phone size={18} className="text-rose-500" /> {t("phoneTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("phoneDescription")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t("phoneLabel")}</label>
                  
                  <div className="flex gap-2">
                    <div className="w-1/3">
                      <CountryDialSelect value={selectedCountryIso} onChange={setSelectedCountryIso} locale={i18n.language} />
                    </div>

                    <div className="w-2/3">
                      <input
                        type="tel"
                        placeholder={t("phoneNumberPlaceholder")}
                        value={phoneLocal}
                        onChange={(e) => setPhoneLocal(e.target.value)}
                        className="w-full h-[46px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  {selectedCountryIso && phoneLocal.trim().length > 0 && (() => {
                    const parsed = parsePhoneNumberFromString(phoneLocal.trim(), selectedCountryIso);
                    const valid = !!parsed?.isValid();
                    return (
                      <div className="flex justify-between items-center text-[10px] font-bold mt-1.5">
                        <span className={valid ? "text-emerald-500" : "text-slate-500"}>
                          {valid ? t("phoneValidNumber", { number: parsed?.number }) : t("phoneIncomplete")}
                        </span>
                        {!valid && (
                          <span className="text-rose-500 font-bold">{t("checkFormat")}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <MapPin size={18} className="text-rose-500" /> {t("profileTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("profileDescription")}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("fullNameLabel")}</label>
                    <input
                      type="text"
                      placeholder={t("fullNamePlaceholder")}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("usernameLabel")}</label>
                    <input
                      type="text"
                      placeholder={t("usernamePlaceholder")}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("ageLabel")}</label>
                    <input
                      type="number"
                      min={18}
                      max={99}
                      value={age === 0 ? '' : age}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setAge(0);
                          return;
                        }
                        const parsed = parseInt(raw, 10);
                        if (!isNaN(parsed)) setAge(parsed);
                      }}
                      className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500 ${
                        age > 0 && age < 18 ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    {age > 0 && age < 18 && (
                      <p className="text-[10px] text-red-500 font-semibold">{t("ageError")}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("locationLabel")}</label>
                    <input
                      type="text"
                      placeholder={t("locationPlaceholder")}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("genderLabel")}</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                    >
                      <option value="homme">{t("genderOptions.homme")}</option>
                      <option value="femme">{t("genderOptions.femme")}</option>
                      <option value="autre">{t("genderOptions.autre")}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("preferencesLabel")}</label>
                    <select
                      value={preferences}
                      onChange={(e) => setPreferences(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-rose-500"
                    >
                      <option value="femme">{t("preferencesOptions.femme")}</option>
                      <option value="homme">{t("preferencesOptions.homme")}</option>
                      <option value="tous">{t("preferencesOptions.tous")}</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <Smile size={18} className="text-rose-500" /> {t("hobbiesTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("hobbiesDescription")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {hobbiesList.map(hobby => {
                    const selected = selectedHobbies.includes(hobby);
                    return (
                      <button
                        key={hobby}
                        type="button"
                        onClick={() => toggleHobby(hobby)}
                        className={`p-2.5 text-[11px] font-semibold rounded-xl text-left border transition cursor-pointer flex items-center justify-between ${
                          selected
                            ? "bg-rose-50 border-rose-200 text-rose-600 font-extrabold"
                            : "bg-slate-50/50 border-slate-150 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{t(`hobbiesList.${hobby}`)}</span>
                        {selected && <CheckCircle2 size={12} className="text-rose-500" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <Compass size={18} className="text-rose-500" /> {t("intentsTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("intentsDescription")}
                  </p>
                </div>

                <div className="space-y-2">
                  {intentsList.map(intent => {
                    const selected = selectedIntents.includes(intent);
                    return (
                      <button
                        key={intent}
                        type="button"
                        onClick={() => toggleIntent(intent)}
                        className={`w-full p-3 text-xs font-semibold rounded-xl text-left border transition cursor-pointer flex items-center justify-between ${
                          selected
                            ? "bg-rose-50 border-rose-200 text-rose-600 font-extrabold"
                            : "bg-slate-50/50 border-slate-150 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{t(`intentsList.${intent}`)}</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                          selected ? "bg-rose-500 border-rose-500 text-white" : "border-slate-350 bg-white"
                        }`}>
                          {selected && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <FileText size={18} className="text-rose-500" /> {t("bioTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("bioDescription")}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("bioLabel")}</label>
                  <textarea
                    placeholder={t("bioPlaceholder")}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    maxLength={300}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-rose-500 resize-none"
                  />
                  <div className="text-right text-[9px] text-slate-400">
                    {t("bioCounter", { count: bio.length })}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <Camera size={18} className="text-rose-500" /> {t("avatarTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("avatarDescription")}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center p-3">
                  <input
                    type="file"
                    id="onboarding-avatar-file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  
                  <label 
                    htmlFor="onboarding-avatar-file"
                    className="w-32 h-32 rounded-full border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-rose-300 transition cursor-pointer flex flex-col items-center justify-center overflow-hidden relative group"
                  >
                    {avatarPreview ? (
                      <>
                        <img src={avatarPreview} alt={t("previewAlt")} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-bold">
                          {t("changePhoto")}
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-4 text-slate-400 space-y-1">
                        <Camera size={24} className="mx-auto text-slate-350" />
                        <span className="text-[10px] font-bold block">{t("chooseFile")}</span>
                      </div>
                    )}
                  </label>
                </div>
              </motion.div>
            )}

            {step === 7 && (
              <motion.div
                key="step7"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                    <Camera size={18} className="text-rose-500" /> {t("galleryTitle")}
                  </h2>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {t("galleryDescription")}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex flex-col items-center">
                      <input
                        type="file"
                        id={`onboarding-gallery-${index}`}
                        accept="image/*"
                        onChange={(e) => handleGalleryFileChange(e, index)}
                        className="hidden"
                      />
                      <label
                        htmlFor={`onboarding-gallery-${index}`}
                        className="aspect-square w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-rose-300 transition cursor-pointer flex flex-col items-center justify-center overflow-hidden relative group"
                      >
                        {galleryPreviews[index] ? (
                          <>
                            <img src={galleryPreviews[index]!} alt={t("galleryPhotoAlt", { index: index + 1 })} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[9px] font-bold">
                              {t("galleryChange")}
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-2 text-slate-400 space-y-1">
                            <Camera size={18} className="mx-auto text-slate-350" />
                            <span className="text-[9px] font-bold block">{t("galleryPhotoLabel", { index: index + 1 })}</span>
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="bg-rose-50/50 border border-rose-100 p-2.5 rounded-2xl text-[10px] text-rose-600 font-semibold text-center mt-2">
                  {t("galleryCounter", { count: galleryPreviews.filter(Boolean).length })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Controls */}
        <div className="p-6 pt-0 bg-slate-50 border-t border-slate-100 flex gap-3 items-center">
          {step > 1 && (
            <button
              onClick={handleBack}
              disabled={loading}
              className="px-4 py-3 bg-white hover:bg-slate-150 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <ArrowLeft size={14} />
              <span>{t("buttons.back", { ns: "common" })}</span>
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading}
            className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-rose-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                <span>{saveProgress || t("savingProgress")}</span>
              </>
            ) : (
              <>
                <span>{step === totalSteps ? t("finishAction") : t("buttons.next", { ns: "common" })}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
