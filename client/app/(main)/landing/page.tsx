import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Globe,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Star,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimateOnScroll } from "@/components/common/AnimateOnScroll";
import { CountUp } from "@/components/common/CountUp";
import { LandingNavbar } from "@/components/common/LandingNavbar";
import { ROUTES } from "@/constants/routes";

const FEATURES = [
  { icon: TrendingUp, title: "Hoa hồng cạnh tranh", desc: "Tỷ lệ hoa hồng lên đến 30%, minh bạch và thanh toán đúng hạn mỗi tháng." },
  { icon: BarChart3,  title: "Dashboard thời gian thực", desc: "Theo dõi clicks, conversions và doanh thu ngay lập tức trên bảng điều khiển." },
  { icon: Globe,      title: "Đa dạng chiến dịch", desc: "Hàng trăm chiến dịch: tài chính, thương mại điện tử, giáo dục và nhiều hơn." },
  { icon: Shield,     title: "Bảo mật & tin cậy", desc: "Hệ thống bảo mật cao cấp, dữ liệu của bạn luôn được bảo vệ tuyệt đối." },
  { icon: Zap,        title: "Tích hợp dễ dàng", desc: "API linh hoạt, tích hợp nhanh vào website hoặc ứng dụng của bạn trong vài phút." },
  { icon: Users,      title: "Cộng đồng 10.000+", desc: "Gia nhập cộng đồng đối tác lớn mạnh, chia sẻ kinh nghiệm và phát triển cùng nhau." },
];

const STATS = [
  { end: 10000, suffix: "+", label: "Đối tác tin cậy" },
  { end: 500,   suffix: "+", label: "Chiến dịch active" },
  { end: 50,    prefix: "₫", suffix: "B+", label: "Doanh thu chi trả" },
  { end: 99,    suffix: "%", label: "Đối tác hài lòng" },
];

const STEPS = [
  { step: "01", title: "Đăng ký tài khoản", desc: "Tạo tài khoản miễn phí trong vòng 2 phút, không cần thẻ tín dụng.", icon: "✍️" },
  { step: "02", title: "Chọn chiến dịch", desc: "Duyệt và chọn chiến dịch phù hợp với lĩnh vực và khán giả của bạn.", icon: "🎯" },
  { step: "03", title: "Chia sẻ & kiếm tiền", desc: "Lấy link affiliate và bắt đầu chia sẻ để kiếm hoa hồng không giới hạn.", icon: "💰" },
];

const TESTIMONIALS = [
  { name: "Nguyễn Minh Tuấn", role: "Content Creator", text: "Tôi kiếm được ₫15 triệu/tháng chỉ từ việc chia sẻ link trên blog. MIC ACE thực sự thay đổi cuộc sống của tôi!", stars: 5 },
  { name: "Trần Thị Hoa", role: "Marketing Manager", text: "Hệ thống báo cáo chi tiết giúp tôi tối ưu chiến dịch hiệu quả hơn 3x so với các nền tảng khác.", stars: 5 },
  { name: "Lê Văn Nam", role: "Freelancer", text: "Dashboard đẹp, dễ dùng, hoa hồng được thanh toán đúng hạn. Tôi đã giới thiệu cho 20 người bạn!", stars: 5 },
];

