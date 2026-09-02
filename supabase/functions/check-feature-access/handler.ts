// Portable, testable request-handling logic for the check-feature-access
// edge function. This file intentionally avoids `jsr:`-specifier imports
// (unlike index.ts) so it can be imported directly by Vitest -- the
// `jsr:@supabase/functions-js/edge-runtime.d.ts` import in index.ts is a
// types-only import that Node/Vitest cannot resolve.
//
// Everything below is the same request-handling logic that used to live
// inline in index.ts's `Deno.serve(...)` callback, moved here verbatim
// with ONE deliberate behavior change: the entitlement target is derived
// exclusively from the verified JWT user (`user.id`), never from a
// client-supplied `body.user_id`. See handler.test.ts for the regression
// test that proves this.
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export async function handleCheckFeatureAccess(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", code: "UNAUTHORIZED" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const featureKey: string = body.feature_key;
    // SECURITY: the entitlement target is always the authenticated JWT
    // user. Never accept a client-supplied user_id here -- this endpoint
    // is self-only by design (no legitimate cross-user/admin caller
    // exists anywhere in this repo).
    const userId: string = user.id;

    if (!featureKey) {
      return new Response(
        JSON.stringify({ error: "feature_key is required", code: "MISSING_FEATURE_KEY" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the SECURITY DEFINER function to check access server-side
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: hasAccess, error: rpcError } = await adminSupabase.rpc("has_feature_access", {
      p_user_id: userId,
      p_feature_key: featureKey,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "Access check failed", code: "CHECK_FAILED" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hasAccess) {
      // Determine which plan includes this feature
      const { data: feature } = await adminSupabase
        .from("features")
        .select("display_name, upgrade_title, upgrade_body, upgrade_cta")
        .eq("feature_key", featureKey)
        .maybeSingle();

      // Find the minimum plan that includes this feature
      const { data: planData } = await adminSupabase
        .from("plan_features")
        .select("plan_id, membership_plans(slug, name)")
        .eq("feature_id", feature?.id || "")
        .eq("is_enabled", true);

      const requiredPlan = planData && planData.length > 0
        ? (planData[0] as { plan_id: string; membership_plans: { slug: string; name: string } }).membership_plans.slug
        : null;

      return new Response(
        JSON.stringify({
          has_access: false,
          code: "FEATURE_NOT_INCLUDED",
          feature_key: featureKey,
          required_plan: requiredPlan,
          feature_name: feature?.display_name || null,
          upgrade_title: feature?.upgrade_title || null,
          upgrade_body: feature?.upgrade_body || null,
          upgrade_cta: feature?.upgrade_cta || null,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ has_access: true, feature_key: featureKey }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
