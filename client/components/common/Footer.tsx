import { APP_NAME } from "@/constants/config";

export function Footer() {
  return (
    <footer className="border-t border-border py-4 px-6 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
    </footer>
  );
}
