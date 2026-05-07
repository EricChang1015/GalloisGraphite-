export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950 text-neutral-400">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-3 text-sm">
        <div className="space-y-2">
          <h4 className="text-neutral-100 font-semibold tracking-wide">
            Mada Graphite
          </h4>
          <p>Operated by Graphite Energy Inc.</p>
          <p>Toamasina 501, Madagascar.</p>
        </div>
        <div className="space-y-2">
          <h4 className="text-neutral-100 font-semibold tracking-wide">
            Contact
          </h4>
          <p>
            <a
              href="mailto:sales@madagraphite.com"
              className="hover:text-[color:var(--gold)]"
            >
              sales@madagraphite.com
            </a>
          </p>
          <p>+853 66-516-516</p>
        </div>
        <div className="space-y-2">
          <h4 className="text-neutral-100 font-semibold tracking-wide">
            Trading
          </h4>
          <p>USDT (TRC20/ERC20), USDI, MUP, Bank Transfer.</p>
          <p className="text-xs text-neutral-500">
            All payments verified by platform admins.
          </p>
        </div>
      </div>
      <div className="border-t border-neutral-800 px-4 py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Graphite Energy Inc. All rights reserved.
      </div>
    </footer>
  );
}
