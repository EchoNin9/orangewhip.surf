import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiGet, apiPost, ApiError } from '../../utils/api';
import { useAuth, hasRole } from '../../shell/AuthContext';
import type { Order } from './types';
import { CATALOG } from './catalog';
import { formatPrice } from './useCart';

const statusBadgeClass: Record<string, string> = {
  submitted: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
};

interface PrintFileStatus {
  product_id: string;
  s3_key: string;
  uploaded: boolean;
  last_modified: string | null;
}

function productTitle(productId: string): string {
  return CATALOG.find((p) => p.id === productId)?.title ?? productId;
}

/* Gelato print artwork: status list + presigned-PUT upload per product
   (same flow as the branding image uploads). */
function PrintArtworkSection() {
  const [files, setFiles] = useState<PrintFileStatus[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const refresh = async () => {
    try {
      setFiles(await apiGet<PrintFileStatus[]>('/store-print-files'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load print files.');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleUpload = async (productId: string, file: File) => {
    setBusy(productId);
    setError(null);
    try {
      const { uploadUrl } = await apiPost<{ uploadUrl: string; s3Key: string }>(
        '/store-print-files',
        { product_id: productId },
      );
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) throw new Error('Upload failed');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card p-5 mb-8">
      <h2 className="text-lg font-display font-bold text-secondary-100 mb-1">
        Print Artwork
      </h2>
      <p className="text-sm text-secondary-400 mb-4">
        The PNG files Gelato prints on each product. PNG, 300 DPI, sized for
        the product's print area — see docs/store-setup.md. Uploading replaces
        the previous file.
      </p>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}
      <ul className="divide-y divide-secondary-700/30">
        {files.map((f) => (
          <li key={f.product_id} className="flex items-center gap-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-secondary-100 truncate">{productTitle(f.product_id)}</p>
              <p className="text-xs text-secondary-500 font-mono truncate">{f.s3_key}</p>
            </div>
            {f.uploaded ? (
              <span className="text-xs text-emerald-400 whitespace-nowrap">
                ✓ uploaded{f.last_modified ? ` ${formatDate(f.last_modified)}` : ''}
              </span>
            ) : (
              <span className="text-xs text-amber-400 whitespace-nowrap">missing</span>
            )}
            <input
              ref={(el) => { inputs.current[f.product_id] = el; }}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(f.product_id, file);
                e.target.value = '';
              }}
            />
            <button
              className="btn-secondary text-xs px-3 py-1.5 whitespace-nowrap"
              disabled={busy !== null}
              onClick={() => inputs.current[f.product_id]?.click()}
            >
              {busy === f.product_id ? 'Uploading…' : f.uploaded ? 'Replace' : 'Upload'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminOrdersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Bounce non-admins to login (matches UsersPage pattern). */
  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !hasRole(user, 'admin')) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiGet<Order[]>('/orders');
        if (!cancelled) setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          /* The Lambda stub returns 501 until Chunk 3 lands; surface that
             cleanly instead of as a generic "failed to load". */
          if (err instanceof ApiError && err.status === 501) {
            setError('Orders API is not deployed yet. Comes online with Chunk 3.');
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load orders.');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !hasRole(user, 'admin')) {
    return (
      <main className="container-max section-padding text-center">
        <h1 className="text-2xl font-display font-bold text-secondary-100 mb-4">
          Access Denied
        </h1>
        <p className="text-secondary-400">
          Admin access required to view store orders.
        </p>
      </main>
    );
  }

  return (
    <main className="container-max section-padding">
      <motion.h1
        className="text-4xl font-display font-bold text-gradient mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Store
      </motion.h1>

      <PrintArtworkSection />

      <h2 className="text-2xl font-display font-bold text-secondary-100 mb-4">
        Orders
      </h2>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">
            dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-secondary-400 text-center py-16">
          No orders yet.
        </p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-secondary-700/50">
              <tr className="text-left text-xs uppercase tracking-wider text-secondary-500">
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold">Gelato Order</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-secondary-700/30">
              {orders.map((o) => (
                <tr key={o.stripe_session_id} className="hover:bg-secondary-800/30 transition-colors">
                  <td className="px-4 py-3 text-secondary-300 whitespace-nowrap">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="px-4 py-3 text-secondary-200 truncate max-w-[16rem]">
                    {o.email}
                  </td>
                  <td className="px-4 py-3 text-secondary-100 text-right tabular-nums">
                    {formatPrice(o.total_cents, o.currency)}
                  </td>
                  <td className="px-4 py-3 text-secondary-400 font-mono text-xs">
                    {o.gelato_order_id ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        statusBadgeClass[o.status] ??
                        'bg-secondary-600/30 text-secondary-400'
                      }`}
                      title={o.status_error ?? undefined}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
