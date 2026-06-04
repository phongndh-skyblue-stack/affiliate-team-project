"use client";

import { useEffect, useState } from "react";
import {
  ChevronRight,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Server,
  ShieldOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { proxyService } from "@/services/proxy.service";
import type { ProxyCreate, ProxyResponse } from "@/types/proxy.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROTOCOL_OPTIONS = [
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
  { value: "socks5", label: "SOCKS5" },
];

// ─── Proxy Form ───────────────────────────────────────────────────────────────

interface ProxyFormData extends ProxyCreate {
  password?: string | null;
}

function emptyForm(): ProxyFormData {
  return { name: "", protocol: "http", host: "", port: "", username: "", password: "" };
}

function ProxyForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  hasExistingPassword,
}: {
  initial: ProxyFormData;
  onSubmit: (data: ProxyFormData) => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  hasExistingPassword?: boolean;
}) {
  const [form, setForm] = useState<ProxyFormData>(initial);
  const set = (k: keyof ProxyFormData, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const inputClass =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#059669]/30 disabled:opacity-50";

  const valid = form.name.trim() && form.host.trim() && form.port.trim();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tên nhận diện *</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="VD: Proxy VN #1, US Residential..."
            disabled={loading}
            className={inputClass}
          />
        </div>

        {/* Protocol */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Giao thức</label>
          <select value={form.protocol} onChange={(e) => set("protocol", e.target.value)} disabled={loading} className={inputClass}>
            {PROTOCOL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Port */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Port *</label>
          <input value={form.port} onChange={(e) => set("port", e.target.value)} placeholder="8080" disabled={loading} className={inputClass} />
        </div>

        {/* Host */}
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Host / IP *</label>
          <input value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="proxy.example.com hoặc 123.45.67.89" disabled={loading} className={inputClass} />
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tên đăng nhập</label>
          <input value={form.username ?? ""} onChange={(e) => set("username", e.target.value)} placeholder="(tuỳ chọn)" disabled={loading} className={inputClass} />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Mật khẩu
            {hasExistingPassword && <span className="ml-1 text-[11px] text-muted-foreground">(bỏ trống = giữ nguyên)</span>}
          </label>
          <input
            type="password"
            value={form.password ?? ""}
            onChange={(e) => set("password", e.target.value)}
            placeholder={hasExistingPassword ? "••••••• (không đổi)" : "(tuỳ chọn)"}
            disabled={loading}
            className={inputClass}
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          Huỷ
        </button>
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !valid}
          className="flex items-center gap-1.5 rounded-xl bg-[#059669] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Proxy Card ───────────────────────────────────────────────────────────────

function ProxyCard({
  proxy,
  onEdit,
  onDelete,
  deleting,
}: {
  proxy: ProxyResponse;
  onEdit: (p: ProxyResponse) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card px-5 py-4 transition-all hover:border-[#059669]/40 hover:shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#059669]/10">
          <Server size={18} className="text-[#059669]" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{proxy.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase">{proxy.protocol}</span>
            <span className="ml-2">{proxy.host}:{proxy.port}</span>
          </p>
          {(proxy.username || proxy.hasPassword) && (
            <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              {proxy.username && <span>👤 {proxy.username}</span>}
              {proxy.hasPassword && <span>🔑 Đã lưu mật khẩu</span>}
            </p>
          )}
          {!proxy.username && !proxy.hasPassword && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldOff size={10} /> Không có xác thực
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(proxy)}
            className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Chỉnh sửa"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(proxy.id)}
            disabled={deleting}
            className="flex size-8 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
            title="Xoá"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground">
        Thêm lúc {new Date(proxy.createdAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#059669]/10 ring-8 ring-[#059669]/5">
        <Globe size={28} className="text-[#059669]/70" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Chưa có proxy nào</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Thêm proxy để dùng khi tìm kiếm Google Ads. Mật khẩu được mã hoá và lưu an toàn.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 rounded-xl bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#059669]/30 transition-opacity hover:opacity-90"
      >
        <Plus size={14} /> Thêm proxy đầu tiên
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProxyTab() {
  const [proxies, setProxies] = useState<ProxyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editProxy, setEditProxy] = useState<ProxyResponse | null>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    proxyService
      .list()
      .then((r) => setProxies(r.items))
      .catch(() => toast.error("Không tải được danh sách proxy"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (form: ProxyFormData) => {
    setSavingNew(true);
    try {
      const created = await proxyService.create(form);
      setProxies((prev) => [created, ...prev]);
      setShowAddForm(false);
      toast.success("Đã thêm proxy");
    } catch {
      toast.error("Không thêm được proxy");
    } finally {
      setSavingNew(false);
    }
  };

  const handleEdit = async (form: ProxyFormData) => {
    if (!editProxy) return;
    setSavingEdit(true);
    try {
      const payload: Partial<ProxyFormData> = { ...form };
      // Don't send empty password – backend keeps existing
      if (!payload.password) delete payload.password;
      const updated = await proxyService.update(editProxy.id, payload);
      setProxies((prev) => prev.map((p) => (p.id === editProxy.id ? updated : p)));
      setEditProxy(null);
      toast.success("Đã cập nhật proxy");
    } catch {
      toast.error("Không cập nhật được proxy");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await proxyService.delete(id);
      setProxies((prev) => prev.filter((p) => p.id !== id));
      toast.success("Đã xoá proxy");
    } catch {
      toast.error("Không xoá được proxy");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3">
        <Loader2 size={22} className="animate-spin text-[#059669]" />
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Quản lý Proxy</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mật khẩu được mã hoá (AES-256) trước khi lưu vào database.
          </p>
        </div>
        {!showAddForm && !editProxy && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 rounded-xl bg-[#059669] px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-[#059669]/30 transition-opacity hover:opacity-90"
          >
            <Plus size={14} /> Thêm proxy
          </button>
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <ProxyForm
          initial={emptyForm()}
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
          loading={savingNew}
          submitLabel="Lưu proxy"
        />
      )}

      {/* Edit form */}
      {editProxy && (
        <ProxyForm
          initial={{
            name: editProxy.name,
            protocol: editProxy.protocol,
            host: editProxy.host,
            port: editProxy.port,
            username: editProxy.username ?? "",
            password: "",
          }}
          onSubmit={handleEdit}
          onCancel={() => setEditProxy(null)}
          loading={savingEdit}
          submitLabel="Cập nhật"
          hasExistingPassword={editProxy.hasPassword}
        />
      )}

      {/* List */}
      {proxies.length === 0 && !showAddForm ? (
        <EmptyState onAdd={() => setShowAddForm(true)} />
      ) : (
        <div className="space-y-3">
          {proxies.map((p) => (
            <ProxyCard
              key={p.id}
              proxy={p}
              onEdit={(px) => { setEditProxy(px); setShowAddForm(false); }}
              onDelete={handleDelete}
              deleting={deletingId === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
