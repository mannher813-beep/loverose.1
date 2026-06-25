import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Supabase admin client configuration (using service role key on server side to bypass RLS for transactions)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  
  let supabaseAdmin: any = null;
  if (supabaseUrl && supabaseServiceKey) {
    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      console.log("Supabase Admin initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize Supabase Admin client:", err);
    }
  }

  // --- API Routes ---
  
  // Dynamically serve environment variables to the frontend to avoid build-time baking issues
  app.get("/env.js", (req, res) => {
    res.type("application/javascript");
    res.send(`
      window.__ENV__ = {
        VITE_SUPABASE_URL: ${JSON.stringify(process.env.VITE_SUPABASE_URL || "")},
        VITE_SUPABASE_ANON_KEY: ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || "")}
      };
    `);
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Detailed Supabase connection check
  app.get("/api/debug-supabase", async (req, res) => {
    const url = process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    const status = {
      urlConfigured: !!url,
      anonKeyConfigured: !!anonKey,
      serviceKeyConfigured: !!serviceKey,
      urlPrefix: url ? url.substring(0, 20) + "..." : "none",
      testConnection: "pending" as string,
      errorMessage: null as string | null,
    };

    if (!supabaseAdmin) {
      status.testConnection = "failed";
      status.errorMessage = "supabaseAdmin is not initialized (missing URL or Service Key in process.env)";
      return res.json(status);
    }

    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("uid")
        .limit(1);

      if (error) {
        status.testConnection = "failed";
        status.errorMessage = `${error.code}: ${error.message}`;
      } else {
        status.testConnection = "success";
      }
    } catch (err: any) {
      status.testConnection = "failed";
      status.errorMessage = err.message || String(err);
    }

    res.json(status);
  });

  // Create a Money Fusion payment checkout url
  app.post("/api/payments/create", async (req, res) => {
    try {
      const { userId, planId, planName, amount, email } = req.body;
      
      if (!userId || !planId || !amount) {
        return res.status(400).json({ error: "Missing required parameters: userId, planId, amount" });
      }

      // Generate merchant reference
      const reference = `LR-${Date.now()}-${userId.substring(0, 8)}`;
      
      const apiKey = process.env.MONEY_FUSION_API_KEY;
      const merchantId = process.env.MONEY_FUSION_MERCHANT_ID;
      const moneyFusionApiUrl = process.env.MONEY_FUSION_API_URL || "https://pay.moneyfusion.net/LoveRose/5e63aa25ec22c9fa/pay/";
      
      // Sandbox is true if NO API key/merchant ID is present AND USE_LIVE_PAYMENT is not "true"
      const isSandbox = !apiKey && !merchantId && process.env.USE_LIVE_PAYMENT !== "true";

      console.log(`[LoveRose Payment] Creating payment: ${userId}, plan: ${planName}, amount: ${amount} FCFA, reference: ${reference} (Sandbox: ${isSandbox})`);

      // Store payment record in Supabase (status pending)
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from("payments")
          .insert([
            {
              user_id: userId,
              montant: amount,
              statut: "pending",
              plan_id: planId,
              plan_name: planName,
              reference: reference
            }
          ]);
        if (error) {
          console.error("Error creating record in 'payments' table:", error);
        }
      }

      let checkoutUrl = "";
      if (isSandbox) {
        // Build local interactive simulator URL
        const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        checkoutUrl = `${appUrl}/payment-sandbox?reference=${reference}&amount=${amount}&planId=${planId}&planName=${encodeURIComponent(planName)}&userId=${userId}`;
      } else {
        // Real Money Fusion payment: Prefer using hosted form URL if no api key/merchant ID is set
        if (!apiKey || !merchantId) {
          const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
          const returnUrl = `${appUrl}/payment-success?reference=${reference}`;
          const cancelUrl = `${appUrl}/payment-cancel?reference=${reference}`;

          // Append both French and English names to make sure Money Fusion forms can read them dynamically
          const params = new URLSearchParams({
            amount: String(amount),
            prix: String(amount),
            total: String(amount),
            reference: reference,
            ref: reference,
            order_id: reference,
            libelle: planName,
            description: `Achat ${planName} sur LoveRose`,
            name: planName,
            email: email || "",
            mail: email || "",
            userId: userId,
            user_id: userId,
            return_url: returnUrl,
            url_retour: returnUrl,
            cancel_url: cancelUrl,
            url_annulation: cancelUrl
          });

          const baseCheckoutUrl = moneyFusionApiUrl.endsWith("/") ? moneyFusionApiUrl : `${moneyFusionApiUrl}/`;
          checkoutUrl = `${baseCheckoutUrl}?${params.toString()}`;
          console.log(`[LoveRose Payment] Using Direct Hosted Payment page: ${checkoutUrl}`);
        } else {
          // Real Money Fusion API integration
          try {
            const response = await fetch("https://api.moneyfusion.net/v1/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                merchant_id: merchantId,
                amount: amount,
                currency: "XOF",
                reference: reference,
                description: `Achat ${planName} sur LoveRose`,
                email: email || "",
                return_url: `${process.env.APP_URL}/payment-success?reference=${reference}`,
                cancel_url: `${process.env.APP_URL}/payment-cancel?reference=${reference}`,
                webhook_url: `${process.env.APP_URL}/api/payments/webhook`
              })
            });

            const data = await response.json();
            if (response.ok && data.url) {
              checkoutUrl = data.url;
            } else {
              console.error("Money Fusion API Error, falling back to hosted payment url:", data);
              // Fallback to hosted URL if API fails but keys are entered
              const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
              const returnUrl = `${appUrl}/payment-success?reference=${reference}`;
              const cancelUrl = `${appUrl}/payment-cancel?reference=${reference}`;
              const params = new URLSearchParams({
                amount: String(amount),
                prix: String(amount),
                reference: reference,
                libelle: planName,
                return_url: returnUrl,
                cancel_url: cancelUrl
              });
              const baseCheckoutUrl = moneyFusionApiUrl.endsWith("/") ? moneyFusionApiUrl : `${moneyFusionApiUrl}/`;
              checkoutUrl = `${baseCheckoutUrl}?${params.toString()}`;
            }
          } catch (apiErr) {
            console.error("Failed to connect with Money Fusion API:", apiErr);
            const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
            checkoutUrl = `${appUrl}/payment-sandbox?reference=${reference}&amount=${amount}&planId=${planId}&planName=${encodeURIComponent(planName)}&userId=${userId}&error=network`;
          }
        }
      }

      return res.json({ checkoutUrl, reference, isSandbox });
    } catch (err: any) {
      console.error("Create payment error:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  // Verify status of a payment (called by the frontend to confirm status changes)
  app.get("/api/payments/verify", async (req, res) => {
    try {
      const reference = req.query.reference as string;
      if (!reference) {
        return res.status(400).json({ error: "Missing reference parameter" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Supabase admin client not initialized on server" });
      }

      // Query database for this reference
      const { data: payment, error } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("reference", reference)
        .single();

      if (error || !payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      return res.json({ status: payment.statut, payment });
    } catch (err: any) {
      console.error("Verify payment error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Webhook for Money Fusion Payments
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      // Handle either body or query params, and support various parameter names from Money Fusion
      const payload = { ...req.body, ...req.query };
      
      const reference = payload.reference || payload.ref || payload.reference_marchand || payload.order_id;
      const status = payload.status || payload.statut || payload.state;
      const transaction_id = payload.transaction_id || payload.trans_id || payload.payment_id;

      console.log("[LoveRose Webhook] Received webhook payload:", payload);

      if (!reference) {
        return res.status(400).json({ error: "Missing reference parameter" });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: "Supabase admin client not initialized on server" });
      }

      // Check the payment entry
      const { data: payment, error: fetchErr } = await supabaseAdmin
        .from("payments")
        .select("*")
        .eq("reference", reference)
        .single();

      if (fetchErr || !payment) {
        console.error("Payment entry not found for reference:", reference, fetchErr);
        return res.status(404).json({ error: "Payment reference not found in database" });
      }

      if (payment.statut === "success") {
        return res.json({ status: "already_processed" });
      }

      const isSuccess = status === "success" || status === "succeeded" || status === "verified" || status === "approved" || status === "COMPLETED";

      if (isSuccess) {
        // Update payment status to success
        await supabaseAdmin
          .from("payments")
          .update({ statut: "success", transaction_id: transaction_id || reference })
          .eq("reference", reference);

        const userId = payment.user_id;
        const planId = payment.plan_id;
        const planName = payment.plan_name;

        // Process Credits Pack or Premium Subscription
        if (planId.startsWith("pack_")) {
          let creditAmount = 10;
          if (planId === "pack_argent") creditAmount = 50;
          else if (planId === "pack_or") creditAmount = 100;

          // 1. Get or create user_credits row
          const { data: userCredits } = await supabaseAdmin
            .from("user_credits")
            .select("*")
            .eq("user_id", userId)
            .single();

          let newBalance = creditAmount;
          if (userCredits) {
            newBalance = (userCredits.balance || 0) + creditAmount;
            await supabaseAdmin
              .from("user_credits")
              .update({ balance: newBalance, updated_at: new Date() })
              .eq("user_id", userId);
          } else {
            await supabaseAdmin
              .from("user_credits")
              .insert([{ user_id: userId, balance: creditAmount }]);
          }

          // 2. Log in transactions
          await supabaseAdmin
            .from("credit_transactions")
            .insert([
              {
                user_id: userId,
                amount: creditAmount,
                type: "purchase",
                description: `Achat Pack ${planName}`,
                reference: reference
              }
            ]);

          console.log(`Credited ${creditAmount} credits to ${userId}. New balance: ${newBalance}`);
        } else if (planId === "premium_sub") {
          const now = new Date();
          const expiresAt = new Date();
          expiresAt.setDate(now.getDate() + 30);

          await supabaseAdmin
            .from("subscriptions")
            .upsert({
              user_id: userId,
              type: "premium",
              status: "active",
              start_date: now,
              end_date: expiresAt,
              updated_at: now
            });

          console.log(`Activated Premium subscription for user ${userId} until ${expiresAt}`);
        }

        // Send a in-app notification to the user
        await supabaseAdmin
          .from("notifications")
          .insert([
            {
              user_id: userId,
              sender_id: userId,
              type: "payment_success",
              content: `Félicitations ! Votre achat pour "${planName}" a été validé avec succès.`,
              lu: false
            }
          ]);
      } else {
        await supabaseAdmin
          .from("payments")
          .update({ statut: "failed" })
          .eq("reference", reference);
      }

      return res.json({ status: "processed" });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Serve static files in production or hook Vite in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LoveRose Server running on port ${PORT}`);
  });
}

startServer();
