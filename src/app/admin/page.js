"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import QRCodeCard from "@/components/QRCodeCard";
import {
  Plus,
  Link2,
  BarChart3,
  Pencil,
  Trash2,
  QrCode,
  X,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Compass,
  HelpCircle,
} from "lucide-react";

// Generate a random 6-character alphanumeric short code
function generateShortCode(length = 6) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (const val of values) {
    result += chars[val % chars.length];
  }
  return result;
}

export default function AdminPage() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editUrl, setEditUrl] = useState("");
  const [showQR, setShowQR] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [formRequireGps, setFormRequireGps] = useState(false);
  const [editRequireGps, setEditRequireGps] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Base URL for QR codes — falls back to current origin if not set
  const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const baseUrl =
    configuredBaseUrl ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const isLocalhost = mounted && (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"));

  // Fetch all links with scan counts (efficient grouped query)
  const fetchLinks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch links with scan count via Supabase's embedded count
      const { data: linksData, error: linksError } = await supabase
        .from("qr_links")
        .select("*, scan_analytics(count)")
        .order("created_at", { ascending: false });

      if (linksError) throw linksError;

      const enrichedLinks = (linksData || []).map((link) => ({
        ...link,
        scan_count: link.scan_analytics?.[0]?.count || 0,
      }));

      setLinks(enrichedLinks);
    } catch (err) {
      setError("Failed to fetch links. Check your Supabase connection.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "scan_analytics",
        },
        (payload) => {
          const newScan = payload.new;
          setLinks((prevLinks) =>
            prevLinks.map((link) => {
              if (link.id === newScan.link_id) {
                return { ...link, scan_count: (link.scan_count || 0) + 1 };
              }
              return link;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Create a new link with collision-safe short code generation
  async function handleCreate(e) {
    e.preventDefault();
    if (!formUrl.trim() || !formTitle.trim()) return;

    setCreating(true);
    setError(null);

    const maxRetries = 5;
    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      const shortCode = generateShortCode();
      attempts++;

      const { error: insertError } = await supabase.from("qr_links").insert({
        short_code: shortCode,
        destination_url: formUrl.trim(),
        title: formTitle.trim() || null,
        require_gps: formRequireGps,
      });

      if (!insertError) {
        success = true;
        setFormUrl("");
        setFormTitle("");
        setFormRequireGps(false);
        await fetchLinks();
      } else if (insertError.code === "23505") {
        // Unique constraint violation — retry with a new code
        if (attempts >= maxRetries) {
          setError(
            "Failed to generate a unique short code after multiple attempts. Please try again."
          );
        }
      } else {
        setError(`Failed to create link: ${insertError.message}`);
        break;
      }
    }

    setCreating(false);
  }

  // Update destination URL
  async function handleUpdate(id) {
    if (!editUrl.trim()) return;

    const { error: updateError } = await supabase
      .from("qr_links")
      .update({ 
        destination_url: editUrl.trim(),
        require_gps: editRequireGps,
      })
      .eq("id", id);

    if (updateError) {
      setError(`Failed to update: ${updateError.message}`);
    } else {
      setEditingId(null);
      setEditUrl("");
      await fetchLinks();
    }
  }

  // Delete a link
  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Delete this link? All associated scan analytics will also be removed."
    );
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from("qr_links")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(`Failed to delete: ${deleteError.message}`);
    } else {
      if (showQR === id) setShowQR(null);
      await fetchLinks();
    }
  }

  // Copy short URL to clipboard
  async function handleCopy(shortCode, id) {
    await navigator.clipboard.writeText(`${baseUrl}/r/${shortCode}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="admin-container">
      {/* Localhost Warning */}
      {isLocalhost && (
        <div className="warning-banner">
          <AlertTriangle size={16} />
          <span>
            QR codes are pointing to <strong>{baseUrl}</strong> which won't work
            on other devices. Set <code>NEXT_PUBLIC_BASE_URL</code> in your{" "}
            <code>.env.local</code> to your Vercel deployment URL before
            generating production QR codes.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="admin-header">
        <div>
          <h1 className="admin-title">Dynamic Links</h1>
          <p className="admin-subtitle">
            Create QR codes that redirect to any URL.
          </p>
        </div>
        <div className="admin-stats">
          <div className="stat-card">
            <Link2 size={18} />
            <div>
              <span className="stat-value">{links.length}</span>
              <span className="stat-label">Total Links</span>
            </div>
          </div>
          <div className="stat-card">
            <BarChart3 size={18} />
            <div>
              <span className="stat-value">
                {links.reduce((sum, l) => sum + l.scan_count, 0)}
              </span>
              <span className="stat-label">Total Scans</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Create Form */}
      <div className="card create-card">
        <div className="card-header">
          <Plus size={18} />
          <h2>Create New Link</h2>
        </div>
        <form onSubmit={handleCreate} className="create-form">
          <div className="form-row">
            <div className="form-group form-group-grow">
              <label htmlFor="destination-url">Destination URL</label>
              <input
                id="destination-url"
                type="url"
                placeholder="https://example.com/your-long-url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                required
                className="input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="link-title">Title</label>
              <input
                id="link-title"
                type="text"
                placeholder="e.g. Summer Event 2026"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="input"
              />
            </div>
          </div>
          
          <div className="form-group-checkbox">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formRequireGps}
                onChange={(e) => setFormRequireGps(e.target.checked)}
              />
              <span>Request Precise Location (GPS)</span>
            </label>
            <div className="tooltip-container">
              <HelpCircle size={14} className="tooltip-trigger" />
              <div className="tooltip-content">
                Asks scanners to share their precise GPS location. If disabled, location is estimated using their IP.
              </div>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={creating || !formUrl.trim() || !formTitle.trim()}
            className="btn btn-primary"
          >
            {creating ? (
              <>
                <Loader2 size={16} className="spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Link
              </>
            )}
          </button>
        </form>
      </div>

      {/* Links Table */}
      <div className="card">
        <div className="card-header">
          <QrCode size={18} />
          <h2>Your Links</h2>
        </div>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={24} className="spin" />
            <span>Loading links...</span>
          </div>
        ) : links.length === 0 ? (
          <div className="empty-state">
            <QrCode size={48} strokeWidth={1} />
            <p>No links yet. Create your first dynamic QR code above.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="links-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Short URL</th>
                  <th>Destination</th>
                  <th>Scans</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id}>
                    <td className="cell-title">
                      <div className="title-cell-wrapper">
                        {link.title || (
                          <span className="text-muted">Untitled</span>
                        )}
                        {link.require_gps && (
                          <span className="gps-badge" title="Precise GPS location active">
                            <Compass size={12} />
                            GPS
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="short-url-cell">
                        <code className="short-code">/r/{link.short_code}</code>
                        <button
                          onClick={() => handleCopy(link.short_code, link.id)}
                          className="btn-icon"
                          title="Copy short URL"
                        >
                          {copiedId === link.id ? (
                            <Check size={14} className="text-success" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="cell-destination">
                      {editingId === link.id ? (
                        <div className="edit-inline">
                          <input
                            type="url"
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            className="input input-sm"
                            autoFocus
                          />
                          <div className="edit-inline-gps">
                            <label className="checkbox-label-sm">
                              <input
                                type="checkbox"
                                checked={editRequireGps}
                                onChange={(e) => setEditRequireGps(e.target.checked)}
                              />
                              GPS
                            </label>
                          </div>
                          <button
                            onClick={() => handleUpdate(link.id)}
                            className="btn btn-primary btn-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn btn-ghost btn-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <a
                          href={link.destination_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="destination-link"
                        >
                          {link.destination_url.length > 50
                            ? link.destination_url.substring(0, 50) + "..."
                            : link.destination_url}
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                    <td>
                      <span className="scan-badge">{link.scan_count}</span>
                    </td>
                    <td className="cell-date">
                      {new Date(link.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => {
                            setShowQR(showQR === link.id ? null : link.id);
                          }}
                          className={`btn-icon ${
                            showQR === link.id ? "btn-icon-active" : ""
                          }`}
                          title="Show QR Code"
                        >
                          <QrCode size={16} />
                        </button>
                        <Link
                          href={`/admin/analytics/${link.id}`}
                          className="btn-icon"
                          title="View Analytics"
                        >
                          <BarChart3 size={16} />
                        </Link>
                        <button
                          onClick={() => {
                            setEditingId(link.id);
                            setEditUrl(link.destination_url);
                            setEditRequireGps(link.require_gps || false);
                          }}
                          className="btn-icon"
                          title="Edit destination"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(link.id)}
                          className="btn-icon btn-icon-danger"
                          title="Delete link"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="qr-modal-overlay" onClick={() => setShowQR(null)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowQR(null)}
              className="qr-modal-close"
            >
              <X size={20} />
            </button>
            <QRCodeCard
              shortCode={links.find((l) => l.id === showQR)?.short_code}
              baseUrl={baseUrl}
              title={links.find((l) => l.id === showQR)?.title}
            />
          </div>
        </div>
      )}
    </div>
  );
}
