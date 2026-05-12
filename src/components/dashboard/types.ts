export type DashboardProfile = {
  full_name: string | null;
  company_name: string | null;
  role: string;
  status: string;
  kyc_level: number;
};

export type DashboardOrder = {
  id: string;
  order_no: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
};

export type DashboardInquiry = {
  id: string;
  status: string;
  requested_qty: number;
  created_at: string;
  product_categories: { name: string } | null;
};

export type DashboardData = {
  profile: DashboardProfile | null;
  activeOrders: DashboardOrder[];
  pendingInquiries: DashboardInquiry[];
  isSeller: boolean;
  isAdmin: boolean;
};

export const DASHBOARD_STYLES = [
  {
    id: "aurora",
    label: "Aurora",
    tagline: "AI-Native",
    description: "Glass surfaces, animated gradient, prominent AI prompt.",
  },
  {
    id: "command",
    label: "Command",
    tagline: "Minimal",
    description: "Hairline rows, monospace metrics, Linear-style density.",
  },
  {
    id: "pocket",
    label: "Pocket",
    tagline: "Mobile-first",
    description: "Big rounded cards, snap carousel, single-hand friendly.",
  },
  {
    id: "terminal",
    label: "Terminal",
    tagline: "Trading desk",
    description: "Dense table, mono-spaced numbers, status colour bars.",
  },
] as const;

export type DashboardStyleId = (typeof DASHBOARD_STYLES)[number]["id"];

export const DEFAULT_DASHBOARD_STYLE: DashboardStyleId = "aurora";

export const STATUS_TINT: Record<string, string> = {
  draft: "text-muted-foreground border-border",
  contract_generated: "text-blue-400 border-blue-400/40",
  signed: "text-purple-400 border-purple-400/40",
  payment_pending: "text-yellow-400 border-yellow-400/40",
  paid: "text-green-400 border-green-400/40",
  shipped: "text-cyan-400 border-cyan-400/40",
  delivered: "text-teal-400 border-teal-400/40",
  disputed: "text-red-400 border-red-400/40",
  cancelled: "text-muted-foreground border-border",
  completed: "text-emerald-400 border-emerald-400/40",
};
