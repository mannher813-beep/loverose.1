import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface UserEntitlements {
  premium: boolean;
  subscription_type: string | null;
  subscription_status: string | null;
  expires_at: string | null;
  credits: number;
  can_send_messages: boolean;
}

export function usePremiumStatus(userId: string | undefined) {
  const [entitlements, setEntitlements] = useState<UserEntitlements>({
    premium: false,
    subscription_type: null,
    subscription_status: null,
    expires_at: null,
    credits: 0,
    can_send_messages: false,
  });
  const [loading, setLoading] = useState<boolean>(true);

  const fetchEntitlements = async () => {
    if (!userId) return;
    try {
      // Direct call to official get_user_entitlements RPC
      const { data, error } = await supabase.rpc("get_user_entitlements", {
        check_user_id: userId,
      });

      if (!error && data) {
        setEntitlements({
          premium: !!data.premium,
          subscription_type: data.subscription_type || null,
          subscription_status: data.subscription_status || null,
          expires_at: data.expires_at || null,
          credits: typeof data.credits === "number" ? data.credits : 0,
          can_send_messages: !!data.can_send_messages,
        });
      } else {
        // Fallback to manual check if RPC does not exist yet
        console.warn("get_user_entitlements RPC error or missing, falling back:", error);
        
        // Check premium status via is_user_premium RPC
        const { data: isPrem } = await supabase.rpc("is_user_premium", {
          check_user_id: userId,
        });

        // Fetch subscriptions table
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        // Fetch credits
        const { data: creditsData } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", userId)
          .maybeSingle();

        const premium = !!isPrem;
        const credits = creditsData?.balance || 0;

        setEntitlements({
          premium,
          subscription_type: subData?.type || null,
          subscription_status: subData?.status || null,
          expires_at: subData?.end_date || null,
          credits,
          can_send_messages: premium || credits > 0,
        });
      }
    } catch (err) {
      console.error("Error fetching entitlements:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchEntitlements();

    // Subscribe to realtime updates on subscriptions and user_credits to refresh entitlements
    const subChannel = supabase
      .channel(`entitlements-sub-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchEntitlements();
        }
      )
      .subscribe();

    const creditsChannel = supabase
      .channel(`entitlements-credits-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_credits",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchEntitlements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subChannel);
      supabase.removeChannel(creditsChannel);
    };
  }, [userId]);

  return { entitlements, loading, refresh: fetchEntitlements };
}
