/**
 * Supabase database types — hand-crafted from migrations/001_init.sql.
 *
 * After your Supabase project is provisioned run the generator to replace this:
 *   npx supabase gen types typescript \
 *     --project-id YOUR_PROJECT_REF --schema public > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          company_name: string | null;
          country: string | null;
          phone: string | null;
          role: "buyer" | "seller" | "admin" | "super_admin";
          status: "pending" | "active" | "frozen";
          kyc_level: number;
          kyc_docs: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          company_name?: string | null;
          country?: string | null;
          phone?: string | null;
          role?: "buyer" | "seller" | "admin" | "super_admin";
          status?: "pending" | "active" | "frozen";
          kyc_level?: number;
          kyc_docs?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          company_name?: string | null;
          country?: string | null;
          phone?: string | null;
          role?: "buyer" | "seller" | "admin" | "super_admin";
          status?: "pending" | "active" | "frozen";
          kyc_level?: number;
          kyc_docs?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          spec_schema: Json;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          spec_schema?: Json;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          spec_schema?: Json;
          is_active?: boolean;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          seller_id: string;
          category_id: string;
          title: string;
          specs: Json;
          quantity: number;
          unit: string;
          origin_location: string;
          available_from: string | null;
          available_to: string | null;
          unit_price: number;
          currency: string;
          incoterm: string;
          description: string | null;
          images: Json;
          status: "active" | "paused" | "sold_out";
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          category_id: string;
          title: string;
          specs?: Json;
          quantity: number;
          unit?: string;
          origin_location: string;
          available_from?: string | null;
          available_to?: string | null;
          unit_price: number;
          currency?: string;
          incoterm?: string;
          description?: string | null;
          images?: Json;
          status?: "active" | "paused" | "sold_out";
          created_at?: string;
        };
        Update: {
          category_id?: string;
          title?: string;
          specs?: Json;
          quantity?: number;
          unit?: string;
          origin_location?: string;
          available_from?: string | null;
          available_to?: string | null;
          unit_price?: number;
          currency?: string;
          incoterm?: string;
          description?: string | null;
          images?: Json;
          status?: "active" | "paused" | "sold_out";
        };
        Relationships: [];
      };
      inquiries: {
        Row: {
          id: string;
          buyer_id: string;
          seller_id: string;
          listing_id: string | null;
          category_id: string;
          requested_qty: number;
          target_price: number | null;
          destination: string | null;
          message: string | null;
          status: "pending" | "accepted" | "rejected" | "converted";
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          seller_id: string;
          listing_id?: string | null;
          category_id: string;
          requested_qty: number;
          target_price?: number | null;
          destination?: string | null;
          message?: string | null;
          status?: "pending" | "accepted" | "rejected" | "converted";
          created_at?: string;
        };
        Update: {
          status?: "pending" | "accepted" | "rejected" | "converted";
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_no: string;
          buyer_id: string;
          seller_id: string;
          listing_id: string;
          inquiry_id: string | null;
          quantity: number;
          unit_price: number;
          total_amount: number;
          currency: string;
          destination: string | null;
          shipment_from: string | null;
          shipment_eta: string | null;
          status: "draft" | "contract_generated" | "signed" | "payment_pending" | "paid" | "shipped" | "delivered" | "completed" | "disputed" | "cancelled";
          timeline: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_no?: string;
          buyer_id: string;
          seller_id: string;
          listing_id: string;
          inquiry_id?: string | null;
          quantity: number;
          unit_price: number;
          total_amount: number;
          currency: string;
          destination?: string | null;
          shipment_from?: string | null;
          shipment_eta?: string | null;
          status?: "draft" | "contract_generated" | "signed" | "payment_pending" | "paid" | "shipped" | "delivered" | "completed" | "disputed" | "cancelled";
          timeline?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "draft" | "contract_generated" | "signed" | "payment_pending" | "paid" | "shipped" | "delivered" | "completed" | "disputed" | "cancelled";
          timeline?: Json;
          shipment_from?: string | null;
          shipment_eta?: string | null;
          destination?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          order_id: string;
          contract_no: string;
          content_html: string;
          buyer_signed_url: string | null;
          seller_signed_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          contract_no: string;
          content_html: string;
          buyer_signed_url?: string | null;
          seller_signed_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          buyer_signed_url?: string | null;
          seller_signed_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          order_id: string;
          buyer_id: string;
          method: "usdt_trc20" | "usdt_erc20" | "usdi" | "mup" | "bank_transfer";
          amount: number;
          currency: string;
          tx_hash: string | null;
          proof_url: string | null;
          note: string | null;
          status: "pending" | "verified" | "rejected";
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          buyer_id: string;
          method: "usdt_trc20" | "usdt_erc20" | "usdi" | "mup" | "bank_transfer";
          amount: number;
          currency: string;
          tx_hash?: string | null;
          proof_url?: string | null;
          note?: string | null;
          status?: "pending" | "verified" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "pending" | "verified" | "rejected";
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      chat_rooms: {
        Row: {
          id: string;
          order_id: string | null;
          type: "order" | "support" | "ai";
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          type?: "order" | "support" | "ai";
          created_at?: string;
        };
        Update: {
          type?: "order" | "support" | "ai";
        };
        Relationships: [];
      };
      chat_members: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          joined_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          room_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [];
      };
      news: {
        Row: {
          id: string;
          title: string;
          slug: string;
          summary: string | null;
          content_html: string | null;
          cover_image_url: string | null;
          is_published: boolean;
          published_at: string | null;
          author_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          summary?: string | null;
          content_html?: string | null;
          cover_image_url?: string | null;
          is_published?: boolean;
          published_at?: string | null;
          author_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          slug?: string;
          summary?: string | null;
          content_html?: string | null;
          cover_image_url?: string | null;
          is_published?: boolean;
          published_at?: string | null;
          author_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          metadata?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, {
      Row: Record<string, unknown>;
      Relationships: [];
    }>;
    Functions: Record<string, {
      Args: Record<string, unknown>;
      Returns: unknown;
    }>;
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