const TRUST_BADGES = ["Miễn phí đăng ký", "Không ràng buộc", "Hỗ trợ 24/7", "Thanh toán đúng hạn"];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] overflow-x-hidden">

      {/* ── Navbar ── */}
      <LandingNavbar />

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-white pt-20">
        {/* Dot-grid background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:28px_28px] opacity-60" />
        {/* Radial gradient fade at center */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(5,150,105,0.06),transparent)]" />

        {/* Floating blobs */}
        <div className="animate-blob pointer-events-none absolute -top-32 -right-32 size-[480px] rounded-full bg-[#059669]/8 blur-3xl" />
        <div className="animate-blob pointer-events-none absolute -bottom-32 -left-32 size-[380px] rounded-full bg-[#0F172A]/5 blur-3xl" style={{ animationDelay: "3s" }} />

        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">

          {/* Badge */}
          <div className="animate-fade-in-down delay-100 mb-8 inline-flex items-center gap-2 rounded-full border border-[#059669]/25 bg-[#059669]/8 px-4 py-1.5 text-xs font-semibold text-[#059669]">
            <span className="animate-pulse inline-block size-2 rounded-full bg-[#059669]" />
            <Sparkles className="size-3" />
            Nền tảng Affiliate #1 Việt Nam
          </div>

          {/* Heading */}
          <h1 className="animate-fade-in-up delay-200 font-heading text-5xl font-bold tracking-tight leading-[1.15] text-[#0F172A] sm:text-6xl md:text-7xl mb-6">
            Kiếm thu nhập thụ động<br />
            <span className="shimmer-text-sage">cùng MIC ACE</span>
          </h1>

          {/* Sub */}
          <p className="animate-fade-in-up delay-300 mx-auto max-w-2xl text-lg text-[#64748B] leading-relaxed mb-10">
            Tham gia mạng lưới affiliate marketing hàng đầu. Chọn chiến dịch, chia sẻ link và nhận hoa hồng lên đến{" "}
            <strong className="font-bold text-[#0F172A]">30%</strong> — hoàn toàn miễn phí.
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-up delay-400 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href={ROUTES.REGISTER}>
              <Button size="lg" className="px-8 shadow-lg shadow-[#0F172A]/20 hover:-translate-y-0.5 transition-all">
                Bắt đầu miễn phí
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href={ROUTES.LOGIN}>
              <Button variant="outline" size="lg" className="px-8 hover:-translate-y-0.5 transition-all">
                Đăng nhập
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="animate-fade-in-up delay-500 mt-10 flex flex-wrap justify-center gap-5 text-sm text-[#64748B]">
            {TRUST_BADGES.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-[#059669]" /> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Floating stat cards */}
        <div className="animate-float pointer-events-none absolute left-10 top-1/3 hidden xl:block" style={{ animationDelay: "0.5s" }}>
          <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.08)] p-4 text-left w-48">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-2 rounded-full bg-[#059669] animate-pulse" />
              <span className="text-xs font-medium text-[#64748B]">Hoa hồng hôm nay</span>
            </div>
            <p className="text-2xl font-bold font-heading text-[#0F172A]">₫2.4M</p>
            <p className="text-xs text-[#059669] font-medium mt-0.5">↑ +24% so với hôm qua</p>
          </div>
        </div>
        <div className="animate-float pointer-events-none absolute right-10 top-[28%] hidden xl:block" style={{ animationDelay: "1.5s" }}>
          <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_16px_rgba(15,23,42,0.08)] p-4 text-left w-44">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">🎯</span>
              <span className="text-xs font-medium text-[#64748B]">Chiến dịch mới</span>
            </div>
            <p className="text-sm font-semibold text-[#0F172A]">Shopee x MIC ACE</p>
            <p className="text-xs text-[#059669] font-bold mt-0.5">Hoa hồng 28%</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          STATS BAND — Navy
      ══════════════════════════════════════ */}
      <section id="stats" className="relative py-16 bg-[#0F172A] overflow-hidden">
        {/* Subtle grid on dark bg */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <AnimateOnScroll animation="fade-in" className="relative mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-10 text-center md:grid-cols-4">
            {STATS.map(({ end, suffix, prefix, label }) => (
              <div key={label} className="group">
                <p className="font-heading text-4xl md:text-5xl font-bold text-white tracking-tight">
                  <CountUp end={end} suffix={suffix} prefix={prefix} />
                </p>
                <div className="mt-3 h-px w-8 mx-auto bg-[#059669]/60 group-hover:w-16 transition-all duration-300" />
                <p className="mt-2 text-sm font-medium text-[#94A3B8]">{label}</p>
              </div>
            ))}
          </div>
        </AnimateOnScroll>
      </section>

      {/* ══════════════════════════════════════
          FEATURES
      ══════════════════════════════════════ */}
      <section id="features" className="py-28 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateOnScroll animation="fade-in-up" className="text-center mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.12em] text-[#059669] mb-3">
              Tính năng nổi bật
            </span>
            <h2 className="font-heading text-4xl font-bold tracking-tight text-[#0F172A]">Tại sao chọn MIC ACE?</h2>
            <p className="mt-3 text-[#64748B] max-w-xl mx-auto leading-relaxed">
              Những lý do hàng nghìn đối tác tin tưởng nền tảng của chúng tôi.
            </p>
          </AnimateOnScroll>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <AnimateOnScroll key={title} animation="fade-in-up" delay={i * 70}>
                <div className="group relative rounded-xl border border-[#E2E8F0] bg-white p-6 overflow-hidden
                  transition-all duration-300
                  hover:shadow-[0_8px_32px_rgba(15,23,42,0.10)] hover:-translate-y-1.5 hover:border-[#0F172A]/20">
                  {/* Sage corner accent on hover */}
                  <div className="absolute top-0 right-0 w-16 h-16 rounded-bl-[40px] bg-[#059669]/0 group-hover:bg-[#059669]/6 transition-colors duration-300" />

                  <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl bg-[#0F172A] text-white
                    shadow-[0_2px_8px_rgba(15,23,42,0.20)] group-hover:bg-[#059669] transition-colors duration-300">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-heading font-semibold text-[#0F172A] mb-2">{title}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed">{desc}</p>
                  <ChevronRight className="absolute bottom-5 right-5 size-4 text-transparent group-hover:text-[#059669] transition-all group-hover:translate-x-1 duration-200" />
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <section id="how-it-works" className="py-28 relative overflow-hidden bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#E2E8F0_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        <div className="relative mx-auto max-w-6xl px-6">
          <AnimateOnScroll animation="fade-in-up" className="text-center mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.12em] text-[#059669] mb-3">
              Cách hoạt động
            </span>
            <h2 className="font-heading text-4xl font-bold tracking-tight text-[#0F172A]">3 bước đơn giản</h2>
            <p className="mt-3 text-[#64748B]">Bắt đầu kiếm tiền ngay hôm nay, không cần kinh nghiệm.</p>
          </AnimateOnScroll>

          <div className="relative grid gap-10 md:grid-cols-3">
            {/* Connector line */}
            <div className="pointer-events-none absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-transparent via-[#E2E8F0] to-transparent hidden md:block" />

            {STEPS.map(({ step, title, desc, icon }, i) => (
              <AnimateOnScroll key={step} animation="fade-in-up" delay={i * 130}>
                <div className="relative text-center group px-4">
                  {/* Step circle */}
                  <div className="relative mx-auto mb-6 flex size-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-[#059669]/10 scale-0 group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative flex size-20 items-center justify-center rounded-full bg-[#0F172A] text-white
                      font-heading text-xl font-bold
                      shadow-[0_4px_20px_rgba(15,23,42,0.25)]
                      group-hover:bg-[#059669] transition-colors duration-300">
                      {step}
                    </div>
                  </div>
                  <div className="text-3xl mb-3">{icon}</div>
                  <h3 className="font-heading font-semibold text-lg text-[#0F172A] mb-2">{title}</h3>
                  <p className="text-sm text-[#64748B] leading-relaxed max-w-xs mx-auto">{desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════ */}
      <section id="testimonials" className="py-28 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-6">
          <AnimateOnScroll animation="fade-in-up" className="text-center mb-16">
            <span className="inline-block text-xs font-bold uppercase tracking-[0.12em] text-[#059669] mb-3">
              Đánh giá
            </span>
            <h2 className="font-heading text-4xl font-bold tracking-tight text-[#0F172A]">Đối tác nói gì về chúng tôi</h2>
          </AnimateOnScroll>

          <div className="grid gap-5 sm:grid-cols-3">
            {TESTIMONIALS.map(({ name, role, text, stars }, i) => (
              <AnimateOnScroll key={name} animation="fade-in-up" delay={i * 100}>
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-7
                  hover:shadow-[0_8px_32px_rgba(15,23,42,0.10)] hover:-translate-y-1 hover:border-[#0F172A]/20
                  transition-all duration-300">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: stars }).map((_, j) => (
                      <Star key={j} className="size-4 fill-[#EAB308] text-[#EAB308]" />
                    ))}
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed mb-5 italic">"{text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[#F1F5F9]">
                    <div className="size-10 rounded-full bg-[#0F172A] flex items-center justify-center text-white font-bold font-heading text-sm shrink-0">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#0F172A]">{name}</p>
                      <p className="text-xs text-[#64748B]">{role}</p>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA BANNER — Navy
      ══════════════════════════════════════ */}
      <section className="py-24 px-6 bg-white">
        <AnimateOnScroll animation="scale-in">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl bg-[#0F172A] px-8 py-20 text-center
            shadow-[0_20px_64px_rgba(15,23,42,0.30)]">
            {/* Decorative rings */}
            <div className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full border border-white/8" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 size-80 rounded-full border border-white/8" />
            {/* Sage glow */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[500px] rounded-full bg-[#059669]/8 blur-3xl" />
            {/* Dot grid */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px]" />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#059669]/15 border border-[#059669]/25 px-4 py-1 text-xs font-semibold text-[#34D399] mb-6">
                <Sparkles className="size-3" /> Đăng ký ngay hôm nay
              </span>
              <h2 className="font-heading text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
                Sẵn sàng bắt đầu<br />hành trình của bạn?
              </h2>
              <p className="text-[#94A3B8] mb-10 max-w-lg mx-auto leading-relaxed">
                Đăng ký miễn phí và bắt đầu kiếm hoa hồng từ hàng trăm chiến dịch hấp dẫn ngay hôm nay.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href={ROUTES.REGISTER}>
                  <Button variant="sage" size="lg" className="px-10 hover:-translate-y-0.5 transition-all">
                    Tạo tài khoản miễn phí <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href={ROUTES.LOGIN}>
                  <Button variant="ghost" size="lg" className="px-10 text-[#94A3B8] hover:text-white hover:bg-white/10 transition-all">
                    Đã có tài khoản? Đăng nhập
                  </Button>
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap justify-center gap-6 text-sm text-[#94A3B8]">
                {TRUST_BADGES.map((t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-[#059669]" /> {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <Image src="/logo-with-name.png" alt="MIC ACE" width={100} height={22} style={{ height: "auto" }} />
          <p className="text-sm text-[#64748B]">
            © {new Date().getFullYear()} MIC ACE. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
