/**
 * Supabase database types — placeholder.
 *
 * After your Supabase project is provisioned and migrations are applied,
 * regenerate this file with:
 *
 *   npx supabase gen types typescript \
 *     --project-id YOUR_PROJECT_REF \
 *     --schema public \
 *     > src/types/database.ts
 *
 * For now we export a permissive `Database` type so the codebase compiles
 * before we connect to a real Supabase project.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Minimal placeholder shape. Replace by running the gen-types command above.
export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: {
      user_role: "buyer" | "seller" | "admin" | "super_admin";
      user_status: "pending" | "active" | "frozen";
      listing_status: "active" | "paused" | "sold_out";
      inquiry_status: "pending" | "accepted" | "rejected" | "converted";
      order_status:
        | "draft"
        | "contract_generated"
        | "signed"
        | "payment_pending"
        | "paid"
        | "shipped"
        | "delivered"
        | "completed"
        | "disputed"
        | "cancelled";
      payment_method:
        | "usdt_trc20"
        | "usdt_erc20"
        | "usdi"
        | "mup"
        | "bank_transfer";
      payment_status: "pending" | "verified" | "rejected";
      chat_type: "order" | "support" | "ai";
    };
    CompositeTypes: Record<string, never>;
  };
}
