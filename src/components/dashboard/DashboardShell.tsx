"use client";

import { DashboardStyleSwitcher } from "./DashboardStyleSwitcher";
import { useDashboardStyle } from "./useDashboardStyle";
import { AuroraDashboard } from "./variants/AuroraDashboard";
import { CommandDashboard } from "./variants/CommandDashboard";
import { PocketDashboard } from "./variants/PocketDashboard";
import { TerminalDashboard } from "./variants/TerminalDashboard";
import { DEFAULT_DASHBOARD_STYLE, type DashboardData } from "./types";

export function DashboardShell({ data }: { data: DashboardData }) {
  const { style, setStyle, mounted } = useDashboardStyle();

  // Render a stable default during SSR / pre-mount so the layout doesn't flash.
  const active = mounted ? style : DEFAULT_DASHBOARD_STYLE;

  return (
    <div className="space-y-6">
      <DashboardStyleSwitcher current={active} onChange={setStyle} />
      {active === "aurora" && <AuroraDashboard data={data} />}
      {active === "command" && <CommandDashboard data={data} />}
      {active === "pocket" && <PocketDashboard data={data} />}
      {active === "terminal" && <TerminalDashboard data={data} />}
    </div>
  );
}
