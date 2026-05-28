# MIC ACE — Client

Frontend Next.js 16 cho dự án MIC ACE Affiliate Platform.

## Tech stack

| Thư viện | Mục đích |
|---|---|
| Next.js 16 (App Router) | Framework |
| React 19 | UI |
| Tailwind CSS v4 | Styling |
| shadcn/ui + Base UI | Component library |
| Zustand | Global state |
| React Hook Form + Zod | Form & validation |
| Axios | HTTP client |
| Sonner | Toast notifications |

## Cấu trúc thư mục

```text
client/
├── app/
│   ├── layout.tsx              # Root layout (font, theme, toaster)
│   ├── page.tsx                # Redirect về /landing
│   ├── globals.css             # Tailwind + CSS variables
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (main)/
│       ├── landing/page.tsx    # Trang giới thiệu public
│       └── dashboard/page.tsx  # Trang sau khi đăng nhập
├── components/
│   ├── common/                 # Header, Footer, Navbar, animations
│   ├── features/auth/          # LoginForm, RegisterForm
│   └── ui/                     # shadcn components (button, card, input…)
├── constants/
│   ├── config.ts               # API base URL, token keys
│   └── routes.ts               # Route constants
├── hooks/
│   ├── useAuth.ts              # Auth state + actions
│   ├── useDebounce.ts
│   └── useMediaQuery.ts
├── lib/
│   ├── axios.ts                # Axios instance với interceptors
│   ├── utils.ts                # cn() helper
│   └── validations/            # Zod schemas (auth, user)
├── services/
│   ├── auth.service.ts         # Gọi API auth
│   └── user.service.ts         # Gọi API user
├── stores/
│   ├── authStore.ts            # Zustand auth store
│   └── uiStore.ts              # Zustand UI store
└── types/
    ├── auth.types.ts
    └── user.types.ts
```

## Biến môi trường

Tạo file `.env.local` trong thư mục `client/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:9030/api
PORT=3030
```

`NEXT_PUBLIC_API_URL` mặc định là `http://localhost:9030/api` nếu không khai báo.

## Chạy local

```bash
# Cài dependencies
npm install

# Chạy dev (port 3030)
npm run dev

# Build production
npm run build
npm run start
```

Ứng dụng chạy tại **http://localhost:3030**.

## Routes

| Path | Mô tả |
|---|---|
| `/landing` | Trang giới thiệu |
| `/login` | Đăng nhập |
| `/register` | Đăng ký |
| `/dashboard` | Dashboard (yêu cầu đăng nhập) |


This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
