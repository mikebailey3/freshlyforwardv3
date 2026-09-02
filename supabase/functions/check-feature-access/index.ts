import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCheckFeatureAccess } from "./handler.ts";

Deno.serve(async (req: Request) => {
  return handleCheckFeatureAccess(req);
});
