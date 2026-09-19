"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Eye,
  LogOut,
  RefreshCw,
  ShieldAlert,
  UploadCloud,
  X,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { ReviewItem, ReviewQueue } from "@/lib/moderation/admin-types";

const label = (value: string) => value.replaceAll("_", " ");
const date = (value: number) => new Date(value).toLocaleString();
async function body(response: Response) {
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.message || "The request could not be completed.");
  return result;
}
export function ReviewDashboard({ role }: { role: "admin" | "reviewer" }) {
  const router = useRouter();
  const [filter, setFilter] = useState("manual_review");
  const [page, setPage] = useState(0);
  const pending = useRef<AbortController|null>(null);
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller=new AbortController();pending.current=controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/moderation?status=${filter}&page=${page}`, {
        cache: "no-store",signal:controller.signal,
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data=await body(response);if(controller.signal.aborted)return;
      setQueue(data);
      setError("");
    } catch (err) {
      if(controller.signal.aborted)return;
      setError(
        err instanceof Error ? err.message : "Review queue unavailable.",
      );
    } finally {
      if(!controller.signal.aborted)setLoading(false);
    }
  }, [filter, page, router]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => {clearTimeout(timer);pending.current?.abort();};
  }, [refresh]);
  async function logout() {
    try {
      await body(await fetch("/api/admin/logout", { method: "POST" }));
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Sign out could not complete. Please try again.");
    }
  }
  const item = queue?.items.find((row) => row.id === selected);
  const count = (status: string) =>
    queue?.metrics.counts.find((row) => row.status === status)?.count || 0;
  const total =
    queue?.metrics.counts.reduce((sum, row) => sum + row.count, 0) || 0;
  return (
    <section className="container admin-page">
      <header className="admin-heading">
        <div>
          <span className="micro blue">PanoVision / Internal</span>
          <h1>Creative review</h1>
        </div>
        <button className="button button-outline" onClick={logout}>
          <LogOut size={16} />
          Sign out
        </button>
      </header>
      <dl className="admin-metrics">
        <div>
          <dt>Uploads</dt>
          <dd>{total}</dd>
        </div>
        <div>
          <dt>Approved</dt>
          <dd>
            {count("approved")}
            <small>
              {total ? Math.round((count("approved") / total) * 100) : 0}%
            </small>
          </dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd>{count("rejected")}</dd>
          <p className="small muted">{queue?.metrics.rejectionKinds.find(row=>row.kind==="technical")?.count||0} technical / {queue?.metrics.rejectionKinds.find(row=>row.kind==="content")?.count||0} content</p>
        </div>
        <div>
          <dt>Under review</dt>
          <dd>{count("manual_review")}</dd>
        </div>
        <div>
          <dt>Check errors</dt>
          <dd>{queue?.metrics.failures.count || 0}</dd>
        </div>
        <div>
          <dt>Average check</dt>
          <dd>
            {queue?.metrics.averageProcessingMs.milliseconds
              ? `${Math.round(queue.metrics.averageProcessingMs.milliseconds / 1000)}s`
              : "--"}
          </dd>
        </div>
      </dl>
      <div className="admin-toolbar">
        <div className="field">
          <label htmlFor="queue-filter">Queue</label>
          <select
            id="queue-filter"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setPage(0);
              setSelected("");
            }}
          >
            {[
              "manual_review",
              "processing",
              "uploaded",
              "approved",
              "rejected",
              "failed",
              "all",
            ].map((value) => (
              <option value={value} key={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
        <button
          className="icon-button"
          aria-label="Refresh review queue"
          title="Refresh review queue"
          disabled={loading}
          onClick={refresh}
        >
          <RefreshCw size={18} />
        </button>
        <span className="small muted">
          {loading ? "Loading..." : `${queue?.items.length || 0} creatives`}
        </span>
      </div>
      <div className="admin-pagination"><button className="icon-button" aria-label="Previous queue page" title="Previous queue page" disabled={page===0||loading} onClick={()=>{setPage(page-1);setSelected("");}}><ArrowLeft size={16}/></button><span className="small muted">Page {page+1}</span><button className="icon-button" aria-label="Next queue page" title="Next queue page" disabled={loading||!queue||queue.items.length<50} onClick={()=>{setPage(page+1);setSelected("");}}><ArrowRight size={16}/></button></div>
      {error && (
        <p role="alert" className="form-alert">
          {error}
        </p>
      )}
      <div className={`review-layout ${item ? "has-selection" : ""}`}>
        <div className="review-list" aria-label="Creative queue">
          {queue?.items.map((row) => (
            <button
              key={row.id}
              className={`review-row ${row.id === selected ? "selected" : ""}`}
              onClick={() => setSelected(row.id)}
              aria-pressed={row.id === selected}
            >
              <span>
                <strong>{row.details.company}</strong>
                <span>{row.details.campaign}</span>
                <small>
                  {row.filename} / v{row.version}
                  {row.isCurrent ? "" : " / replaced"}
                </small>
              </span>
              <span>
                <span className={`status-label ${row.status}`}>
                  {label(row.status)}
                </span>
                <small>{row.priority} priority</small>
                <small>{date(row.createdAt)}</small>
              </span>
            </button>
          ))}
          {!loading && !queue?.items.length && (
            <p className="queue-empty">No creatives in this queue.</p>
          )}
        </div>
        {item && (
          <ReviewDetail
            key={`${item.id}:${item.revision}:${item.campaignRevision}`}
            item={item}
            role={role}
            onChange={refresh}
          />
        )}
      </div>
    </section>
  );
}

function ReviewDetail({
  item,
  role,
  onChange,
}: {
  item: ReviewItem;
  role: "admin" | "reviewer";
  onChange: () => Promise<void>;
}) {
  const [preview, setPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const terminal = ["approved", "rejected", "manual_review"].includes(
    item.status,
  );
  async function decision(action: "approve" | "reject" | "request_new") {
    if (reason.trim().length < 10) {
      setError("Enter a review reason of at least 10 characters.");
      return;
    }
    if (action === "approve" && !confirmed) {
      setError(
        "Confirm that you reviewed the complete creative and its policy context.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await body(
        await fetch(`/api/admin/moderation/${item.id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, revision: item.revision, reason }),
        }),
      );
      setNotice("Review decision recorded.");
      await onChange();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Review could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="review-detail">
      <div className="review-detail-heading">
        <h2>{item.details.campaign}</h2>
        <span className="small muted">
          Creative v{item.version}
          {!item.isCurrent ? " / replaced" : " / current"}
        </span>
      </div>
      {item.previewAvailable ? (
        <div className="private-preview">
          {!preview ? (
            <button
              className="button button-outline"
              onClick={() => setPreview(true)}
            >
              <Eye size={17} />
              Open private preview
            </button>
          ) : previewError ? (
            <p role="alert">
              Preview unavailable. Refresh the queue before reviewing.
            </p>
          ) : item.mediaType === "image" ? (
            <Image
              unoptimized
              width={item.width || 1280}
              height={item.height || 720}
              src={`/api/admin/moderation/${item.id}/preview`}
              alt="Uploaded advertising creative for internal review"
              onError={() => setPreviewError(true)}
            />
          ) : (
            <video
              controls
              playsInline
              preload="metadata"
              src={`/api/admin/moderation/${item.id}/preview`}
              onError={() => setPreviewError(true)}
              controlsList="nodownload"
            />
          )}
        </div>
      ) : (
        <p className="preview-unavailable">
          <ShieldAlert size={20} />
          {item.restricted
            ? "Restricted creative. Preview and approval are disabled."
            : "Preview unavailable: security checks or media retention requirements have not been met."}
        </p>
      )}
      <dl className="review-facts">
        <div>
          <dt>Company</dt>
          <dd>{item.details.company}</dd>
        </div>
        <div>
          <dt>Contact</dt>
          <dd>
            {item.details.contact}
            <br />
            {item.details.email}
          </dd>
        </div>
        <div>
          <dt>Automated decision</dt>
          <dd>{label(item.automatedDecision || "pending")}</dd>
        </div>
        <div>
          <dt>Current decision</dt>
          <dd>{label(item.decision || item.status)}</dd>
        </div>
        <div>
          <dt>Issue type</dt>
          <dd>{item.rejectionKind || "Content review"}</dd>
        </div>
        <div>
          <dt>Reason codes</dt>
          <dd>{item.reasonCodes.join(", ") || "None"}</dd>
        </div>
        <div>
          <dt>Policy / provider</dt>
          <dd>
            {item.policyVersion || "Pending"} / {item.provider || "Pending"}
          </dd>
        </div>
        <div>
          <dt>Security / decode</dt>
          <dd>
            {item.scanPassed ? "Passed" : "Not passed"} /{" "}
            {item.securityValid ? "Passed" : "Not passed"}
          </dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>
            {item.mediaType} / {(item.fileSize / 1048576).toFixed(2)} MB /{" "}
            {item.width || "?"} x {item.height || "?"}
            {item.duration ? ` / ${item.duration.toFixed(2)}s` : ""}
          </dd>
        </div>
        <div>
          <dt>Requested placement</dt>
          <dd>
            {[
              item.details.city,
              item.details.region,
              item.details.locationPreference,
            ]
              .filter(Boolean)
              .join(" / ")}
          </dd>
        </div>
        <div>
          <dt>Preferred dates</dt>
          <dd>
            {item.details.startDate || "Open"} to{" "}
            {item.details.endDate || "Open"}
          </dd>
        </div>
        {item.details.notes && (
          <div>
            <dt>Campaign notes</dt>
            <dd>{item.details.notes}</dd>
          </div>
        )}
      </dl>
      {terminal && role === "admin" && (
        <div className="review-action-form">
          <div className="field">
            <label htmlFor="review-reason">Review reason</label>
            <textarea
              id="review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={1000}
              rows={3}
            />
          </div>
          {item.canApprove && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I reviewed the complete creative, visible text, audio where
              present, and relevant policy context.
            </label>
          )}
          <div className="review-buttons">
            <button
              className="button"
              disabled={busy || !item.canApprove}
              onClick={() => decision("approve")}
            >
              <Check size={16} />
              Approve
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => decision("reject")}
            >
              <X size={16} />
              Reject
            </button>
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => decision("request_new")}
            >
              <UploadCloud size={16} />
              Request replacement
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="form-alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {role === "admin" && item.isCurrent && (
        <CampaignActions item={item} onChange={onChange} />
      )}
      <details className="review-history">
        <summary>Audit history ({item.history.length})</summary>
        <ol>
          {item.history.map((event, index) => (
            <li key={index}>
              <strong>{label(event.action)}</strong>
              <time>{date(event.created_at)}</time>
              <p>{event.reason}</p>
              <small>
                {event.original_decision &&
                  `${event.original_decision} to ${event.final_decision} / `}
                Actor: {event.actor_id}
              </small>
            </li>
          ))}
        </ol>
      </details>
    </aside>
  );
}

