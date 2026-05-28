import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center px-6">
      <Link href={ROUTES.DASHBOARD}>
        <Image src="/logo-with-name.png" alt="MIC ACE" width={120} height={26} />
      </Link>
    </header>
  );
}
