"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;
const AlertDialogOverlay = AlertDialogPrimitive.Overlay;
const AlertDialogContent = AlertDialogPrimitive.Content;
const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;
const AlertDialogAction = AlertDialogPrimitive.Action;
const AlertDialogCancel = AlertDialogPrimitive.Cancel;

function AlertDialogContentWrapper({ className, children, ...props }: AlertDialogPrimitive.AlertDialogContentProps) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
      <AlertDialogContent
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-background p-6 shadow-2xl shadow-slate-900/30 focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
      </AlertDialogContent>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-2 text-center", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-2", className)} {...props} />;
}

function AlertDialogTitleText({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <AlertDialogTitle
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function AlertDialogDescriptionText({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <AlertDialogDescription
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContentWrapper as AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitleText as AlertDialogTitle,
  AlertDialogDescriptionText as AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
