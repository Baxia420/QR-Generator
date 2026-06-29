import { NextResponse } from "next/server";
import { after } from "next/server";
import { getSupabase } from "@/utils/supabase";

// Fast ID generator for the Edge
function generateId(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Lightweight, zero-dependency User-Agent parser that works at the Edge
function parseUserAgent(ua) {
  if (!ua) {
    return { deviceType: "Unknown", os: "Unknown", browser: "Unknown" };
  }

  let deviceType = "Desktop";
  if (/mobile/i.test(ua)) deviceType = "Mobile";
  else if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";

  let os = "Unknown";
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) {
    browser = "Chrome";
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = "Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/edge|edg/i.test(ua)) {
    browser = "Edge";
  } else if (/opr/i.test(ua)) {
    browser = "Opera";
  }

  return { deviceType, os, browser };
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

  // Get or set scanner ID cookie to track unique visitor
  let scannerId = request.cookies.get("qr_scanner_id")?.value;
  let isNewScanner = false;
  if (!scannerId) {
    scannerId = generateId();
    isNewScanner = true;
  }

  // Extract Vercel Edge Geolocation and other tracking headers
  const country = request.headers.get("x-vercel-ip-country") || null;
  let city = request.headers.get("x-vercel-ip-city") || null;
  if (city) {
    try {
      city = decodeURIComponent(city);
    } catch {
      // fallback
    }
  }
  const latitude = request.headers.get("x-vercel-ip-latitude") || null;
  const longitude = request.headers.get("x-vercel-ip-longitude") || null;
  const referrer = request.headers.get("referer") || null;
  const userAgent = request.headers.get("user-agent") || null;
  const linkId = data.id;

  // Schedule analytics insert AFTER the response is sent
  after(async () => {
    try {
      const parsedUA = parseUserAgent(userAgent);
      const sb = getSupabase();
      
      await sb.from("scan_analytics").insert({
        link_id: linkId,
        user_agent: userAgent,
        country: country,
        city: city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        device_type: parsedUA.deviceType,
        os: parsedUA.os,
        browser: parsedUA.browser,
        referrer: referrer,
        scanner_id: scannerId,
      });
    } catch (err) {
      console.error("Failed to log scan analytics:", err);
    }
  });

  // Return redirect response immediately and set cookie
  const response = NextResponse.redirect(data.destination_url, { status: 302 });
  if (isNewScanner) {
    response.cookies.set("qr_scanner_id", scannerId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }
  return response;
}
