"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Mail,
  MailCheck,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mailDelegationService } from "@/services/mailDelegation.service";
import type {
  AdsAccountResponse,
  MailResponse,
} from "@/types/mailDelegation.types";

/* ------------------------------------------------------------------ helpers */

function formatDate(iso: string) {
  const utc = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  return new Date(utc).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* --------------------------------------------------------- AccountChip ----- */

function fmtBudget(value: number | null | undefined, currency: string | null | undefined): string | null {
  if (value == null) return null;
  const cur = currency ?? "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ${cur}`.trim();
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K ${cur}`.trim();
  return `${value.toFixed(2)} ${cur}`.trim();
}

function AccountChip({ acc }: { acc: AdsAccountResponse }) {
  const isActive = acc.adsStatus === "enabled";
  const isCancelled = acc.adsStatus === "cancelled";
  const budgetUsed = fmtBudget(acc.budgetUsed, acc.currencyCode);
  const budgetPaid = fmtBudget(acc.budgetPaid, acc.currencyCode);

  return (
    <div className="group relative flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 transition-shadow hover:shadow-sm">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 font-bold text-xs">
        G
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight truncate">{acc.adsName}</p>
        <p className="text-[11px] text-muted-foreground font-mono">{acc.adsId}</p>
        {(acc.timezone || budgetUsed) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {acc.timezone && (
              <span className="text-[10px] text-muted-foreground/70">{acc.timezone}</span>
            )}
            {budgetUsed && (
              <span className="text-[10px] text-muted-foreground/70">
                Đã dùng: {budgetUsed}
                {budgetPaid ? ` / ${budgetPaid}` : ""}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-1.5">
        {acc.currencyCode && (
          <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {acc.currencyCode}
          </span>
        )}
        {acc.adsStatus && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isActive ? "bg-emerald-500/10 text-emerald-600" :
            isCancelled ? "bg-red-500/10 text-red-600" :
            "bg-slate-100 text-slate-500"
          )}>
            {isActive ? "active" : isCancelled ? "cancelled" : acc.adsStatus}
          </span>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- MailCard ------ */

function MailCard({
  mail: init,
  onDeleted,
}: {
  mail: MailResponse;
  onDeleted: (id: string) => void;
}) {
  const mail = init;
  const [sendingAuth, setSendingAuth] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleSendAuth() {
    setSendingAuth(true);
    try {
      const res = await mailDelegationService.sendAuthEmail(mail.id);
      toast.success(res.message || "Đã gửi email ủy quyền!");
    } catch {
      toast.error("Gửi email thất bại, kiểm tra cấu hình Gmail");
    } finally {
      setSendingAuth(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await mailDelegationService.deleteMail(mail.id);
      toast.success("Đã xóa mail");
      onDeleted(mail.id);
    } catch {
      toast.error("Xóa thất bại");
    } finally {
      setDeleting(false);
    }
  }

  const delegated = mail.isDelegated;
  const count = mail.accounts.length;

  return (
    <div className={cn(
      "rounded-2xl border bg-card overflow-hidden transition-all",
      delegated ? "border-border" : "border-amber-200/60 dark:border-amber-800/30"
    )}>
      {/* top accent line */}
      <div className={cn("h-0.5 w-full", delegated ? "bg-gradient-to-r from-[#059669]/40 via-[#059669]/20 to-transparent" : "bg-gradient-to-r from-amber-400/50 via-amber-200/30 to-transparent")} />

      {/* header */}
      <div className="flex items-center gap-3 px-4 py-4">
        {/* avatar */}
        <div className={cn(
          "relative flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold select-none",
          delegated
            ? "bg-gradient-to-br from-[#059669]/20 to-emerald-400/10 text-[#059669]"
            : "bg-amber-100/80 dark:bg-amber-900/20 text-amber-600"
        )}>
          {mail.email[0].toUpperCase()}
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full border-2 border-card",
            delegated ? "bg-[#059669]" : "bg-amber-400"
          )}>
            {delegated
              ? <MailCheck size={8} className="text-white" />
              : <Mail size={7} className="text-white" />}
          </span>
        </div>

        {/* info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight">{mail.email}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Thêm lúc {formatDate(mail.createdAt)}
            {delegated && count > 0 && (
              <span className="ml-2 text-[#059669]">• {count} tài khoản</span>
            )}
          </p>
        </div>

        {/* badge */}
        <span className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
          delegated
            ? "bg-[#059669]/10 text-[#059669]"
            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        )}>
          {delegated ? "Đã ủy quyền" : "Chưa ủy quyền"}
        </span>

        {/* actions */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {!delegated && (
            <button
              onClick={handleSendAuth}
              disabled={sendingAuth}
              className="flex items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#059669]/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {sendingAuth ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />}
              Gửi auth
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Xóa mail"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
          {delegated && (
            <button
              onClick={() => { setExpanded((v) => !v); }}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* expanded accounts section */}
      {delegated && expanded && (
        <>
          <div className="border-t border-border/60 mx-4 mb-1" />
          <div className="px-4 pb-3 space-y-2.5">
            <div className="flex items-center justify-between py-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {count > 0 ? `${count} Tài khoản` : "Chưa có tài khoản"}
              </p>
              <button
                onClick={handleSendAuth}
                disabled={sendingAuth}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {sendingAuth ? <Loader2 size={10} className="animate-spin" /> : <ExternalLink size={10} />}
                Gửi auth lại
              </button>
            </div>

            {count > 0 ? (
              <div className="space-y-1.5">
                {mail.accounts.map((acc) => <AccountChip key={acc.id} acc={acc} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
                  <Mail size={18} className="text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Tài khoản sẽ tự động được thêm sau khi ủy quyền thành công.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------- AddMailForm ----- */

function AddMailForm({ onAdded }: { onAdded: (mail: MailResponse) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = email.trim();
    if (!v) return;
    setLoading(true);
    try {
      const mail = await mailDelegationService.addMail(v);
      toast.success(`Đã thêm ${mail.email}`);
      onAdded(mail);
      setEmail("");
      setOpen(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail ?? "Thêm mail thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-[#059669]/30 bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#059669]/3 transition-colors"
      >
        <div className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          open ? "bg-[#059669] text-white" : "bg-[#059669]/10 text-[#059669]"
        )}>
          <Plus size={15} />
        </div>
        <span className="flex-1 text-left text-sm font-medium text-[#059669]">
          Thêm Gmail để ủy quyền
        </span>
        {open
          ? <ChevronUp size={15} className="text-[#059669]/60" />
          : <ChevronDown size={15} className="text-[#059669]/60" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t border-[#059669]/15 bg-[#059669]/2 px-4 py-4 space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-foreground/80">
              Địa chỉ Gmail <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669]/30 transition-shadow"
            />
            <p className="text-[11px] text-muted-foreground">
              Sau khi thêm, nhấn <strong>Gửi auth</strong> để gửi link xác thực OAuth.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setOpen(false); setEmail(""); }}
              className="rounded-lg px-3.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-[#059669] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-[#059669]/90 transition-colors shadow-sm"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Thêm mail
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------- MailDelegationTab */

export function MailDelegationTab() {
  const [mails, setMails] = useState<MailResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const loadMails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mailDelegationService.listMails();
      setMails(res.items);
      setTotal(res.total);
    } catch {
      toast.error("Tải danh sách mail thất bại");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadMails);
  }, [loadMails]);

  useEffect(() => {
    const h = () => loadMails();
    window.addEventListener("delegation:result", h);
    return () => window.removeEventListener("delegation:result", h);
  }, [loadMails]);

  const delegatedCount = mails.filter((m) => m.isDelegated).length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* page header */}
      <div className="flex items-start gap-4 rounded-2xl border border-[#059669]/15 bg-gradient-to-br from-[#059669]/5 to-transparent p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10">
          <MailCheck size={20} className="text-[#059669]" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-foreground">Ủy quyền Gmail truy cập Google Ads</h2>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Thêm địa chỉ Gmail, gửi link xác thực OAuth, sau đó import tài khoản Google Ads vào hệ thống.
          </p>
        </div>
        {total > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold text-[#059669]">{delegatedCount}<span className="text-muted-foreground font-normal text-xs">/{total}</span></p>
            <p className="text-[10px] text-muted-foreground">đã ủy quyền</p>
          </div>
        )}
      </div>

      {/* add form */}
      <AddMailForm
        onAdded={(mail) => {
          setMails((p) => [mail, ...p]);
          setTotal((t) => t + 1);
        }}
      />

      {/* list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Danh sách mail ({total})
          </p>
          <button
            onClick={loadMails}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={11} className={cn(loading && "animate-spin")} />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 size={28} className="animate-spin text-[#059669]" />
            <p className="text-xs text-muted-foreground">Dangl tải danh sách...</p>
          </div>
        ) : mails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
              <Mail size={28} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold">Chưa có mail nào</p>
              <p className="mt-1 text-xs text-muted-foreground">Thêm Gmail ở trên để bắt đầu ủy quyền</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {mails.map((mail) => (
              <MailCard
                key={mail.id}
                mail={mail}
                onDeleted={(id) => {
                  setMails((p) => p.filter((m) => m.id !== id));
                  setTotal((t) => t - 1);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
