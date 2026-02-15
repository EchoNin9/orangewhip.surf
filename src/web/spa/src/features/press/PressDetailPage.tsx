import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  DocumentArrowDownIcon,
  LinkIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { apiGet } from "../../utils/api";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface FileAttachment {
  id: string;
  filename: string;
  url: string;
}

interface ExternalLink {
  url: string;
  label: string;
}

interface PressCard {
  id: string;
  title: string;
  description: string;
  public: boolean;
  pinned: boolean;
  createdAt: string;
  attachments: FileAttachment[];
  links: ExternalLink[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ------------------------------------------------------------------ */
/*  Copy link button                                                  */
/* ------------------------------------------------------------------ */

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary-800 hover:bg-secondary-700 text-secondary-200 hover:text-primary-400 transition-colors text-sm font-medium"
      title="Copy link to clipboard"
    >
      {copied ? (
        <>
          <CheckIcon className="w-4 h-4 text-green-400" />
          Copied!
        </>
      ) : (
        <>
          <LinkIcon className="w-4 h-4" />
          Copy link
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function PressDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<PressCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiGet<PressCard>(`/press?id=${id}`)
      .then((data) => {
        if (!data) {
          setError("Press item not found");
          return;
        }
        const normalised = {
          ...data,
          attachments:
            data.attachments ??
            (data as { fileAttachments?: FileAttachment[] }).fileAttachments ??
            [],
          links: data.links ?? [],
        };
        setCard(normalised);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container-max section-padding text-center">
        <div className="inline-block w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="container-max section-padding text-center">
        <p className="text-red-400 mb-4">
          {error ?? "Press item not found"}
        </p>
        <Link
          to="/press"
          className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Press
        </Link>
      </div>
    );
  }

  return (
    <main className="container-max section-padding">
      {/* Back + Copy link bar */}
      <motion.div
        className="flex items-center justify-between gap-4 mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          to="/press"
          className="inline-flex items-center gap-2 text-secondary-400 hover:text-primary-400 transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Press
        </Link>
        <CopyLinkButton />
      </motion.div>

      {/* Card content */}
      <motion.article
        className={`card p-6 sm:p-8 ${
          card.pinned
            ? "border-primary-500/40 ring-1 ring-primary-500/20"
            : ""
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex items-center gap-2 mb-2">
          {card.pinned && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary-500/20 text-primary-400 px-2 py-0.5 rounded">
              Featured
            </span>
          )}
          <span className="text-xs text-secondary-500">
            {formatDate(card.createdAt)}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-display font-bold text-secondary-100 mb-4">
          {card.title}
        </h1>

        <p className="text-secondary-400 whitespace-pre-wrap mb-6">
          {card.description}
        </p>

        {/* Attachments */}
        {(card.attachments ?? []).length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary-500 mb-2">
              Downloads
            </h4>
            <div className="flex flex-wrap gap-2">
              {(card.attachments ?? []).map((att) => (
                <a
                  key={att.id}
                  href={att.url}
                  download={att.filename}
                  className="inline-flex items-center gap-1.5 text-sm bg-secondary-800 hover:bg-secondary-700 text-secondary-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 text-primary-400" />
                  {att.filename}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* External links */}
        {(card.links ?? []).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-secondary-500 mb-2">
              Links
            </h4>
            <div className="flex flex-wrap gap-2">
              {(card.links ?? []).map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  {link.label || link.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </motion.article>
    </main>
  );
}
