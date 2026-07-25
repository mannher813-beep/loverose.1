import { getSupabaseAdmin, json, type Env } from "../../_shared/supabaseAdmin";
import { fulfillPayment } from "../../_shared/fulfillPayment";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const payload = { ...body, ...query };

    const reference = payload.reference || payload.ref || payload.reference_marchand || payload.order_id;
    const status = payload.status || payload.statut || payload.state;
    const transaction_id = payload.transaction_id || payload.trans_id || payload.payment_id;

    console.log("[LoveRose Webhook] Received webhook payload:", payload);

    if (!reference) {
      return json({ error: "Missing reference parameter" }, 400);
    }

    const supabaseAdmin = getSupabaseAdmin(env);
    if (!supabaseAdmin) {
      return json({ error: "Supabase admin client not initialized on server" }, 500);
    }

    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("reference", reference)
      .single();

    if (fetchErr || !payment) {
      console.error("Payment entry not found for reference:", reference, fetchErr);
      return json({ error: "Payment reference not found in database" }, 404);
    }

    if (payment.statut === "success") {
      return json({ status: "already_processed" });
    }

    const isSuccess =
      status === "success" ||
      status === "succeeded" ||
      status === "verified" ||
      status === "approved" ||
      status === "COMPLETED";

    if (isSuccess) {
      await supabaseAdmin
        .from("payments")
        .update({ statut: "success", transaction_id: transaction_id || reference })
        .eq("reference", reference);

      await fulfillPayment(
        supabaseAdmin,
        payment.user_id,
        payment.plan_id,
        payment.plan_name,
        payment.montant,
        reference,
        transaction_id || reference
      );
    } else {
      await supabaseAdmin.from("payments").update({ statut: "failed" }).eq("reference", reference);
    }

    return json({ status: "processed" });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return json({ error: err.message }, 500);
  }
};
