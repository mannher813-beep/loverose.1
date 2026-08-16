// Contrôle qualité léger, 100% côté client, sans librairie externe.
// Objectif : attraper les photos ratées (trop sombres, trop floues) AVANT
// l'upload plutôt qu'après refus de l'admin — un aller-retour KYC coûte
// cher en data sur une connexion mobile camerounaise moyenne.
//
// Ce n'est PAS de la détection de visage/liveness — juste deux heuristiques
// simples et rapides (luminosité moyenne + variance des gradients comme
// proxy de netteté) qui tournent en quelques millisecondes sur un canvas
// redimensionné.

export interface QualityResult {
  ok: boolean;
  warning: string | null;
  blob: Blob; // version compressée, prête à uploader
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export async function checkImageQuality(file: File): Promise<QualityResult> {
  const img = await loadImage(file);

  // Redimensionne à 1600px de large max — assez pour la lecture d'une pièce
  // d'identité, largement suffisant pour une revue humaine, et beaucoup plus
  // léger à uploader/stocker qu'une photo brute de smartphone (souvent 8-12MB).
  const MAX_W = 1600;
  const scale = Math.min(1, MAX_W / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);

  // Échantillonne sur une petite grille (pas tous les pixels) pour rester
  // rapide même sur un téléphone d'entrée de gamme.
  const sampleW = 160;
  const sampleH = Math.round((h / w) * sampleW);
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleW;
  sampleCanvas.height = sampleH;
  const sctx = sampleCanvas.getContext("2d")!;
  sctx.drawImage(canvas, 0, 0, sampleW, sampleH);
  const { data } = sctx.getImageData(0, 0, sampleW, sampleH);

  const gray = new Float32Array(sampleW * sampleH);
  let brightnessSum = 0;
  for (let i = 0; i < sampleW * sampleH; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    brightnessSum += lum;
  }
  const avgBrightness = brightnessSum / (sampleW * sampleH); // 0-255

  // Netteté approximative : variance des différences horizontales de
  // luminosité. Une image floue a des transitions douces -> variance faible.
  let gradSum = 0;
  let gradSqSum = 0;
  let count = 0;
  for (let y = 0; y < sampleH; y++) {
    for (let x = 1; x < sampleW; x++) {
      const diff = gray[y * sampleW + x] - gray[y * sampleW + x - 1];
      gradSum += diff;
      gradSqSum += diff * diff;
      count++;
    }
  }
  const meanGrad = gradSum / count;
  const sharpness = gradSqSum / count - meanGrad * meanGrad; // variance

  let warning: string | null = null;
  if (avgBrightness < 55) {
    warning = "Photo trop sombre — reprenez-la avec plus de lumière si possible.";
  } else if (avgBrightness > 235) {
    warning = "Photo surexposée — évitez le flash direct ou le contre-jour.";
  } else if (sharpness < 8) {
    warning = "Photo un peu floue — tenez le téléphone stable et reprenez si possible.";
  }

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.85)
  );

  // On ne bloque jamais l'envoi — juste un avertissement. En vrai contexte
  // (mauvais éclairage réel, pas juste un test), forcer un refus frustre
  // plus qu'il n'aide.
  return { ok: !warning, warning, blob };
}
