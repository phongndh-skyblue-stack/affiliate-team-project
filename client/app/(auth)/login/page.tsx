import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, BarChart3, Shield, TrendingUp } from "lucide-react";
import { LoginForm } from "@/components/features/auth/LoginForm";

const HIGHLIGHTS = [
  { icon: TrendingUp, text: "Hoa hồng lên đến 30%" },
  { icon: BarChart3,  text: "Dashboard thời gian thực" },
  { icon: Shield,     text: "Bảo mật & thanh toán đúng hạn" },
];

export default function LoginPage() {
  return (
    <main className="min-h-screen flex bg-[#F8FAFC]">
      {/* Left panel — Navy branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-panel flex-col items-center justify-center p-14 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-[#059669]/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-80 rounded-full bg-white/4 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative max-w-sm">
          <Image
            src="/logo.png"
            alt="MIC ACE logo"
            width={632}
            height={395}
            className="mb-8"
            style={{ height: 72, width: "auto" }}
            priority
          />
          <h2 className="font-heading text-4xl font-bold mb-3 text-white">MIC ACE</h2>
          <p className="text-[#94A3B8] text-base leading-relaxed mb-10">
            Nền tảng affiliate marketing thông minh, giúp bạn tăng trưởng thu nhập hiệu quả.
          </p>
          <ul className="space-y-3.5">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-[#CBD5E1]">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#059669]/15 border border-[#059669]/25">
                  <Icon className="size-4 text-[#34D399]" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-12 pt-8 border-t border-white/10 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["T","N","L"].map((c) => (
                <div key={c} className="size-8 rounded-full bg-[#059669]/20 border-2 border-[#0F172A] flex items-center justify-center text-xs font-bold text-[#34D399]">{c}</div>
              ))}
            </div>
            <p className="text-xs text-[#94A3B8]">Hơn <span className="text-white font-semibold">10,000+</span> đối tác tin tưởng</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#F8FAFC] relative">
        <Link
          href="/"
          className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          <ArrowLeft className="size-4" />
          Trang chủ
        </Link>
        <div className="w-full max-w-md mb-6 flex justify-center lg:hidden">
          <Image
            src="/logo-with-name.png"
            alt="MIC ACE"
            width={160}
            height={35}
            style={{ height: 32, width: "auto" }}
          />
        </div>
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white px-8 py-10 shadow-[0_4px_16px_rgba(15,23,42,0.07)]">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
