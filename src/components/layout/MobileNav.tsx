"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

/**
 * Optional second nav section shown above the public marketing links
 * when the user is inside a context (Workspace or Admin Console) that
 * has its own desktop sidebar. Lets us surface those sidebar entries
 * on mobile too, where the sidebar is hidden.
 *
 * `items[].badge` is a pre-rendered ReactNode (server-side) so the
 * action counts already filled in by the layout component show up
 * here without a second round-trip.
 */
export type WorkspaceMobileSection = {
  label: string;
  items: ReadonlyArray<{
    href: string;
    label: string;
    badge?: React.ReactNode;
  }>;
};

export function MobileNav({
  links,
  isAuthenticated,
  isAdmin,
  workspace,
}: {
  links: readonly NavLink[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  workspace?: WorkspaceMobileSection;
}) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("nav");

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("openNav")}
            className="text-muted-foreground hover:text-foreground md:hidden"
          />
        }
      >
        <MenuIcon className="size-4" />
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[80vw] max-w-sm bg-background text-foreground"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <span className="size-5 rounded-sm bg-[color:var(--gold)]" />
            <span className="font-semibold tracking-wide">MADA GRAPHITE</span>
          </SheetTitle>
          <SheetDescription>{t("tagline")}</SheetDescription>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {/* Workspace / admin section — only when inside (app) or /admin */}
          {workspace && workspace.items.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {workspace.label}
              </p>
              {workspace.items.map((item) => (
                <SheetClose
                  key={item.href}
                  nativeButton={false}
                  render={
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-[color:var(--gold)]"
                    />
                  }
                >
                  <span className="flex-1">{item.label}</span>
                  {item.badge}
                </SheetClose>
              ))}
              <div className="my-2 border-t border-border" aria-hidden />
              <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("site")}
              </p>
            </div>
          )}

          {/* Public marketing links — labels passed from Navbar (English for now) */}
          {links.map((link) => (
            <SheetClose
              key={link.href}
              nativeButton={false}
              render={
                <Link
                  href={link.href}
                  onClick={close}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted hover:text-[color:var(--gold)]"
                />
              }
            >
              {link.label}
            </SheetClose>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-border p-4">
          {isAuthenticated ? (
            <>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/dashboard"
                    onClick={close}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "w-full"
                    )}
                  />
                }
              >
                {t("items.dashboard")}
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/messages"
                    onClick={close}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "w-full"
                    )}
                  />
                }
              >
                {t("items.messages")}
              </SheetClose>
              {isAdmin && (
                <SheetClose
                  nativeButton={false}
                  render={
                    <Link
                      href="/admin"
                      onClick={close}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "lg" }),
                        "w-full"
                      )}
                    />
                  }
                >
                  {t("items.admin")}
                </SheetClose>
              )}
              <LogoutButton variant="outline" size="lg" />
            </>
          ) : (
            <>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/login"
                    onClick={close}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "w-full"
                    )}
                  />
                }
              >
                {t("items.login")}
              </SheetClose>
              <SheetClose
                nativeButton={false}
                render={
                  <Link
                    href="/register"
                    onClick={close}
                    className={cn(buttonVariants({ size: "lg" }), "w-full")}
                  />
                }
              >
                {t("items.signUp")}
              </SheetClose>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
