import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create a dedicated Supabase client for the route handler
// (cannot import from utils because that file may throw during build if env vars are missing)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET(request, { params }) {
  const { code } = await params;

  const supabase = getSupabase();

  // Look up the short code
  const { data, error } = await supabase
    .from("qr_links")
    .select("id, destination_url")
    .eq("short_code", code)
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "Link not found",
        message: `No redirect found for code: ${code}`,
      },
      { status: 404 }
    );
  }

  // Schedule analytics insert AFTER the response is sent.
  // This is critical for Vercel: serverless functions freeze the instant
  // a response is returned. after() keeps the function alive for background work.
  const userAgent = request.headers.get("user-agent") || null;
  const linkId = data.id;

  after(async () => {
    try {
      await supabase.from("scan_analytics").insert({
        link_id: linkId,
        user_agent: userAgent,
      });
    } catch (err) {
      // Silently fail — analytics should never break redirects
      console.error("Failed to log scan analytics:", err);
    }
  });

  // Return the redirect immediately
  return NextResponse.redirect(data.destination_url, { status: 302 });
}
