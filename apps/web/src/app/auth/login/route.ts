import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error || !data.url) return NextResponse.redirect(`${origin}/?auth=failed`);
    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(new URL("/?auth=not-configured", request.url));
  }
}
