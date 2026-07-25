import { getSupabaseAdmin, json, type Env } from "../../_shared/supabaseAdmin";
import { fulfillPayment } from "../../_shared/fulfillPayment";

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    const reference = new URL(request.url).searchParams.get("reference") || "";
    if (!reference) {
      return json({ error: "Missing reference parameter" }, 400);
    }

    const supabaseAdmin = getSupabaseAdmin(env);
    if (!supabaseAdmin) {
      return json({ error: "Supabase admin client not initialized on server" }, 500);
    }

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .single();

    if (error || !payment) {
      return json({ error: "Payment not found" }, 404);
    }

    if (payment.statut === "pending") {
      console.log(`[LoveRose Verify] Proactively checking Money Fusion for pending reference: ${reference}`);
      let isPaidDirectly = false;

      try {
        const checkUrls = [`https://pay.moneyfusion.net/paiementNotif/${reference}`];

        for (const url of checkUrls) {
          try {
            const apiCheck = await fetch(url, { method: "GET" });
            if (apiCheck.ok) {
              const text = await apiCheck.text();
              console.log(`[LoveRose Verify] Direct check response from ${url}:`, text);

              try {
                const checkData = JSON.parse(text);
                if (
                  checkData.statut === "paid" ||
                  checkData.status === "paid" ||
                  checkData.state === "paid" ||
                  checkData.statut === "success" ||
                  checkData.statut === true
                ) {
                  isPaidDirectly = true;
                  break;
                }
              } catch {
                if (
                  text.includes('"paid"') ||
                  text.includes('"success"') ||
                  text.toLowerCase().includes("paid")
                ) {
                  isPaidDirectly = true;
                  break;
                }
              }
            }
          } catch (singleUrlErr) {
            console.warn(`[LoveRose Verify] Failed to check URL ${url}:`, singleUrlErr);
          }
        }
      } catch (checkErr) {
        console.error("[LoveRose Verify] Direct verification fetch exception:", checkErr);
      }

      if (isPaidDirectly) {
        console.log(`[LoveRose Verify] Reference ${reference} confirmed PAID directly! Crediting user...`);

        const { error: updateErr } = await supabaseAdmin
          .from("payments")
          .update({ statut: "success", transaction_id: `MF-DIRECT-VERIFY-${Date.now()}` })
          .eq("reference", reference);

        if (!updateErr) {
          payment.statut = "success";
          await fulfillPayment(
            supabaseAdmin,
            payment.user_id,
            payment.plan_id,
            payment.plan_name,
            payment.montant,
            reference,
            `MF-DIRECT-VERIFY-${Date.now()}`
          );
        } else {
          console.error("[LoveRose Verify] Direct status database update failed:", updateErr);
        }
      }
    }

    return json({ status: payment.statut, payment });
  } catch (err: any) {
    console.error("Verify payment error:", err);
    return json({ error: err.message }, 500);
  }
};
