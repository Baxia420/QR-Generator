import { NextResponse } from "next/server";
import { getSupabase } from "@/utils/supabase";

// Lightweight, zero-dependency User-Agent parser
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

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      linkId,
      latitude,
      longitude,
      userAgent,
      referrer,
      scannerId,
    } = body;

    if (!linkId) {
      return NextResponse.json({ error: "Missing linkId" }, { status: 400 });
    }

    // Extract location info from Vercel headers (fallbacks/supplemental)
    const country = request.headers.get("x-vercel-ip-country") || null;
    let city = request.headers.get("x-vercel-ip-city") || null;
    if (city) {
      try {
        city = decodeURIComponent(city);
      } catch {}
    }

    // Use Vercel edge coordinates as fallback if GPS coordinates are null/rejected
    const finalLat = latitude || request.headers.get("x-vercel-ip-latitude");
    const finalLon = longitude || request.headers.get("x-vercel-ip-longitude");

    const parsedLat = finalLat ? parseFloat(finalLat) : null;
    const parsedLon = finalLon ? parseFloat(finalLon) : null;

    const latToInsert = (parsedLat !== null && !isNaN(parsedLat)) ? parsedLat : null;
    const lonToInsert = (parsedLon !== null && !isNaN(parsedLon)) ? parsedLon : null;

    const parsedUA = parseUserAgent(userAgent || request.headers.get("user-agent"));
    const supabase = getSupabase();

    const { error } = await supabase.from("scan_analytics").insert({
      link_id: linkId,
      user_agent: userAgent || request.headers.get("user-agent"),
      country: country,
      city: city,
      latitude: latToInsert,
      longitude: lonToInsert,
      device_type: parsedUA.deviceType,
      os: parsedUA.os,
      browser: parsedUA.browser,
      referrer: referrer || null,
      scanner_id: scannerId || null,
    });

    if (error) {
      console.error("Database insert error in log-scan:", error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to log GPS scan analytics:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
