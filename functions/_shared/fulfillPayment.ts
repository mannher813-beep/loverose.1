// Ported 1:1 from the original server.ts Express backend.
export async function fulfillPayment(
  supabaseAdmin: any,
  userId: string,
  planId: string,
  planName: string,
  amount: number,
  reference: string,
  transactionId: string
) {
  console.log(`[LoveRose Payment Fulfill] Fulfilling payment. User: ${userId}, Plan: ${planId}, Amount: ${amount}`);

  // A. STANDARD PACKS CREDITS
  if (planId.startsWith("pack_")) {
    let creditAmount = 10;
    if (planId === "pack_argent") creditAmount = 50;
    else if (planId === "pack_or") creditAmount = 100;

    const { data: userCredits } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let newBalance = creditAmount;
    if (userCredits) {
      newBalance = (userCredits.balance || 0) + creditAmount;
      await supabaseAdmin
        .from("user_credits")
        .update({ balance: newBalance, updated_at: new Date() })
        .eq("user_id", userId);
    } else {
      await supabaseAdmin.from("user_credits").insert([{ user_id: userId, balance: creditAmount }]);
    }

    await supabaseAdmin.from("credit_transactions").insert([
      {
        user_id: userId,
        amount: creditAmount,
        type: "purchase",
        description: `Achat Pack ${planName}`,
        reference: reference,
      },
    ]);
    console.log(`[Fulfill] Credited ${creditAmount} credits to user ${userId}`);
  }
  // B. PREMIUM APP SUBSCRIPTION
  else if (planId === "premium_sub") {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + 30);

    await supabaseAdmin.from("subscriptions").upsert({
      user_id: userId,
      type: "premium",
      status: "active",
      start_date: now,
      end_date: expiresAt,
      updated_at: now,
    });
    console.log(`[Fulfill] Activated Premium subscription for user ${userId}`);
  }
  // C0. TRUST / IDENTITY VERIFICATION BADGE FEE (500 FCFA unique)
  else if (planId === "verification_badge") {
    // The user already uploaded their ID + selfie and the profile was set to
    // "pending_payment" client-side. Now that Money Fusion confirms payment,
    // move it to "pending" so an administrator can review and approve/reject it.
    const { error: verifErr } = await supabaseAdmin
      .from("profiles")
      .update({ verification_status: "pending" })
      .eq("uid", userId)
      .eq("verification_status", "pending_payment");

    if (verifErr) {
      console.error("[Fulfill] Error moving verification_status to pending after badge payment:", verifErr);
    } else {
      console.log(`[Fulfill] Badge verification fee paid by user ${userId}, request now pending admin review`);
    }
  }
  // C. CREATOR PAGE ACTIVATION FEE (1,000 FCFA unique)
  else if (planId === "creator_page_activation") {
    const { error: pageErr } = await supabaseAdmin
      .from("creator_pages")
      .update({ activation_paid: true, status: "active" })
      .eq("owner_id", userId)
      .eq("activation_paid", false);

    if (pageErr) {
      console.error("[Fulfill] Error activating creator pages:", pageErr);
    } else {
      console.log(`[Fulfill] Creator page access activated for user ${userId}`);
    }
  }
  // D. MONTHLY CREATOR PAGE SUBSCRIPTION (page_subscription:PAGE_ID)
  else if (planId.startsWith("page_subscription:")) {
    const pageId = planId.split(":")[1];
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + 30);

    const { error: subErr } = await supabaseAdmin.from("page_subscriptions").insert([
      {
        user_id: userId,
        page_id: pageId,
        status: "active",
        ends_at: expiresAt,
      },
    ]);

    if (subErr) {
      console.error("[Fulfill] Error creating page subscription:", subErr);
    }

    const { error: earnErr } = await supabaseAdmin.from("creator_earnings").insert([
      {
        page_id: pageId,
        amount: amount,
        source: "page_subscription",
      },
    ]);

    if (earnErr) {
      console.error("[Fulfill] Error logging creator earnings:", earnErr);
    }
    console.log(`[Fulfill] Activated Creator Page Subscription for page ${pageId}, user ${userId}`);
  }
  // E. SENDER TIP FOR CREATOR (tip:PAGE_ID)
  else if (planId.startsWith("tip:")) {
    const pageId = planId.split(":")[1];

    const { error: tipErr } = await supabaseAdmin.from("creator_tips").insert([
      {
        page_id: pageId,
        user_id: userId,
        amount: amount,
        message: "Pourboire de soutien",
      },
    ]);

    if (tipErr) {
      console.error("[Fulfill] Error logging creator tip details:", tipErr);
    }

    const { error: earnErr } = await supabaseAdmin.from("creator_earnings").insert([
      {
        page_id: pageId,
        amount: amount,
        source: "tip",
      },
    ]);

    if (earnErr) {
      console.error("[Fulfill] Error logging creator tip earnings:", earnErr);
    }
    console.log(`[Fulfill] Processed Creator tip of ${amount} for page ${pageId} from user ${userId}`);
  }
  // F. PREMIUM CONTENT / POST UNLOCK (premium_content_unlock:POST_ID)
  else if (planId.startsWith("premium_content_unlock:")) {
    const postId = planId.split(":")[1];

    const { error: unlockErr } = await supabaseAdmin.from("post_unlocks").insert([
      {
        user_id: userId,
        post_id: postId,
      },
    ]);

    if (unlockErr) {
      console.error("[Fulfill] Error inserting post unlock:", unlockErr);
    }

    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .select("page_id")
      .eq("id", postId)
      .maybeSingle();

    if (post && post.page_id) {
      const { error: earnErr } = await supabaseAdmin.from("creator_earnings").insert([
        {
          page_id: post.page_id,
          amount: amount,
          source: "premium_content",
        },
      ]);

      if (earnErr) {
        console.error("[Fulfill] Error logging post unlock creator earnings:", earnErr);
      }
    } else {
      console.warn("[Fulfill] Could not find associated creator page for post unlock", postId, postErr);
    }
    console.log(`[Fulfill] Unlocked post ${postId} for user ${userId}`);
  }

  // G. AUTO REFERRAL COMMISSION PAYOUT CHECK (10% of any successful transaction)
  try {
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("referrer_id")
      .eq("referred_id", userId)
      .maybeSingle();

    if (referral && referral.referrer_id) {
      const { data: referrerPage } = await supabaseAdmin
        .from("creator_pages")
        .select("id")
        .eq("owner_id", referral.referrer_id)
        .eq("activation_paid", true)
        .maybeSingle();

      if (referrerPage) {
        const commissionAmount = Math.round(amount * 0.1);
        if (commissionAmount > 0) {
          await supabaseAdmin.from("creator_earnings").insert([
            {
              page_id: referrerPage.id,
              amount: commissionAmount,
              source: "referral_commission",
            },
          ]);
          console.log(
            `[Referral Commission] Credited ${commissionAmount} FCFA to referrer ${referral.referrer_id} for purchase by referred user ${userId}`
          );
        }
      }
    }
  } catch (refErr) {
    console.warn("[Fulfill] Referral commission logic execution skipped:", refErr);
  }

  // H. INSERT IN-APP NOTIFICATION
  try {
    await supabaseAdmin.from("notifications").insert([
      {
        user_id: userId,
        sender_id: userId,
        type: "payment_success",
        content: `Félicitations ! Votre achat pour "${planName}" a été validé avec succès.`,
        lu: false,
      },
    ]);
  } catch (notifErr) {
    console.warn("[Fulfill] Notification insert failed:", notifErr);
  }
}
