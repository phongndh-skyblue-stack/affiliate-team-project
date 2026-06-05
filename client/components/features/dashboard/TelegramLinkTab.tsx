"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { telegramService } from "@/services/telegram.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type {
  TelegramConfigResponse,
  TelegramSubscription,
  TelegramVerificationCodeResponse,
} from "@/types/telegram.types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TelegramLinkTab() {
  const [config, setConfig] = useState<TelegramConfigResponse | null>(null);
  const [subscription, setSubscription] = useState<TelegramSubscription | null>(null);
  const [verification, setVerification] = useState<TelegramVerificationCodeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingScheduleNotifications, setSavingScheduleNotifications] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  async function fetchData(options?: { silent?: boolean }) {
    if (!options?.silent) setLoading(true);
    try {
      const [configRes, subscriptionRes] = await Promise.all([
        telegramService.getConfig(),
        telegramService.getSubscription(),
      ]);
      setConfig(configRes);
      setSubscription(subscriptionRes);
      if (subscriptionRes) {
        setVerification(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được thông tin Telegram");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      telegramService.getConfig(),
      telegramService.getSubscription(),
    ])
      .then(([configRes, subscriptionRes]) => {
        if (cancelled) return;
        setConfig(configRes);
        setSubscription(subscriptionRes);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "Không tải được thông tin Telegram");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!verification || subscription) return;

    const timer = window.setInterval(async () => {
      try {
        const nextSubscription = await telegramService.getSubscription();
        if (nextSubscription) {
          setSubscription(nextSubscription);
          setVerification(null);
          toast.success("Liên kết Telegram thành công");
        }
      } catch {
        // Polling is best-effort; the manual refresh button still works.
      }
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [verification, subscription]);

  useEffect(() => {
    const handleTelegramLinked = async () => {
      try {
        const nextSubscription = await telegramService.getSubscription();
        if (nextSubscription) {
          setSubscription(nextSubscription);
          setVerification(null);
          toast.success("Liên kết Telegram thành công");
        }
      } catch {
        // Manual refresh remains available.
      }
    };

    window.addEventListener("telegram:linked", handleTelegramLinked);
    return () => {
      window.removeEventListener("telegram:linked", handleTelegramLinked);
    };
  }, []);

  useEffect(() => {
    const handleTelegramUnlinked = async () => {
      try {
        const nextSubscription = await telegramService.getSubscription();
        setSubscription(nextSubscription);
        if (!nextSubscription) {
          setVerification(null);
        }
      } catch {
        setSubscription(null);
        setVerification(null);
      }
    };

    window.addEventListener("telegram:unlinked", handleTelegramUnlinked);
    return () => {
      window.removeEventListener("telegram:unlinked", handleTelegramUnlinked);
    };
  }, []);

  async function handleGenerateCode() {
    setGenerating(true);
    try {
      const response = await telegramService.generateVerificationCode();
      setVerification(response);
      toast.success("Đã tạo mã xác thực Telegram");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được mã xác thực");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyCommand() {
    if (!verification?.command) return;
    await navigator.clipboard.writeText(verification.command);
    toast.success("Đã copy lệnh xác thực");
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await telegramService.unlink();
      setSubscription(null);
      setVerification(null);
      toast.success("Đã hủy liên kết Telegram");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể hủy liên kết Telegram");
    } finally {
      setUnlinking(false);
    }
  }

  async function handleToggleScheduleNotifications() {
    if (!subscription) return;

    const nextEnabled = !subscription.scheduledSearchNotificationsEnabled;
    setSavingScheduleNotifications(true);
    try {
      const nextSubscription = await telegramService.updateScheduleNotifications(nextEnabled);
      setSubscription(nextSubscription);
      toast.success(
        nextEnabled
          ? "Đã bật thông báo lịch quét qua Telegram"
          : "Đã tắt thông báo lịch quét qua Telegram"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được tùy chọn thông báo");
    } finally {
      setSavingScheduleNotifications(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-[#059669]" />
        Đang tải cấu hình Telegram...
      </div>
    );
  }

  const botLink = config?.botUsername ? `https://t.me/${config.botUsername}` : null;
  const polling = Boolean(verification && !subscription);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#059669]/10 text-[#059669]">
              <Send size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Liên kết Telegram</h2>
              <p className="text-xs text-muted-foreground">
                Gửi một mã xác thực cho bot để hệ thống lưu chat ID trên localhost.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Làm mới
          </button>
        </div>

        <div className="grid items-stretch gap-4 p-5 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4 lg:h-full lg:grid-rows-2">
            <div className="h-full rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 text-[#059669]" />
                <div>
                  <p className="text-sm font-semibold">Xác thực bằng mã một lần</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Backend tạo mã tạm trong Redis. Bạn gửi mã đó cho bot bằng lệnh /verify, bot sẽ lưu chat ID vào tài khoản hiện tại.
                  </p>
                </div>
              </div>
            </div>

            {!config?.enabled ? (
              <div className="h-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800">
                Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_BOT_USERNAME ở server.
              </div>
            ) : (
              <div className="h-full rounded-lg border border-border p-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">Bot đang dùng</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#059669]/10 px-3 py-1 text-sm font-semibold text-[#047857]">
                    @{config.botUsername}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#059669]/10 px-2.5 py-1 text-xs text-[#047857]">
                    <CheckCircle2 size={12} />
                    Sẵn sàng nhận mã
                  </span>
                  {botLink ? (
                    <a
                      href={botLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <ExternalLink size={12} />
                      Mở bot
                    </a>
                  ) : null}
                </div>
              </div>
            )}

            {verification ? (
              <div className="rounded-lg border border-[#059669]/30 bg-[#059669]/5 p-4">
                <p className="text-sm font-semibold">Lệnh xác thực</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <code className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    {verification.command}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#059669] px-3 py-2 text-sm font-medium text-white hover:bg-[#047857]"
                  >
                    <Clipboard size={14} />
                    Copy
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {verification.instruction}. Mã hết hạn sau {verification.expiresInMinutes} phút, lúc{" "}
                  <span className="font-medium text-foreground">{formatDateTime(verification.expiresAt)}</span>.
                </p>
              </div>
            ) : null}
          </div>

          <div className="h-full rounded-lg border border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Trạng thái liên kết</p>
                <p className="text-xs text-muted-foreground">
                  {subscription ? "Telegram đã được liên kết với tài khoản này." : "Chưa có Telegram được liên kết."}
                </p>
              </div>
              {subscription ? (
                <CheckCircle2 size={18} className="text-[#059669]" />
              ) : (
                <XCircle size={18} className="text-muted-foreground" />
              )}
            </div>

            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
                  <div className="flex size-11 items-center justify-center rounded-full bg-[#059669]/10 text-[#059669]">
                    <MessageCircle size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Telegram chat</p>
                    <p className="text-xs text-muted-foreground">Chat ID: {subscription.chatId}</p>
                    <p className="text-xs text-muted-foreground">Liên kết lúc {formatDateTime(subscription.createdAt)}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <BellRing size={16} className="mt-0.5 shrink-0 text-[#059669]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Thông báo lịch quét</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          Báo khi mốc cuối cùng của mỗi lần đặt lịch quét quảng cáo đã hoàn tất.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleScheduleNotifications}
                      disabled={savingScheduleNotifications}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                        subscription.scheduledSearchNotificationsEnabled ? "bg-[#059669]" : "bg-border"
                      }`}
                      aria-pressed={subscription.scheduledSearchNotificationsEnabled}
                      aria-label="Bật tắt thông báo lịch quét qua Telegram"
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          subscription.scheduledSearchNotificationsEnabled ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={unlinking}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      {unlinking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Hủy liên kết Telegram
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hủy liên kết Telegram?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Liên kết Telegram sẽ bị xóa khỏi database. Bot cũng sẽ gửi một tin nhắn xác nhận hủy liên kết tới chat hiện tại.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel asChild>
                        <button
                          type="button"
                          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Giữ liên kết
                        </button>
                      </AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <button
                          type="button"
                          onClick={handleUnlink}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                        >
                          {unlinking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Xác nhận hủy
                        </button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  disabled={!config?.enabled || generating}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#059669] px-3 py-2 text-sm font-medium text-white hover:bg-[#047857] disabled:opacity-50"
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Tạo mã xác thực
                </button>
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                  {polling
                    ? `Đang chờ bot xác nhận liên kết. Mã hiện tại hết hạn lúc ${formatDateTime(verification.expiresAt)}.`
                    : "Sau khi gửi lệnh cho bot, trạng thái sẽ tự cập nhật hoặc bạn có thể bấm Làm mới."}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
