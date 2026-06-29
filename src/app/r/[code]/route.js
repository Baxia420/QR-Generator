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

  // Look up the short code and get require_gps setting
  const { data, error } = await supabase
    .from("qr_links")
    .select("id, destination_url, title, require_gps")
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

  const destinationUrl = data.destination_url;
  const linkId = data.id;
  const linkTitle = data.title || "the requested event";

  // Case 1: Precise GPS location is required
  if (data.require_gps) {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Location Verification Required</title>
        <style>
          :root {
            --bg-primary: #07070d;
            --bg-card: #12121e;
            --border-color: #1e1e35;
            --text-primary: #f0f0f5;
            --text-secondary: #8888a8;
            --accent: #6c5ce7;
            --accent-hover: #7c6ef7;
            --radius: 16px;
            --text-muted: #555575;
          }
          body {
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .modal-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            padding: 32px 24px;
            text-align: center;
            max-width: 380px;
            width: 90%;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          }
          .icon-container {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: rgba(108, 92, 231, 0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            color: var(--accent);
          }
          .icon-container svg {
            width: 24px;
            height: 24px;
            fill: none;
            stroke: currentColor;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 10px; }
          p { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5; margin: 0 0 24px; }
          .button-group { display: flex; flex-direction: column; gap: 10px; }
          .btn {
            padding: 14px 20px; font-size: 0.9rem; font-weight: 600; border-radius: 8px; border: none;
            cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
            gap: 8px; width: 100%;
          }
          .btn-primary {
            background: linear-gradient(135deg, #6c5ce7 0%, #a855f7 100%);
            color: white;
            box-shadow: 0 2px 10px rgba(108, 92, 231, 0.2);
          }
          .btn-primary:hover:not(:disabled) {
            box-shadow: 0 4px 18px rgba(108, 92, 231, 0.35);
            transform: translateY(-1px);
          }
          .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
          .loader {
            width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.2);
            border-left-color: white; border-radius: 50%; animation: spin 0.8s linear infinite;
            display: none;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .status-message { font-size: 0.8rem; color: var(--text-secondary); margin-top: 16px; line-height: 1.4; }
          .status-message strong { color: var(--accent); }
          .error-state {
            color: #ff7675;
            background: rgba(255, 118, 117, 0.1);
            border: 1px solid rgba(255, 118, 117, 0.2);
            border-radius: 8px;
            padding: 12px;
            margin-top: 16px;
            font-size: 0.8rem;
            text-align: left;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="modal-card">
          <div class="icon-container">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
            </svg>
          </div>
          <h1>Location Verification Required</h1>
          <p>
            To complete check-in, we need to verify that you are physically present at <strong>${linkTitle}</strong>.
          </p>
          <div class="button-group">
            <button onclick="requestLocation()" id="btn-share" class="btn btn-primary">
              <div class="loader" id="share-loader"></div>
              <span>Verify Location & Proceed</span>
            </button>
          </div>
          <div id="countdown-status" class="status-message">
            Precision GPS verification is mandatory to access this link.
          </div>
        </div>

        <script>
          const dest = "${destinationUrl}";
          const linkId = "${linkId}";
          const scannerId = "${scannerId}";
          const referrer = document.referrer || "";
          
          let redirected = false;
          const statusText = document.getElementById("countdown-status");

          function proceed(lat = null, lon = null) {
            if (redirected) return;
            redirected = true;
            
            if (statusText) {
              statusText.innerHTML = "Redirecting...";
            }

             fetch('/api/log-scan', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               keepalive: true,
               body: JSON.stringify({
                 linkId: linkId,
                 latitude: lat,
                 longitude: lon,
                 userAgent: navigator.userAgent,
                 referrer: referrer,
                 scannerId: scannerId
               })
             }).then(() => {
               window.location.href = dest;
             }).catch(err => {
               console.error("Error logging scan:", err);
               window.location.href = dest;
             });
          }

          function requestLocation() {
            const loader = document.getElementById("share-loader");
            const btn = document.getElementById("btn-share");
            loader.style.display = "block";
            btn.disabled = true;

            if (statusText) {
              statusText.innerHTML = "Verifying location... please check your browser permission prompt.";
            }

            if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  proceed(pos.coords.latitude, pos.coords.longitude);
                },
                (err) => {
                  console.warn("Location permission denied", err);
                  loader.style.display = "none";
                  btn.disabled = false;
                  
                  if (statusText) {
                    statusText.innerHTML = \`
                      <div class="error-state">
                        <strong style="display: block; margin-bottom: 4px;">Location Access Required</strong>
                        Verification is mandatory to check-in. Please allow location access for this site in your browser settings and try again.
                      </div>
                    \`;
                  }
                },
                { timeout: 8000, enableHighAccuracy: true }
              );
            } else {
              loader.style.display = "none";
              btn.disabled = false;
              if (statusText) {
                statusText.innerHTML = \`
                  <div class="error-state">
                    <strong>Unsupported Browser</strong><br>
                    Your browser does not support geolocation. Verification is mandatory to proceed.
                  </div>
                \`;
              }
            }
          }
        </script>
      </body>
      </html>
    `;

    const response = new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });

    if (isNewScanner) {
      response.cookies.set("qr_scanner_id", scannerId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    return response;
  }

  // Case 2: Standard redirect with styled bridge page
  const country = request.headers.get("x-vercel-ip-country") || null;
  let city = request.headers.get("x-vercel-ip-city") || null;
  if (city) {
    try {
      city = decodeURIComponent(city);
    } catch {}
  }
  const latitude = request.headers.get("x-vercel-ip-latitude") || null;
  const longitude = request.headers.get("x-vercel-ip-longitude") || null;
  const referrer = request.headers.get("referer") || null;
  const userAgent = request.headers.get("user-agent") || null;

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
      console.error("Failed to log standard scan analytics:", err);
    }
  });

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Redirecting...</title>
      <style>
        :root {
          --bg-primary: #07070d;
          --bg-card: #12121e;
          --border-color: #1e1e35;
          --text-primary: #f0f0f5;
          --text-secondary: #8888a8;
          --accent: #6c5ce7;
          --radius: 16px;
        }
        body {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .modal-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius);
          padding: 32px 24px;
          text-align: center;
          max-width: 320px;
          width: 90%;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .loader {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(108, 92, 231, 0.15);
          border-left-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        h1 {
          font-size: 1.15rem;
          font-weight: 600;
          margin: 0 0 8px;
          color: var(--text-primary);
        }
        p {
          font-size: 0.82rem;
          color: var(--text-secondary);
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="modal-card">
        <div class="loader"></div>
        <h1>Redirecting you...</h1>
        <p>Connecting to <strong>${linkTitle}</strong></p>
      </div>
      <script>
        setTimeout(() => {
          window.location.href = "${destinationUrl}";
        }, 300);
      </script>
    </body>
    </html>
  `;

  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

  if (isNewScanner) {
    response.cookies.set("qr_scanner_id", scannerId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  return response;
}
