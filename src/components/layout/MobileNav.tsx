"use client";

import * as React from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";

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

export function MobileNav({
  links,
  isAuthenticated,
  isAdmin,
}: {
  links: readonly NavLink[];
  isAuthenticated: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open navigation"
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
          <SheetDescription>Madagascar natural flake graphite</SheetDescription>
        </SheetHeader>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {links.map((link) => (
            <SheetClose
              key={link.href}
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
                Dashboard
              </SheetClose>
              <SheetClose
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
                Messages
              </SheetClose>
              {isAdmin && (
                <SheetClose
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
                  Admin
                </SheetClose>
              )}
              <LogoutButton variant="outline" size="lg" />
            </>
          ) : (
            <>
              <SheetClose
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
                Log in
              </SheetClose>
              <SheetClose
                render={
                  <Link
                    href="/register"
                    onClick={close}
                    className={cn(buttonVariants({ size: "lg" }), "w-full")}
                  />
                }
              >
                Sign up
              </SheetClose>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
