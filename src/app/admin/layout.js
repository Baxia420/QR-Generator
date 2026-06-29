import Link from "next/link";

export default function AdminLayout({ children }) {
  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <div className="admin-nav-inner">
          <Link href="/admin" className="admin-nav-brand">
            <div className="admin-nav-logo">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="4" height="4" />
                <line x1="21" y1="14" x2="21" y2="21" />
                <line x1="14" y1="21" x2="21" y2="21" />
              </svg>
            </div>
            <span className="admin-nav-title">QR Center</span>
          </Link>
          <Link href="/admin" className="admin-nav-badge">
            Admin
          </Link>
        </div>
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
