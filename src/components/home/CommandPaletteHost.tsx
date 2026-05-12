"use client";

import * as React from "react";
import { CommandPalette, useCommandPalette } from "@/components/home/CommandPalette";

/**
 * Singleton host for the ⌘K command palette. Mount once in the public
 * layout. Other UI surfaces (hero search hint, navbar search button) open
 * the palette by dispatching the `mada:command:open` window event.
 *
 * The hook itself already wires up the global Cmd/Ctrl+K hotkey.
 */
export const COMMAND_OPEN_EVENT = "mada:command:open";

export function dispatchCommandOpen() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COMMAND_OPEN_EVENT));
}

export function CommandPaletteHost() {
  const { open, setOpen } = useCommandPalette();

  React.useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(COMMAND_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_OPEN_EVENT, onOpen);
  }, [setOpen]);

  return <CommandPalette open={open} onOpenChange={setOpen} />;
}
