import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { RegisterForm } from "@/components/features/auth/RegisterForm";

const BENEFITS = [
  "Đăng ký miễn phí, không ràng buộc",
  "Hoa hồng cạnh tranh lên đến 30%",
  "Thanh toán nhanh chóng, minh bạch",
  "Hỗ trợ 24/7 từ đội ngũ chuyên nghiệp",
];

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex bg-[#F8FAFC]">
      {/* Left panel — Navy branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-brand-panel flex-col items-center justify-center p-14 text-white relative overflow-hidden">
        {/* Decorative */}
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
          <h2 className="font-heading text-4xl font-bold mb-3 text-white">Tham gia MIC ACE</h2>
          <p className="text-[#94A3B8] text-base leading-relaxed mb-10">
            Tham gia cùng hàng nghìn đối tác đang tăng trưởng thu nhập với MIC ACE.
          </p>
          <ul className="space-y-3.5">
            {BENEFITS.map((text) => (
              <li key={text} className="flex items-center gap-3 text-sm text-[#CBD5E1]">
                <CheckCircle2 className="size-4 shrink-0 text-[#059669]" />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-[#94A3B8] italic">
              "Tôi kiếm được ₫15 triệu/tháng chỉ từ việc chia sẻ link trên blog."
            </p>
            <div className="flex items-center gap-2 mt-3">
              <div className="size-8 rounded-full bg-[#059669]/20 border border-[#059669]/25 flex items-center justify-center text-xs font-bold text-[#34D399]">T</div>
              <div>
                <p className="text-xs font-semibold text-white">Nguyễn Minh Tuấn</p>
                <p className="text-xs text-[#64748B]">Content Creator</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto p-6 py-10 bg-[#F8FAFC] relative">
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
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
