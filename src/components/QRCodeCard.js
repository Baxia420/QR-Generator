"use client";

import { useRef, useCallback } from "react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";

export default function QRCodeCard({ shortCode, baseUrl, title }) {
  const canvasRef = useRef(null);
  const fullUrl = `${baseUrl}/r/${shortCode}`;

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `qr-${shortCode}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [shortCode]);

  return (
    <div className="qr-card">
      <div className="qr-card-header">
        <h3 className="qr-card-title">{title || shortCode}</h3>
        <p className="qr-card-url">{fullUrl}</p>
      </div>

      {/* Visible SVG for crisp rendering */}
      <div className="qr-code-container">
        <QRCodeSVG
          value={fullUrl}
          size={200}
          level="H"
          bgColor="#ffffff"
          fgColor="#000000"
          style={{ width: "100%", height: "auto", maxWidth: 200 }}
        />
      </div>

      {/* Hidden canvas for high-res PNG export */}
      <div ref={canvasRef} style={{ display: "none" }}>
        <QRCodeCanvas
          value={fullUrl}
          size={1024}
          level="H"
          bgColor="#ffffff"
          fgColor="#000000"
          marginSize={2}
        />
      </div>

      <button onClick={handleDownload} className="btn btn-secondary btn-sm">
        <Download size={14} />
        Download PNG
      </button>
    </div>
  );
}
