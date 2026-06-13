"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { mailDelegationService } from "@/services/mailDelegation.service";
import type { AccountNode, CallbackResponse } from "@/types/mailDelegation.types";

// ─── Recursive account tree ───────────────────────────────────────────────────

function AccountTree({ accounts, depth = 0 }: { accounts: AccountNode[]; depth?: number }) {
  if (!accounts.length) return null;
  return (
    <ul className={depth === 0 ? "space-y-1.5" : "mt-1.5 ml-4 space-y-1.5 border-l border-border pl-3"}>
      {accounts.map((acc) => (
        <li key={acc.adsId}>
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium leading-tight">{acc.adsName}</p>
              <p className="text-[11px] text-muted-foreground">
                ID: {acc.adsId}
                {acc.currencyCode ? ` · ${acc.currencyCode}` : ""}
                {acc.timezone ? ` · ${acc.timezone}` : ""}
              </p>
            </div>
            <div className="ml-3 flex shrink-0 flex-col items-end gap-1">
              {acc.isManager && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                  Manager
                </span>
              )}
              {acc.adsStatus && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    acc.adsStatus === "ENABLED"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {acc.adsStatus}
                </span>
              )}
            </div>
          </div>
          {acc.subAccounts.length > 0 && (
            <AccountTree accounts={acc.subAccounts} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Status = "loading" | "success" | "error";

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<CallbackResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const called = useRef(false);
  const code = params.get("code");
  const state = params.get("state");
  const missingAuthParams = !code || !state;

  useEffect(() => {
    if (called.current || missingAuthParams) return;
    called.current = true;

    mailDelegationService
      .handleCallback(code, state)
      .then((data) => {
        setResult(data);
        setStatus("success");
      })
      .catch((err) => {
        const msg =
          err?.response?.data?.detail ||
          err?.message ||
          "Có lỗi xảy ra khi xử lý uỷ quyền.";
        setErrorMsg(msg);
        setStatus("error");
      });
  }, [code, missingAuthParams, state]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Đang xử lý uỷ quyền…</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vui lòng không đóng tab này.
              </p>
            </div>
          </div>
        )}

        {(missingAuthParams || status === "error") && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Uỷ quyền thất bại</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {missingAuthParams
                  ? "Thiếu thông tin xác thực (code hoặc state không hợp lệ)."
                  : errorMsg}
              </p>
            </div>
            <Link
              href="/"
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Về trang chủ
            </Link>
          </div>
        )}

        {status === "success" && result && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="size-8 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Uỷ quyền thành công!</h1>
                <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
              </div>
            </div>

            {result.accounts.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium">
                  Tài khoản Google Ads tìm thấy ({result.accounts.length})
                </p>
                <AccountTree accounts={result.accounts} />
              </div>
            )}

            {result.unaccessibleIds.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-medium text-amber-800">
                  Tài khoản không thể truy cập ({result.unaccessibleIds.length})
                </p>
                <ul className="space-y-1">
                  {result.unaccessibleIds.map((id) => (
                    <li key={id} className="text-[12px] text-amber-700">
                      ID: {id}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <p className="text-xs text-muted-foreground">
                Bạn có thể đóng tab này.
              </p>
              <Link
                href="/"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Về trang chủ
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