function CampaignActions({
  item,
  onChange,
}: {
  item: ReviewItem;
  onChange: () => Promise<void>;
}) {
  const next: Record<string, string> = {
    requested: "business_approved",
    business_approved: "paid",
    paid: "scheduled",
    scheduled: "live",
  };
  const labels: Record<string, string> = {
    business_approved: "Approve business review",
    paid: "Confirm payment",
    scheduled: "Confirm schedule",
    live: "Mark live",
    paused: "Pause campaign",
  };
  const target = next[item.businessStatus];
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attestations: Record<string, string> = {
    availability: "Location and date availability confirmed",
    specifications: "Screen specifications confirmed",
    quote: "Final quote accepted",
    payment: "Payment verified in the business ledger",
    schedule: "Display schedule confirmed",
  };
  const required =
    target === "business_approved"
      ? ["availability", "specifications", "quote"]
      : target === "paid"
        ? ["payment"]
        : target === "scheduled"
          ? ["schedule"]
          : [];
  async function transition(state: string) {
    if (notes.trim().length < 10) {
      setError("Enter an audit note of at least 10 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await body(
        await fetch(`/api/admin/campaigns/${item.campaignId}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: item.campaignRevision,
            next: state,
            reason: notes,
            attestations: checks,
          }),
        }),
      );
      await onChange();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Campaign could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="business-review">
      <summary>Campaign: {label(item.businessStatus)}</summary>
      {target && (
        <>
          {required.map((key) => (
            <label className="check-label" key={key}>
              <input
                type="checkbox"
                checked={checks[key] || false}
                onChange={(event) =>
                  setChecks({ ...checks, [key]: event.target.checked })
                }
              />
              {attestations[key]}
            </label>
          ))}
        </>
      )}
      {(target || item.businessStatus === "live") && (
        <>
          <div className="field">
            <label htmlFor="business-note">Business audit note</label>
            <textarea
              id="business-note"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
          <div className="review-buttons">
            {target && (
              <button
                className="button"
                disabled={busy || required.some((key) => !checks[key])}
                onClick={() => transition(target)}
              >
                <Check size={16} />
                {labels[target]}
              </button>
            )}
            <button
              className="button button-outline"
              disabled={busy}
              onClick={() => transition("paused")}
            >
              Pause campaign
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="form-alert">
          {error}
        </p>
      )}
    </details>
  );
}
