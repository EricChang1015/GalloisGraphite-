import { AiChatLauncher } from "@/components/chat/AiChatLauncher";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { CommandPaletteHost } from "@/components/home/CommandPaletteHost";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <AiChatLauncher />
      <CommandPaletteHost />
    </>
  );
}
