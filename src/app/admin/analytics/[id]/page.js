"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import QRCodeCard from "@/components/QRCodeCard";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  Download,
  Eye,
  Globe,
  HelpCircle,
  Laptop,
  Link2,
  ListFilter,
  Loader2,
  MapPin,
  RefreshCw,
  Share2,
  Smartphone,
  Tablet,
  TrendingUp,
  Users,
} from "lucide-react";

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params.id;

  const [link, setLink] = useState(null);
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering state (filter scans by a selected date/time from the chart)
  const [selectedTimeframe, setSelectedTimeframe] = useState(null);
  
  // Map reference for Leaflet
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [markersGroup, setMarkersGroup] = useState(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  // Load Leaflet dynamically on client mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load Leaflet CSS
    const linkElement = document.createElement("link");
    linkElement.rel = "stylesheet";
    linkElement.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(linkElement);

    // Load Leaflet JS
    const scriptElement = document.createElement("script");
    scriptElement.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    scriptElement.onload = () => {
      setLeafletLoaded(true);
    };
    document.head.appendChild(scriptElement);

    return () => {
      document.head.removeChild(linkElement);
      document.head.removeChild(scriptElement);
    };
  }, []);

  // Fetch link and scan data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch link info
      const { data: linkData, error: linkErr } = await supabase
        .from("qr_links")
        .select("*")
        .eq("id", linkId)
        .single();

      if (linkErr) throw linkErr;
      setLink(linkData);

      // 2. Fetch detailed scan analytics
      const { data: scanData, error: scanErr } = await supabase
        .from("scan_analytics")
        .select("*")
        .eq("link_id", linkId)
        .order("scanned_at", { ascending: false });

      if (scanErr) throw scanErr;
      setScans(scanData || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load analytics. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [linkId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Export CSV
  const handleExportCSV = useCallback(() => {
    if (!scans.length) return;
    
    const headers = [
      "Scan ID",
      "Timestamp",
      "Country",
      "City",
      "Latitude",
      "Longitude",
      "Device",
      "OS",
      "Browser",
      "Referrer",
      "User Agent"
    ];
    
    const rows = scans.map(s => [
      s.id,
      s.scanned_at,
      s.country || "Unknown",
      s.city || "Unknown",
      s.latitude || "",
      s.longitude || "",
      s.device_type || "Unknown",
      s.os || "Unknown",
      s.browser || "Unknown",
      s.referrer || "Direct",
      `"${(s.user_agent || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", encodedUri);
    downloadLink.setAttribute("download", `scans-${link?.short_code || "export"}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }, [scans, link]);

  // Compute stats based on selected timeframe filter (if active)
  const filteredScans = useMemo(() => {
    if (!selectedTimeframe) return scans;
    return scans.filter((scan) => {
      const scanDate = new Date(scan.scanned_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return scanDate === selectedTimeframe;
    });
  }, [scans, selectedTimeframe]);

  // KPI Calculations
  const metrics = useMemo(() => {
    const total = scans.length;
    if (total === 0) {
      return {
        totalScans: 0,
        uniqueVisitors: 0,
        peakHour: "N/A",
        lastScanTime: "Never",
      };
    }

    // Unique Visitors: group by Device Type + OS + Browser + Location + Day
    const uniqueFingerprints = new Set();
    scans.forEach((s) => {
      const dateStr = new Date(s.scanned_at).toDateString();
      const fingerprint = `${s.device_type}-${s.os}-${s.browser}-${s.country || ""}-${s.city || ""}-${dateStr}`;
      uniqueFingerprints.add(fingerprint);
    });

    // Peak Hour calculation
    const hourCounts = Array(24).fill(0);
    scans.forEach((s) => {
      const hr = new Date(s.scanned_at).getHours();
      hourCounts[hr]++;
    });
    const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
    const formatHour = (h) => {
      const ampm = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 || 12;
      return `${displayHour}:00 ${ampm}`;
    };

    // Last Scan Time
    const lastScan = scans[0] ? new Date(scans[0].scanned_at) : null;
    const timeDiff = lastScan ? Math.floor((Date.now() - lastScan) / 60000) : null; // in minutes
    let lastScanText = "Just now";
    if (timeDiff !== null) {
      if (timeDiff > 1440) {
        lastScanText = `${Math.floor(timeDiff / 1440)}d ago`;
      } else if (timeDiff > 60) {
        lastScanText = `${Math.floor(timeDiff / 60)}h ago`;
      } else if (timeDiff > 0) {
        lastScanText = `${timeDiff}m ago`;
      }
    }

    return {
      totalScans: total,
      uniqueVisitors: uniqueFingerprints.size,
      peakHour: formatHour(maxHour),
      lastScanTime: lastScanText,
    };
  }, [scans]);

  // Breakdown Aggregation helper
  const computeBreakdown = (key, limit = 5) => {
    const counts = {};
    filteredScans.forEach((scan) => {
      const val = scan[key] || "Unknown";
      counts[val] = (counts[val] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / filteredScans.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  };

  const deviceBreakdown = useMemo(() => computeBreakdown("device_type"), [filteredScans]);
  const osBreakdown = useMemo(() => computeBreakdown("os"), [filteredScans]);
  const browserBreakdown = useMemo(() => computeBreakdown("browser"), [filteredScans]);
  const locationBreakdown = useMemo(() => {
    const counts = {};
    filteredScans.forEach((s) => {
      if (s.country || s.city) {
        const place = s.city && s.country ? `${s.city}, ${s.country}` : s.country || s.city;
        counts[place] = (counts[place] || 0) + 1;
      } else {
        counts["Unknown Location"] = (counts["Unknown Location"] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / filteredScans.length) * 100).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredScans]);

  const referrerBreakdown = useMemo(() => {
    const counts = {};
    filteredScans.forEach((s) => {
      let ref = "Direct / Camera Scan";
      if (s.referrer) {
        try {
          ref = new URL(s.referrer).hostname;
        } catch {
          ref = s.referrer;
        }
      }
      counts[ref] = (counts[ref] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredScans]);

  // Chart Data Preparation (last 7 days of scan activity)
  const chartData = useMemo(() => {
    const dates = {};
    // Seed last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dates[label] = 0;
    }

    scans.forEach((scan) => {
      const label = new Date(scan.scanned_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (dates[label] !== undefined) {
        dates[label]++;
      }
    });

    return Object.entries(dates).map(([date, count]) => ({ date, count }));
  }, [scans]);

  // Render responsive SVG Path for the Line Chart
  const svgChart = useMemo(() => {
    const maxVal = Math.max(...chartData.map((d) => d.count), 5); // scale height based on max scans, min height of 5
    const width = 500;
    const height = 150;
    const padding = 20;

    const points = chartData.map((d, index) => {
      const x = padding + (index * (width - padding * 2)) / (chartData.length - 1);
      const y = height - padding - (d.count * (height - padding * 2)) / maxVal;
      return { x, y, ...d };
    });

    // Create bezier curve line string
    let pathD = "";
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const cpX1 = (points[i].x + points[i + 1].x) / 2;
        const cpY1 = points[i].y;
        const cpX2 = (points[i].x + points[i + 1].x) / 2;
        const cpY2 = points[i + 1].y;
        pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${points[i + 1].x} ${points[i + 1].y}`;
      }
    }

    // Create fading filled background path underneath the line
    const areaD = pathD
      ? `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${
          height - padding
        } Z`
      : "";

    return { points, pathD, areaD, width, height, padding, maxVal };
  }, [chartData]);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!leafletLoaded || typeof window === "undefined" || !window.L || loading || !link) return;

    // Filter scans with coordinate data
    const scansWithCoords = filteredScans.filter((s) => s.latitude && s.longitude);

    // Initial map setup
    let map = mapInstance;
    let markers = markersGroup;

    if (!map) {
      // Default to Kuala Lumpur coordinates [3.1390, 101.6869] if there are no coordinates, or center of the data points
      const defaultCenter = [3.1390, 101.6869];
      let center = defaultCenter;

      if (scansWithCoords.length > 0) {
        const sumLat = scansWithCoords.reduce((sum, s) => sum + Number(s.latitude), 0);
        const sumLon = scansWithCoords.reduce((sum, s) => sum + Number(s.longitude), 0);
        center = [sumLat / scansWithCoords.length, sumLon / scansWithCoords.length];
      }

      map = window.L.map("analytics-map", {
        center: center,
        zoom: scansWithCoords.length > 0 ? 12 : 5,
        zoomControl: false,
      });

      window.L.control.zoom({ position: "bottomright" }).addTo(map);

      window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      markers = window.L.layerGroup().addTo(map);

      setMapInstance(map);
      setMarkersGroup(markers);
    } else {
      // Clear existing markers to draw new ones
      markers.clearLayers();
    }

    // Add markers for each scan location
    if (scansWithCoords.length > 0) {
      const bounds = [];
      
      // Group markers by identical coordinates to prevent stacking
      const coordGroups = {};
      scansWithCoords.forEach((s) => {
        const key = `${s.latitude}_${s.longitude}`;
        if (!coordGroups[key]) coordGroups[key] = [];
        coordGroups[key].push(s);
      });

      Object.entries(coordGroups).forEach(([key, items]) => {
        const [lat, lon] = key.split("_").map(Number);
        bounds.push([lat, lon]);

        const count = items.length;
        const details = items.map(s => {
          const time = new Date(s.scanned_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
          return `${time} (${s.device_type} - ${s.os})`;
        }).slice(0, 3).join("<br/>");

        const displayDetails = items.length > 3 ? `${details}<br/>+ ${items.length - 3} more` : details;

        // Custom pulsing dot marker
        const iconHtml = `
          <div class="marker-pulse-wrapper">
            <div class="marker-pulse-core"></div>
            <div class="marker-pulse-wave"></div>
            ${count > 1 ? `<span class="marker-count">${count}</span>` : ""}
          </div>
        `;

        const customIcon = window.L.divIcon({
          html: iconHtml,
          className: "custom-leaflet-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        window.L.marker([lat, lon], { icon: customIcon })
          .addTo(markers)
          .bindPopup(
            `<div class="map-popup">
              <strong>${items[0].city || "Kuala Lumpur"}, ${items[0].country || "MY"}</strong>
              <div class="map-popup-scans">${count} scan${count > 1 ? "s" : ""}</div>
              <div class="map-popup-list">${displayDetails}</div>
            </div>`
          );
      });

      // Fit map view bounds
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }

  }, [leafletLoaded, filteredScans, loading, link]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <Loader2 size={32} className="spin" />
        <span>Analyzing QR Code activity...</span>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="analytics-error">
        <div className="card text-center p-8 max-w-md mx-auto mt-12">
          <p className="text-danger mb-4 font-semibold">{error || "Link not found"}</p>
          <button onClick={() => router.push("/admin")} className="btn btn-primary">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Top Controls */}
      <div className="analytics-toolbar">
        <button onClick={() => router.push("/admin")} className="btn btn-secondary btn-sm">
          <ArrowLeft size={14} /> Dashboard
        </button>
        <div className="toolbar-actions">
          <button onClick={fetchData} className="btn btn-secondary btn-sm" title="Refresh Data">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            disabled={!scans.length}
            className="btn btn-primary btn-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="card link-info-card">
        <div className="info-main">
          <div>
            <div className="info-title-row">
              <h2>{link.title || <span className="text-muted">Untitled Link</span>}</h2>
              <span className="code-badge">/r/{link.short_code}</span>
            </div>
            <p className="destination-text">
              <span className="text-muted">Redirects to: </span>
              <a href={link.destination_url} target="_blank" rel="noopener noreferrer">
                {link.destination_url}
              </a>
            </p>
          </div>
          <div className="info-secondary">
            <QRCodeCard shortCode={link.short_code} baseUrl={baseUrl} title={link.title} />
          </div>
        </div>
      </div>

      {/* KPIs Grid */}
      <div className="analytics-kpis">
        <div className="kpi-card">
          <div className="kpi-icon"><TrendingUp size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">Total Scans</span>
            <h3 className="kpi-value">{metrics.totalScans}</h3>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Users size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">Unique Scanners</span>
            <h3 className="kpi-value">{metrics.uniqueVisitors}</h3>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Clock size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">Busiest Hour</span>
            <h3 className="kpi-value">{metrics.peakHour}</h3>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Calendar size={20} /></div>
          <div className="kpi-content">
            <span className="kpi-label">Last Scanned</span>
            <h3 className="kpi-value">{metrics.lastScanTime}</h3>
          </div>
        </div>
      </div>

      {/* Main Grid: Map & Clickable SVG Chart */}
      <div className="analytics-main-grid">
        {/* Clickable Line Chart Card */}
        <div className="card chart-card">
          <div className="card-header-actions">
            <div className="card-header">
              <TrendingUp size={18} />
              <h2>Scans Over Time (Last 7 Days)</h2>
            </div>
            {selectedTimeframe && (
              <button
                onClick={() => setSelectedTimeframe(null)}
                className="btn btn-secondary btn-sm"
              >
                <ListFilter size={12} /> Clear Filter ({selectedTimeframe})
              </button>
            )}
          </div>
          
          <div className="svg-chart-container">
            <svg viewBox={`0 0 ${svgChart.width} ${svgChart.height}`} className="svg-chart">
              <defs>
                <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={svgChart.padding}
                y1={svgChart.height / 2}
                x2={svgChart.width - svgChart.padding}
                y2={svgChart.height / 2}
                stroke="#1e1e35"
                strokeDasharray="4"
              />
              <line
                x1={svgChart.padding}
                y1={svgChart.height - svgChart.padding}
                x2={svgChart.width - svgChart.padding}
                y2={svgChart.height - svgChart.padding}
                stroke="#1e1e35"
              />

              {/* Filled Glow Area */}
              {svgChart.areaD && (
                <path d={svgChart.areaD} fill="url(#chart-glow)" />
              )}

              {/* The Line */}
              {svgChart.pathD && (
                <path
                  d={svgChart.pathD}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              )}

              {/* Clickable Dots */}
              {svgChart.points.map((pt, i) => {
                const isSelected = selectedTimeframe === pt.date;
                return (
                  <g key={i} className="chart-dot-group">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 7 : 4}
                      className={`chart-dot ${isSelected ? "chart-dot-selected" : ""}`}
                      onClick={() =>
                        setSelectedTimeframe(selectedTimeframe === pt.date ? null : pt.date)
                      }
                    />
                    {/* Tooltip Overlay */}
                    <text
                      x={pt.x}
                      y={pt.y - 12}
                      textAnchor="middle"
                      className="chart-tooltip"
                    >
                      {pt.count}
                    </text>
                    {/* X Axis Labels */}
                    <text
                      x={pt.x}
                      y={svgChart.height - 4}
                      textAnchor="middle"
                      className="chart-axis-label"
                    >
                      {pt.date}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="chart-instruction text-center text-muted">
            💡 Click on any dot to filter the map, device, and location analytics by that day.
          </p>
        </div>

        {/* Map Card */}
        <div className="card map-card-wrapper">
          <div className="card-header">
            <Compass size={18} />
            <h2>Interactive Scanning Map</h2>
          </div>
          <div id="analytics-map" className="analytics-map-container">
            {!leafletLoaded && (
              <div className="map-placeholder">
                <Loader2 size={24} className="spin" />
                <span>Loading map engine...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Geo & Tech Breakdowns */}
      <div className="analytics-details-grid">
        {/* Locations */}
        <div className="card">
          <div className="card-header">
            <MapPin size={18} />
            <h2>Top Locations</h2>
          </div>
          <div className="breakdown-list">
            {locationBreakdown.length === 0 ? (
              <div className="text-muted p-4 text-center">No location data captured.</div>
            ) : (
              locationBreakdown.map((item, index) => (
                <div key={index} className="breakdown-row">
                  <div className="breakdown-info">
                    <span className="breakdown-rank">#{index + 1}</span>
                    <span className="breakdown-name">{item.name}</span>
                  </div>
                  <div className="breakdown-bar-wrapper">
                    <div className="breakdown-bar" style={{ width: `${item.percentage}%` }}></div>
                    <span className="breakdown-value">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Devices & Browsers */}
        <div className="card">
          <div className="card-header">
            <Laptop size={18} />
            <h2>Devices & Tech stack</h2>
          </div>
          
          <div className="tech-section">
            <h3>Device Type</h3>
            <div className="tech-bar-grid">
              {deviceBreakdown.map((device, idx) => (
                <div key={idx} className="tech-bar-item">
                  <div className="tech-bar-label">
                    <span>
                      {device.name === "Mobile" ? (
                        <Smartphone size={12} className="inline mr-1" />
                      ) : device.name === "Tablet" ? (
                        <Tablet size={12} className="inline mr-1" />
                      ) : (
                        <Laptop size={12} className="inline mr-1" />
                      )}
                      {device.name}
                    </span>
                    <span>{device.percentage}%</span>
                  </div>
                  <div className="tech-bar-track">
                    <div className="tech-bar-fill" style={{ width: `${device.percentage}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tech-section mt-6">
            <h3>Operating System</h3>
            <div className="tech-pill-grid">
              {osBreakdown.map((os, idx) => (
                <div key={idx} className="tech-pill-item">
                  <span className="pill-name">{os.name}</span>
                  <span className="pill-count">{os.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Referrers */}
        <div className="card">
          <div className="card-header">
            <Globe size={18} />
            <h2>Referral Sources</h2>
          </div>
          <div className="referrer-list">
            {referrerBreakdown.map((ref, idx) => (
              <div key={idx} className="referrer-row">
                <span className="referrer-name">{ref.name}</span>
                <span className="scan-badge">{ref.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Individual Scan Logs */}
      <div className="card">
        <div className="card-header">
          <Share2 size={18} />
          <h2>Raw Scan Logs ({filteredScans.length})</h2>
        </div>
        <div className="table-wrapper">
          <table className="links-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Location</th>
                <th>Device</th>
                <th>OS</th>
                <th>Browser</th>
                <th>Referrer</th>
              </tr>
            </thead>
            <tbody>
              {filteredScans.slice(0, 20).map((scan) => (
                <tr key={scan.id}>
                  <td className="cell-date">
                    {new Date(scan.scanned_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {scan.city || scan.country ? (
                      <span className="location-cell">
                        {scan.city && `${scan.city}, `}
                        {scan.country || "MY"}
                        {scan.latitude && (
                          <span className="text-muted text-xs block">
                            {Number(scan.latitude).toFixed(4)}, {Number(scan.longitude).toFixed(4)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted">Unknown</span>
                    )}
                  </td>
                  <td>{scan.device_type || "Desktop"}</td>
                  <td>{scan.os || "Unknown"}</td>
                  <td>{scan.browser || "Unknown"}</td>
                  <td className="cell-destination">
                    {scan.referrer ? (
                      <a href={scan.referrer} target="_blank" rel="noopener noreferrer" className="destination-link">
                        {scan.referrer.length > 30 ? scan.referrer.substring(0, 30) + "..." : scan.referrer}
                      </a>
                    ) : (
                      <span className="text-muted">Direct Scan</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredScans.length > 20 && (
            <p className="text-center text-muted text-xs mt-4">
              Showing latest 20 scans. Export to CSV to see all {filteredScans.length} records.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
