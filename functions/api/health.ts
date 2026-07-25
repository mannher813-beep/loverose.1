import { json } from "../_shared/supabaseAdmin";

export const onRequestGet: PagesFunction = async () => {
  return json({ status: "ok", time: new Date().toISOString() });
};
