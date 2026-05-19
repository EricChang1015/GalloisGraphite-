export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_chat_logs: {
        Row: {
          city: string | null
          content: string
          country: string | null
          created_at: string
          id: string
          ip: string | null
          region: string | null
          role: string
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          content: string
          country?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          region?: string | null
          role: string
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          content?: string
          country?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          region?: string | null
          role?: string
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_members: {
        Row: {
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          type: Database["public"]["Enums"]["chat_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          type: Database["public"]["Enums"]["chat_type"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          type?: Database["public"]["Enums"]["chat_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          buyer_approved_at: string | null
          buyer_rejected_at: string | null
          buyer_reject_reason: string | null
          buyer_signed_at: string | null
          buyer_signed_url: string | null
          content_html: string | null
          contract_no: string
          created_at: string
          id: string
          order_id: string
          payment_due_days: number | null
          payment_terms: Database["public"]["Enums"]["payment_terms_type"] | null
          pdf_url: string | null
          revision_no: number
          seller_signed_at: string | null
          seller_signed_url: string | null
          updated_at: string
        }
        Insert: {
          buyer_approved_at?: string | null
          buyer_rejected_at?: string | null
          buyer_reject_reason?: string | null
          buyer_signed_at?: string | null
          buyer_signed_url?: string | null
          content_html?: string | null
          contract_no: string
          created_at?: string
          id?: string
          order_id: string
          payment_due_days?: number | null
          payment_terms?: Database["public"]["Enums"]["payment_terms_type"] | null
          pdf_url?: string | null
          revision_no?: number
          seller_signed_at?: string | null
          seller_signed_url?: string | null
          updated_at?: string
        }
        Update: {
          buyer_approved_at?: string | null
          buyer_rejected_at?: string | null
          buyer_reject_reason?: string | null
          buyer_signed_at?: string | null
          buyer_signed_url?: string | null
          content_html?: string | null
          contract_no?: string
          created_at?: string
          id?: string
          order_id?: string
          payment_due_days?: number | null
          payment_terms?: Database["public"]["Enums"]["payment_terms_type"] | null
          pdf_url?: string | null
          revision_no?: number
          seller_signed_at?: string | null
          seller_signed_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          buyer_id: string
          category_id: string
          created_at: string
          destination: string | null
          id: string
          listing_id: string | null
          message: string | null
          requested_qty: number
          seller_id: string
          status: Database["public"]["Enums"]["inquiry_status"]
          target_price: number | null
        }
        Insert: {
          buyer_id: string
          category_id: string
          created_at?: string
          destination?: string | null
          id?: string
          listing_id?: string | null
          message?: string | null
          requested_qty: number
          seller_id: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          target_price?: number | null
        }
        Update: {
          buyer_id?: string
          category_id?: string
          created_at?: string
          destination?: string | null
          id?: string
          listing_id?: string | null
          message?: string | null
          requested_qty?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["inquiry_status"]
          target_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          available_from: string | null
          available_to: string | null
          category_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          images: Json
          incoterm: string
          origin_location: string
          quantity: number
          seller_id: string
          specs: Json
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          unit: string
          unit_price: number
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          category_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          images?: Json
          incoterm?: string
          origin_location: string
          quantity: number
          seller_id: string
          specs?: Json
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          unit?: string
          unit_price: number
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          category_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          images?: Json
          incoterm?: string
          origin_location?: string
          quantity?: number
          seller_id?: string
          specs?: Json
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          content: string | null
          created_at: string
          id: string
          room_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          room_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author_id: string | null
          content: string | null
          content_html: string | null
          cover_image_url: string | null
          created_at: string
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string | null
          slug: string
          source_url: string | null
          summary: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          content_html?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          slug: string
          source_url?: string | null
          summary?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          content_html?: string | null
          cover_image_url?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          slug?: string
          source_url?: string | null
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          admin_note: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          is_required: boolean
          metadata: Json
          mime_type: string | null
          order_id: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_at: string
          uploaded_by: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_note?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_required?: boolean
          metadata?: Json
          mime_type?: string | null
          order_id: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_at?: string
          uploaded_by: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_note?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_required?: boolean
          metadata?: Json
          mime_type?: string | null
          order_id?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_at?: string
          uploaded_by?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          ata: string | null
          atd: string | null
          bl_date: string | null
          bl_no: string | null
          buyer_id: string
          container_numbers: string[] | null
          created_at: string
          currency: string
          current_quotation_id: string | null
          customs_cleared_at: string | null
          destination: string | null
          etd: string | null
          id: string
          inquiry_id: string | null
          listing_id: string
          order_no: string
          payment_due_date: string | null
          payment_due_days: number | null
          payment_terms: Database["public"]["Enums"]["payment_terms_type"] | null
          quantity: number
          seller_id: string
          shipment_eta: string | null
          shipment_from: string | null
          status: Database["public"]["Enums"]["order_status"]
          timeline: Json
          total_amount: number
          unit_price: number
          updated_at: string
          vessel_imo: string | null
          vessel_name: string | null
        }
        Insert: {
          ata?: string | null
          atd?: string | null
          bl_date?: string | null
          bl_no?: string | null
          buyer_id: string
          container_numbers?: string[] | null
          created_at?: string
          currency: string
          current_quotation_id?: string | null
          customs_cleared_at?: string | null
          destination?: string | null
          etd?: string | null
          id?: string
          inquiry_id?: string | null
          listing_id: string
          order_no?: string
          payment_due_date?: string | null
          payment_due_days?: number | null
          payment_terms?: Database["public"]["Enums"]["payment_terms_type"] | null
          quantity: number
          seller_id: string
          shipment_eta?: string | null
          shipment_from?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          timeline?: Json
          total_amount: number
          unit_price: number
          updated_at?: string
          vessel_imo?: string | null
          vessel_name?: string | null
        }
        Update: {
          ata?: string | null
          atd?: string | null
          bl_date?: string | null
          bl_no?: string | null
          buyer_id?: string
          container_numbers?: string[] | null
          created_at?: string
          currency?: string
          current_quotation_id?: string | null
          customs_cleared_at?: string | null
          destination?: string | null
          etd?: string | null
          id?: string
          inquiry_id?: string | null
          listing_id?: string
          order_no?: string
          payment_due_date?: string | null
          payment_due_days?: number | null
          payment_terms?: Database["public"]["Enums"]["payment_terms_type"] | null
          quantity?: number
          seller_id?: string
          shipment_eta?: string | null
          shipment_from?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          timeline?: Json
          total_amount?: number
          unit_price?: number
          updated_at?: string
          vessel_imo?: string | null
          vessel_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_current_quotation_id_fkey"
            columns: ["current_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          admin_note: string | null
          amount: number
          buyer_id: string
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          order_id: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_status"]
          tx_hash: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          admin_note?: string | null
          amount: number
          buyer_id: string
          created_at?: string
          currency: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          order_id: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tx_hash?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          admin_note?: string | null
          amount?: number
          buyer_id?: string
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          order_id?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          tx_hash?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          spec_schema: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          spec_schema?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          spec_schema?: Json
        }
        Relationships: []
      }
      quotations: {
        Row: {
          buyer_id: string
          countered_by: string | null
          created_at: string
          currency: string
          destination_port: string | null
          id: string
          incoterm: string
          inquiry_id: string | null
          listing_id: string | null
          notes: string | null
          origin_port: string | null
          parent_quotation_id: string | null
          quantity: number
          responded_at: string | null
          seller_id: string
          shipping_window_from: string | null
          shipping_window_to: string | null
          specs_confirmed: Json
          status: Database["public"]["Enums"]["quotation_status"]
          unit: string
          unit_price: number
          validity_until: string
        }
        Insert: {
          buyer_id: string
          countered_by?: string | null
          created_at?: string
          currency: string
          destination_port?: string | null
          id?: string
          incoterm: string
          inquiry_id?: string | null
          listing_id?: string | null
          notes?: string | null
          origin_port?: string | null
          parent_quotation_id?: string | null
          quantity: number
          responded_at?: string | null
          seller_id: string
          shipping_window_from?: string | null
          shipping_window_to?: string | null
          specs_confirmed?: Json
          status?: Database["public"]["Enums"]["quotation_status"]
          unit?: string
          unit_price: number
          validity_until: string
        }
        Update: {
          buyer_id?: string
          countered_by?: string | null
          created_at?: string
          currency?: string
          destination_port?: string | null
          id?: string
          incoterm?: string
          inquiry_id?: string | null
          listing_id?: string | null
          notes?: string | null
          origin_port?: string | null
          parent_quotation_id?: string | null
          quantity?: number
          responded_at?: string | null
          seller_id?: string
          shipping_window_from?: string | null
          shipping_window_to?: string | null
          specs_confirmed?: Json
          status?: Database["public"]["Enums"]["quotation_status"]
          unit?: string
          unit_price?: number
          validity_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_countered_by_fkey"
            columns: ["countered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_parent_quotation_id_fkey"
            columns: ["parent_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          kyc_docs: Json
          kyc_level: number
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          kyc_docs?: Json
          kyc_level?: number
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          kyc_docs?: Json
          kyc_level?: number
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
    }
    Enums: {
      chat_type: "order" | "support" | "ai"
      document_type:
        | "contract_signed_buyer"
        | "contract_signed_seller"
        | "proforma_invoice"
        | "commercial_invoice"
        | "packing_list"
        | "bill_of_lading"
        | "coa_sgs"
        | "cert_of_origin"
        | "insurance_policy"
        | "customs_declaration"
        | "payment_proof"
        | "inspection_report"
        | "other"
      inquiry_status:
        | "pending"
        | "quoted"
        | "negotiating"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
      listing_status: "active" | "paused" | "sold_out"
      order_status:
        | "quotation_pending"
        | "draft"
        | "quoted"
        | "negotiating"
        | "contract_pending"
        | "contract_generated"
        | "contract_signed"
        | "payment_pending"
        | "paid"
        | "in_production"
        | "ready_to_ship"
        | "shipped"
        | "in_transit"
        | "arrived"
        | "customs_cleared"
        | "completed"
        | "disputed"
        | "cancelled"
      payment_method:
        | "usdt_trc20"
        | "usdt_erc20"
        | "usdi"
        | "mup"
        | "bank_transfer"
      payment_status: "pending" | "verified" | "rejected"
      payment_terms_type: "full_prepay" | "net_after_arrival"
      quotation_status:
        | "sent"
        | "countered"
        | "accepted"
        | "rejected"
        | "expired"
        | "superseded"
      user_role: "buyer" | "seller" | "admin" | "super_admin"
      user_status: "pending" | "active" | "frozen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      chat_type: ["order", "support", "ai"],
      document_type: [
        "contract_signed_buyer",
        "contract_signed_seller",
        "proforma_invoice",
        "commercial_invoice",
        "packing_list",
        "bill_of_lading",
        "coa_sgs",
        "cert_of_origin",
        "insurance_policy",
        "customs_declaration",
        "payment_proof",
        "inspection_report",
        "other",
      ],
      inquiry_status: [
        "pending",
        "quoted",
        "negotiating",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
      listing_status: ["active", "paused", "sold_out"],
      order_status: [
        "quotation_pending",
        "draft",
        "quoted",
        "negotiating",
        "contract_pending",
        "contract_generated",
        "contract_signed",
        "payment_pending",
        "paid",
        "in_production",
        "ready_to_ship",
        "shipped",
        "in_transit",
        "arrived",
        "customs_cleared",
        "completed",
        "disputed",
        "cancelled",
      ],
      payment_method: [
        "usdt_trc20",
        "usdt_erc20",
        "usdi",
        "mup",
        "bank_transfer",
      ],
      payment_status: ["pending", "verified", "rejected"],
      payment_terms_type: ["full_prepay", "net_after_arrival"],
      quotation_status: [
        "sent",
        "countered",
        "accepted",
        "rejected",
        "expired",
        "superseded",
      ],
      user_role: ["buyer", "seller", "admin", "super_admin"],
      user_status: ["pending", "active", "frozen"],
    },
  },
} as const
