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
      availableKeys: Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("VITE")),
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
      const fallbackReference = `LR-${Date.now()}-${userId.substring(0, 8)}`;
      const moneyFusionApiUrl = "https://pay.moneyfusion.net/LoveRose/5e63aa25ec22c9fa/pay/";
      
      const appUrl = process.env.APP_URL || `https://${req.get('host')}` || `http://localhost:3000`;
      const returnUrl = `${appUrl}/payment-success`;
      const webhookUrl = "https://iqoceeaqwfdqiucrsicm.supabase.co/functions/v1/moneyfusion-webhook";

      const payload = {
        totalPrice: amount,
        article: [{ [planId]: amount }],
        personal_Info: [{ userId: userId, orderId: fallbackReference }],
        numeroSend: "01010101",
        nomclient: email ? email.split("@")[0] : "Membre LoveRose",
        return_url: returnUrl,
        webhook_url: webhookUrl
      };

      console.log(`[LoveRose Payment Backend] Initiating Money Fusion request:`, payload);

      let checkoutUrl = "";
      let reference = fallbackReference;

      try {
        const apiResponse = await fetch(moneyFusionApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (apiResponse.ok) {
          const data = await apiResponse.json();
          console.log(`[LoveRose Payment Backend] Response:`, data);
          if (data.statut && data.token && data.url) {
            checkoutUrl = data.url;
            reference = data.token; // we use the token as the reference!
          }
        } else {
          console.error(`[LoveRose Payment Backend] API response error:`, apiResponse.status);
        }
      } catch (apiErr) {
        console.error(`[LoveRose Payment Backend] API fetch exception:`, apiErr);
      }

      // If API fails or doesn't return url/token, build direct checkout url fallback
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
          userId: userId,
          user_id: userId,
          return_url: returnUrlFallback,
          url_retour: returnUrlFallback,
          cancel_url: cancelUrlFallback,
          url_annulation: cancelUrlFallback
        });
        checkoutUrl = `${moneyFusionApiUrl}?${params.toString()}`;
        reference = fallbackReference;
      }

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
          return res.status(500).json({ error: "Impossible de créer l'enregistrement de paiement dans la base de données. Transaction annulée pour votre sécurité." });
        }
      } else {
        return res.status(500).json({ error: "Client d'administration de la base de données indisponible. Transaction annulée." });
      }

      return res.json({ checkoutUrl, reference, isSandbox: false });
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

      // If payment is pending, proactively check Money Fusion direct notification API
      if (payment.statut === "pending") {
        console.log(`[LoveRose Verify] Proactively checking Money Fusion for pending reference: ${reference}`);
        let isPaidDirectly = false;

        try {
          // Check the correct Money Fusion notification URL (avoiding www. which fails SSL validation)
          const checkUrls = [
            `https://pay.moneyfusion.net/paiementNotif/${reference}`
          ];

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
                } catch (jsonErr) {
                  // Fallback string matching if not standard JSON
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

          // 1. Update status to success in database
          const { error: updateErr } = await supabaseAdmin
            .from("payments")
            .update({ statut: "success", transaction_id: `MF-DIRECT-VERIFY-${Date.now()}` })
            .eq("reference", reference);

          if (!updateErr) {
            payment.statut = "success"; // Update local representation for immediate return

            // 2. Process credits or subscription
            const userId = payment.user_id;
            const planId = payment.plan_id;
            const planName = payment.plan_name;

            if (planId.startsWith("pack_")) {
              let creditAmount = 10;
              if (planId === "pack_argent") creditAmount = 50;
              else if (planId === "pack_or") creditAmount = 100;

              // Get or create user_credits row
              const { data: userCredits } = await supabaseAdmin
                .from("user_credits")
                .select("*")
                .eq("user_id", userId)
                .single();

              if (userCredits) {
                await supabaseAdmin
                  .from("user_credits")
                  .update({ balance: (userCredits.balance || 0) + creditAmount, updated_at: new Date() })
                  .eq("user_id", userId);
              } else {
                await supabaseAdmin
                  .from("user_credits")
                  .insert([{ user_id: userId, balance: creditAmount }]);
              }

              // Log transaction
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
            }

            // 3. Insert notification
            await supabaseAdmin
              .from("notifications")
              .insert([
                {
                  user_id: userId,
                  sender_id: userId,
                  type: "payment_success",
                  content: `Félicitations ! Votre achat pour "${planName}" a été validé avec succès (vérification directe).`,
                  lu: false
                }
              ]);
          } else {
            console.error("[LoveRose Verify] Direct status database update failed:", updateErr);
          }
        }
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
