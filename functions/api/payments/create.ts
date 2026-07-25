import { getSupabaseAdmin, json, type Env } from "../../_shared/supabaseAdmin";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const { userId, planId, planName, amount, email, related_page_id, related_post_id } =
      await request.json<any>();

    if (!userId || !planId || !amount) {
      return json({ error: "Missing required parameters: userId, planId, amount" }, 400);
    }

    let finalPlanId = planId;
    if (related_page_id) {
      finalPlanId = `${planId}:${related_page_id}`;
    } else if (related_post_id) {
      finalPlanId = `${planId}:${related_post_id}`;
    }

    const fallbackReference = `LR-${Date.now()}-${String(userId).substring(0, 8)}`;
    // ✅ App LoveRose (En attente d'approbation MoneyFusion) - PAS "Les copains de la forêt"
    const moneyFusionApiUrl =
      env.MONEY_FUSION_API_URL || "https://pay.moneyfusion.net/LoveRose/e9880132f97c71c6/pay/";

    const appUrl = env.APP_URL || new URL(request.url).origin;
    const returnUrl = `${appUrl}/payment-success`;
    const webhookUrl = "https://iqoceeaqwfdqiucrsicm.supabase.co/functions/v1/moneyfusion-webhook";

    const payload = {
      totalPrice: amount,
      article: [{ [planId]: amount }],
      personal_Info: [{ userId, orderId: fallbackReference }],
      numeroSend: "01010101",
      nomclient: email ? email.split("@")[0] : "Membre LoveRose",
      return_url: returnUrl,
      webhook_url: webhookUrl,
    };

    console.log(`[LoveRose Payment Backend] Initiating Money Fusion request:`, payload);

    let checkoutUrl = "";
    let reference = fallbackReference;

    try {
      const apiResponse = await fetch(moneyFusionApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (apiResponse.ok) {
        const data: any = await apiResponse.json();
        console.log(`[LoveRose Payment Backend] Response:`, data);
        if (data.statut && data.token && data.url) {
          checkoutUrl = data.url;
          reference = data.token;
        }
      } else {
        console.error(`[LoveRose Payment Backend] API response error:`, apiResponse.status);
      }
    } catch (apiErr) {
      console.error(`[LoveRose Payment Backend] API fetch exception:`, apiErr);
    }

    if (!checkoutUrl) {
      const returnUrlFallback = `${appUrl}/payment-success?reference=${fallbackReference}`;
      const cancelUrlFallback = `${appUrl}/`;
      const params = new URLSearchParams({
        amount: String(amount),
        prix: String(amount),
        total: String(amount),
        reference: fallbackReference,
        ref: fallbackReference,
        order_id: fallbackReference,
        libelle: planName,
        description: `Achat ${planName} sur LoveRose`,
        name: planName,
        email: email || "",
        mail: email || "",
        userId,
        user_id: userId,
        return_url: returnUrlFallback,
        url_retour: returnUrlFallback,
        cancel_url: cancelUrlFallback,
        url_annulation: cancelUrlFallback,
      });
      checkoutUrl = `${moneyFusionApiUrl}?${params.toString()}`;
      reference = fallbackReference;
    }

    const supabaseAdmin = getSupabaseAdmin(env);
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from("payments").insert([
        {
          user_id: userId,
          montant: amount,
          statut: "pending",
          plan_id: finalPlanId,
          plan_name: planName,
          reference: reference,
        },
      ]);
      if (error) {
        console.error("Error creating record in 'payments' table:", error);
        return json(
          { error: "Impossible de créer l'enregistrement de paiement dans la base de données. Transaction annulée pour votre sécurité." },
          500
        );
      }
    } else {
      return json({ error: "Client d'administration de la base de données indisponible. Transaction annulée." }, 500);
    }

    return json({ checkoutUrl, reference, isSandbox: false });
  } catch (err: any) {
    console.error("Create payment error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
};
