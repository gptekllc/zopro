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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      catalog_items: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          auto_apply_late_fees: boolean
          auto_archive_days: number
          auto_expire_quotes: boolean
          auto_send_invoice_reminders: boolean
          auto_send_job_scheduled_email: boolean
          brand_primary_color: string
          business_hours: Json | null
          city: string | null
          created_at: string
          custom_domain: string | null
          customer_portal_welcome_message: string | null
          default_job_duration: number
          default_job_priority: string
          default_payment_method: string | null
          default_quote_validity_days: number
          email: string | null
          email_invoice_body: string | null
          email_job_body: string | null
          email_on_new_job: boolean
          email_on_payment_received: boolean
          email_quote_body: string | null
          id: string
          invoice_next_number: number | null
          invoice_number_include_year: boolean
          invoice_number_padding: number
          invoice_number_prefix: string
          invoice_number_use_hyphens: boolean
          invoice_reminder_days: number
          job_next_number: number | null
          job_number_include_year: boolean
          job_number_padding: number
          job_number_prefix: string
          job_number_use_hyphens: boolean
          late_fee_percentage: number | null
          logo_url: string | null
          name: string
          notify_on_automation_run: boolean
          notify_on_job_assignment: boolean
          payment_terms_days: number | null
          pdf_footer_text: string | null
          pdf_show_invoice_photos: boolean
          pdf_show_job_photos: boolean
          pdf_show_line_item_details: boolean
          pdf_show_logo: boolean
          pdf_show_notes: boolean
          pdf_show_quote_photos: boolean
          pdf_show_signature: boolean
          pdf_terms_conditions: string | null
          phone: string | null
          platform_fee_percentage: number | null
          quote_next_number: number | null
          quote_number_include_year: boolean
          quote_number_padding: number
          quote_number_prefix: string
          quote_number_use_hyphens: boolean
          require_job_completion_signature: boolean
          require_mfa: boolean
          require_quote_signature: boolean
          send_weekly_summary: boolean
          state: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_onboarding_complete: boolean | null
          stripe_payments_enabled: boolean | null
          stripe_payouts_enabled: boolean | null
          tax_rate: number | null
          timeclock_allow_manual_labor_edit: boolean
          timeclock_auto_start_break_reminder: number | null
          timeclock_enforce_job_labor: boolean
          timeclock_max_shift_hours: number | null
          timeclock_require_job_selection: boolean
          timezone: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          auto_apply_late_fees?: boolean
          auto_archive_days?: number
          auto_expire_quotes?: boolean
          auto_send_invoice_reminders?: boolean
          auto_send_job_scheduled_email?: boolean
          brand_primary_color?: string
          business_hours?: Json | null
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          customer_portal_welcome_message?: string | null
          default_job_duration?: number
          default_job_priority?: string
          default_payment_method?: string | null
          default_quote_validity_days?: number
          email?: string | null
          email_invoice_body?: string | null
          email_job_body?: string | null
          email_on_new_job?: boolean
          email_on_payment_received?: boolean
          email_quote_body?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_number_include_year?: boolean
          invoice_number_padding?: number
          invoice_number_prefix?: string
          invoice_number_use_hyphens?: boolean
          invoice_reminder_days?: number
          job_next_number?: number | null
          job_number_include_year?: boolean
          job_number_padding?: number
          job_number_prefix?: string
          job_number_use_hyphens?: boolean
          late_fee_percentage?: number | null
          logo_url?: string | null
          name: string
          notify_on_automation_run?: boolean
          notify_on_job_assignment?: boolean
          payment_terms_days?: number | null
          pdf_footer_text?: string | null
          pdf_show_invoice_photos?: boolean
          pdf_show_job_photos?: boolean
          pdf_show_line_item_details?: boolean
          pdf_show_logo?: boolean
          pdf_show_notes?: boolean
          pdf_show_quote_photos?: boolean
          pdf_show_signature?: boolean
          pdf_terms_conditions?: string | null
          phone?: string | null
          platform_fee_percentage?: number | null
          quote_next_number?: number | null
          quote_number_include_year?: boolean
          quote_number_padding?: number
          quote_number_prefix?: string
          quote_number_use_hyphens?: boolean
          require_job_completion_signature?: boolean
          require_mfa?: boolean
          require_quote_signature?: boolean
          send_weekly_summary?: boolean
          state?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payments_enabled?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tax_rate?: number | null
          timeclock_allow_manual_labor_edit?: boolean
          timeclock_auto_start_break_reminder?: number | null
          timeclock_enforce_job_labor?: boolean
          timeclock_max_shift_hours?: number | null
          timeclock_require_job_selection?: boolean
          timezone?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          auto_apply_late_fees?: boolean
          auto_archive_days?: number
          auto_expire_quotes?: boolean
          auto_send_invoice_reminders?: boolean
          auto_send_job_scheduled_email?: boolean
          brand_primary_color?: string
          business_hours?: Json | null
          city?: string | null
          created_at?: string
          custom_domain?: string | null
          customer_portal_welcome_message?: string | null
          default_job_duration?: number
          default_job_priority?: string
          default_payment_method?: string | null
          default_quote_validity_days?: number
          email?: string | null
          email_invoice_body?: string | null
          email_job_body?: string | null
          email_on_new_job?: boolean
          email_on_payment_received?: boolean
          email_quote_body?: string | null
          id?: string
          invoice_next_number?: number | null
          invoice_number_include_year?: boolean
          invoice_number_padding?: number
          invoice_number_prefix?: string
          invoice_number_use_hyphens?: boolean
          invoice_reminder_days?: number
          job_next_number?: number | null
          job_number_include_year?: boolean
          job_number_padding?: number
          job_number_prefix?: string
          job_number_use_hyphens?: boolean
          late_fee_percentage?: number | null
          logo_url?: string | null
          name?: string
          notify_on_automation_run?: boolean
          notify_on_job_assignment?: boolean
          payment_terms_days?: number | null
          pdf_footer_text?: string | null
          pdf_show_invoice_photos?: boolean
          pdf_show_job_photos?: boolean
          pdf_show_line_item_details?: boolean
          pdf_show_logo?: boolean
          pdf_show_notes?: boolean
          pdf_show_quote_photos?: boolean
          pdf_show_signature?: boolean
          pdf_terms_conditions?: string | null
          phone?: string | null
          platform_fee_percentage?: number | null
          quote_next_number?: number | null
          quote_number_include_year?: boolean
          quote_number_padding?: number
          quote_number_prefix?: string
          quote_number_use_hyphens?: boolean
          require_job_completion_signature?: boolean
          require_mfa?: boolean
          require_quote_signature?: boolean
          send_weekly_summary?: boolean
          state?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payments_enabled?: boolean | null
          stripe_payouts_enabled?: boolean | null
          tax_rate?: number | null
          timeclock_allow_manual_labor_edit?: boolean
          timeclock_auto_start_break_reminder?: number | null
          timeclock_enforce_job_labor?: boolean
          timeclock_max_shift_hours?: number | null
          timeclock_require_job_selection?: boolean
          timezone?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      company_feature_overrides: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          enabled: boolean
          feature_key: string
          id: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          enabled: boolean
          feature_key: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_feature_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_social_links: {
        Row: {
          company_id: string
          created_at: string
          display_order: number
          icon_url: string | null
          id: string
          platform_name: string
          show_on_email: boolean
          show_on_invoice: boolean
          show_on_job: boolean
          show_on_quote: boolean
          updated_at: string
          url: string
        }
        Insert: {
          company_id: string
          created_at?: string
          display_order?: number
          icon_url?: string | null
          id?: string
          platform_name: string
          show_on_email?: boolean
          show_on_invoice?: boolean
          show_on_job?: boolean
          show_on_quote?: boolean
          updated_at?: string
          url: string
        }
        Update: {
          company_id?: string
          created_at?: string
          display_order?: number
          icon_url?: string | null
          id?: string
          platform_name?: string
          show_on_email?: boolean
          show_on_invoice?: boolean
          show_on_job?: boolean
          show_on_quote?: boolean
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_social_links_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_storage_usage: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invoice_photos_bytes: number
          job_photos_bytes: number
          last_calculated_at: string
          quote_photos_bytes: number
          total_bytes_used: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invoice_photos_bytes?: number
          job_photos_bytes?: number
          last_calculated_at?: string
          quote_photos_bytes?: number
          total_bytes_used?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invoice_photos_bytes?: number
          job_photos_bytes?: number
          last_calculated_at?: string
          quote_photos_bytes?: number
          total_bytes_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_storage_usage_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          company_id: string
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          company_id: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          company_id?: string
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_subscriptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_usage_limits: {
        Row: {
          company_id: string
          created_at: string
          id: string
          limit_key: string
          limit_value: number
          reason: string | null
          set_by: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          limit_key: string
          limit_value: number
          reason?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          limit_key?: string
          limit_value?: number
          reason?: string | null
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_usage_limits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_stripe_accounts: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string
          default_payment_method_last4: string | null
          default_payment_method_type: string | null
          has_saved_payment_method: boolean | null
          id: string
          stripe_customer_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          customer_id: string
          default_payment_method_last4?: string | null
          default_payment_method_type?: string | null
          has_saved_payment_method?: boolean | null
          id?: string
          stripe_customer_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string
          default_payment_method_last4?: string | null
          default_payment_method_type?: string | null
          has_saved_payment_method?: boolean | null
          id?: string
          stripe_customer_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_stripe_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_stripe_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          company_id: string | null
          created_at: string
          customer_id: string | null
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          recipient_email: string
          resend_id: string | null
          sender_email: string
          status: string
          subject: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email: string
          resend_id?: string | null
          sender_email?: string
          status?: string
          subject: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          customer_id?: string | null
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          recipient_email?: string
          resend_id?: string | null
          sender_email?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          item_description: string | null
          quantity: number
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          item_description?: string | null
          quantity?: number
          total?: number
          type?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          item_description?: string | null
          quantity?: number
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_photos: {
        Row: {
          caption: string | null
          created_at: string
          deleted_at: string | null
          display_order: number | null
          id: string
          invoice_id: string
          photo_type: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          invoice_id: string
          photo_type?: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          invoice_id?: string
          photo_type?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_photos_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_reminders: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_reminders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_reminders_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          discount_type: string | null
          discount_value: number | null
          due_date: string | null
          id: string
          invoice_number: string
          job_id: string | null
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          notes: string | null
          paid_at: string | null
          paid_online: boolean | null
          quote_id: string | null
          signature_id: string | null
          signed_at: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          job_id?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_online?: boolean | null
          quote_id?: string | null
          signature_id?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          job_id?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_online?: boolean | null
          quote_id?: string | null
          signature_id?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      job_activities: {
        Row: {
          activity_type: string
          company_id: string
          created_at: string
          id: string
          job_id: string
          new_value: string | null
          old_value: string | null
          performed_by: string | null
          related_document_id: string | null
        }
        Insert: {
          activity_type: string
          company_id: string
          created_at?: string
          id?: string
          job_id: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          related_document_id?: string | null
        }
        Update: {
          activity_type?: string
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          new_value?: string | null
          old_value?: string | null
          performed_by?: string | null
          related_document_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activities_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignees: {
        Row: {
          created_at: string
          id: string
          job_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignees_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_feedback_history: {
        Row: {
          action_type: string
          company_id: string
          created_at: string
          customer_id: string
          feedback_id: string | null
          id: string
          job_id: string
          new_feedback_text: string | null
          new_rating: number | null
          old_feedback_text: string | null
          old_rating: number | null
        }
        Insert: {
          action_type: string
          company_id: string
          created_at?: string
          customer_id: string
          feedback_id?: string | null
          id?: string
          job_id: string
          new_feedback_text?: string | null
          new_rating?: number | null
          old_feedback_text?: string | null
          old_rating?: number | null
        }
        Update: {
          action_type?: string
          company_id?: string
          created_at?: string
          customer_id?: string
          feedback_id?: string | null
          id?: string
          job_id?: string
          new_feedback_text?: string | null
          new_rating?: number | null
          old_feedback_text?: string | null
          old_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_feedback_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_feedback_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_feedback_history_feedback_id_fkey"
            columns: ["feedback_id"]
            isOneToOne: false
            referencedRelation: "job_feedbacks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_feedback_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_feedbacks: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          feedback_text: string | null
          id: string
          is_negative: boolean
          job_id: string
          rating: number
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          feedback_text?: string | null
          id?: string
          is_negative?: boolean
          job_id: string
          rating: number
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          feedback_text?: string | null
          id?: string
          is_negative?: boolean
          job_id?: string
          rating?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_feedbacks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_feedbacks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_feedbacks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_description: string | null
          job_id: string
          quantity: number
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_description?: string | null
          job_id: string
          quantity?: number
          total?: number
          type?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_description?: string | null
          job_id?: string
          quantity?: number
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_notifications: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          job_id: string
          notification_type: string
          recipient_email: string
          sent_at: string
          sent_by: string | null
          status_at_send: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          job_id: string
          notification_type?: string
          recipient_email: string
          sent_at?: string
          sent_by?: string | null
          status_at_send?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          job_id?: string
          notification_type?: string
          recipient_email?: string
          sent_at?: string
          sent_by?: string | null
          status_at_send?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_notifications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          caption: string | null
          created_at: string
          deleted_at: string | null
          display_order: number | null
          id: string
          job_id: string
          photo_type: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          job_id: string
          photo_type: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          job_id?: string
          photo_type?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_template_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_description: string | null
          quantity: number
          template_id: string
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_description?: string | null
          quantity?: number
          template_id: string
          total?: number
          type?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_description?: string | null
          quantity?: number
          template_id?: string
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "job_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_duration: number | null
          id: string
          name: string
          notes: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          title: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          name: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          title: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration?: number | null
          id?: string
          name?: string
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          archived_at: string | null
          assigned_to: string | null
          company_id: string
          completion_signature_id: string | null
          completion_signed_at: string | null
          completion_signed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          estimated_duration: number | null
          id: string
          job_number: string
          labor_hourly_rate: number | null
          notes: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          quote_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          status: Database["public"]["Enums"]["job_status"]
          subtotal: number | null
          tax: number | null
          title: string
          total: number | null
          updated_at: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          company_id: string
          completion_signature_id?: string | null
          completion_signed_at?: string | null
          completion_signed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          estimated_duration?: number | null
          id?: string
          job_number: string
          labor_hourly_rate?: number | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          quote_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          subtotal?: number | null
          tax?: number | null
          title: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          archived_at?: string | null
          assigned_to?: string | null
          company_id?: string
          completion_signature_id?: string | null
          completion_signed_at?: string | null
          completion_signed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          estimated_duration?: number | null
          id?: string
          job_number?: string
          labor_hourly_rate?: number | null
          notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          quote_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          subtotal?: number | null
          tax?: number | null
          title?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_completion_signature_id_fkey"
            columns: ["completion_signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_providers: {
        Row: {
          created_at: string | null
          description: string | null
          docs_url: string | null
          icon_bg_color: string | null
          icon_text: string | null
          id: string
          is_coming_soon: boolean | null
          is_enabled: boolean | null
          name: string
          provider_key: string
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          docs_url?: string | null
          icon_bg_color?: string | null
          icon_text?: string | null
          id?: string
          is_coming_soon?: boolean | null
          is_enabled?: boolean | null
          name: string
          provider_key: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          docs_url?: string | null
          icon_bg_color?: string | null
          icon_text?: string | null
          id?: string
          is_coming_soon?: boolean | null
          is_enabled?: boolean | null
          name?: string
          provider_key?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          payment_date: string
          recorded_by: string | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          status: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          method: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          payment_date?: string
          recorded_by?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_refunded_by_fkey"
            columns: ["refunded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_definitions: {
        Row: {
          allowed_roles: Json
          category: string
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          id: string
          permission_key: string
        }
        Insert: {
          allowed_roles?: Json
          category: string
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          id?: string
          permission_key: string
        }
        Update: {
          allowed_roles?: Json
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          id?: string
          permission_key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          email: string
          employment_status: string | null
          full_name: string | null
          hire_date: string | null
          hourly_rate: number | null
          id: string
          phone: string | null
          role: string
          state: string | null
          termination_date: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          employment_status?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id: string
          phone?: string | null
          role?: string
          state?: string | null
          termination_date?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          employment_status?: string | null
          full_name?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          role?: string
          state?: string | null
          termination_date?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_description: string | null
          quantity: number
          quote_id: string
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_description?: string | null
          quantity?: number
          quote_id: string
          total?: number
          type?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_description?: string | null
          quantity?: number
          quote_id?: string
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_photos: {
        Row: {
          caption: string | null
          created_at: string
          deleted_at: string | null
          display_order: number | null
          id: string
          photo_type: string
          photo_url: string
          quote_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          photo_type?: string
          photo_url: string
          quote_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          deleted_at?: string | null
          display_order?: number | null
          id?: string
          photo_type?: string
          photo_url?: string
          quote_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_photos_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_template_items: {
        Row: {
          created_at: string
          description: string
          id: string
          item_description: string | null
          quantity: number
          template_id: string
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          item_description?: string | null
          quantity?: number
          template_id: string
          total?: number
          type?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          item_description?: string | null
          quantity?: number
          template_id?: string
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
          valid_days: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          valid_days?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          valid_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          job_id: string | null
          notes: string | null
          quote_number: string
          signature_id: string | null
          signed_at: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          job_id?: string | null
          notes?: string | null
          quote_number: string
          signature_id?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          job_id?: string | null
          notes?: string | null
          quote_number?: string
          signature_id?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      role_default_permissions: {
        Row: {
          created_at: string
          default_enabled: boolean
          id: string
          permission_key: string
          role: string
        }
        Insert: {
          created_at?: string
          default_enabled?: boolean
          id?: string
          permission_key: string
          role: string
        }
        Update: {
          created_at?: string
          default_enabled?: boolean
          id?: string
          permission_key?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_default_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["permission_key"]
          },
        ]
      }
      signature_history: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          document_id: string
          document_type: string
          event_type: string
          id: string
          performed_by: string | null
          signature_id: string | null
          signer_name: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          document_id: string
          document_type: string
          event_type: string
          id?: string
          performed_by?: string | null
          signature_id?: string | null
          signer_name?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          document_id?: string
          document_type?: string
          event_type?: string
          id?: string
          performed_by?: string | null
          signature_id?: string | null
          signer_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_history_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_history_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          document_id: string
          document_type: string
          id: string
          signature_data: string
          signed_at: string
          signer_ip: string | null
          signer_name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          document_id: string
          document_type: string
          id?: string
          signature_data: string
          signed_at?: string
          signer_ip?: string | null
          signer_name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          document_id?: string
          document_type?: string
          id?: string
          signature_data?: string
          signed_at?: string
          signer_ip?: string | null
          signer_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          display_name: string
          features: Json | null
          id: string
          is_active: boolean | null
          max_jobs_per_month: number | null
          max_photos_per_document: number | null
          max_storage_gb: number | null
          max_users: number | null
          name: string
          price_monthly: number | null
          price_yearly: number | null
          storage_addon_price_per_gb: number | null
          storage_limit_bytes: number | null
          stripe_price_id_monthly: string | null
          stripe_price_id_yearly: string | null
          stripe_product_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_jobs_per_month?: number | null
          max_photos_per_document?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number | null
          price_yearly?: number | null
          storage_addon_price_per_gb?: number | null
          storage_limit_bytes?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_jobs_per_month?: number | null
          max_photos_per_document?: number | null
          max_storage_gb?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number | null
          price_yearly?: number | null
          storage_addon_price_per_gb?: number | null
          storage_limit_bytes?: number | null
          stripe_price_id_monthly?: string | null
          stripe_price_id_yearly?: string | null
          stripe_product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      super_admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          break_minutes: number | null
          break_start: string | null
          clock_in: string
          clock_out: string | null
          company_id: string
          created_at: string
          id: string
          is_on_break: boolean | null
          job_id: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          break_minutes?: number | null
          break_start?: string | null
          clock_in: string
          clock_out?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_on_break?: boolean | null
          job_id?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          break_minutes?: number | null
          break_start?: string | null
          clock_in?: string
          clock_out?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_on_break?: boolean | null
          job_id?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_name: string | null
          device_token: string
          expires_at: string
          id: string
          last_used_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string | null
          device_token: string
          expires_at: string
          id?: string
          last_used_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string | null
          device_token?: string
          expires_at?: string
          id?: string
          last_used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          permission_key: string
          reason: string | null
          set_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled: boolean
          id?: string
          permission_key: string
          reason?: string | null
          set_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key?: string
          reason?: string | null
          set_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permission_definitions"
            referencedColumns: ["permission_key"]
          },
          {
            foreignKeyName: "user_permissions_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_event_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_id: string | null
          event_type: string
          id: string
          original_event_id: string | null
          payload: Json | null
          processing_time_ms: number | null
          provider: string
          retry_count: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type: string
          id?: string
          original_event_id?: string | null
          payload?: Json | null
          processing_time_ms?: number | null
          provider: string
          retry_count?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string | null
          event_type?: string
          id?: string
          original_event_id?: string | null
          payload?: Json | null
          processing_time_ms?: number | null
          provider?: string
          retry_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_event_logs_original_event_id_fkey"
            columns: ["original_event_id"]
            isOneToOne: false
            referencedRelation: "webhook_event_logs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_super_admin_by_email: {
        Args: { _email: string }
        Returns: undefined
      }
      auto_archive_old_records: { Args: never; Returns: undefined }
      check_account_lockout: { Args: { check_email: string }; Returns: Json }
      check_trusted_device: {
        Args: { p_device_token: string; p_user_id: string }
        Returns: boolean
      }
      check_user_permission: {
        Args: { p_permission_key: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_expired_trusted_devices: { Args: never; Returns: number }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      create_company_and_set_admin: {
        Args: {
          _address?: string
          _city?: string
          _email?: string
          _name: string
          _phone?: string
          _state?: string
          _zip?: string
        }
        Returns: {
          company_id: string
        }[]
      }
      create_customer_from_auth_user: {
        Args: { _email: string; _name: string }
        Returns: string
      }
      create_default_email_templates: {
        Args: { _company_id: string; _created_by?: string }
        Returns: undefined
      }
      generate_invoice_number: {
        Args: { p_company_id: string }
        Returns: string
      }
      generate_job_number: { Args: { p_company_id: string }; Returns: string }
      generate_quote_number: { Args: { p_company_id: string }; Returns: string }
      get_company_for_user: {
        Args: { _company_id: string }
        Returns: {
          address: string
          auto_apply_late_fees: boolean
          auto_archive_days: number
          auto_expire_quotes: boolean
          auto_send_invoice_reminders: boolean
          auto_send_job_scheduled_email: boolean
          brand_primary_color: string
          business_hours: Json
          city: string
          created_at: string
          custom_domain: string
          customer_portal_welcome_message: string
          default_job_duration: number
          default_job_priority: string
          default_payment_method: string
          default_quote_validity_days: number
          email: string
          email_invoice_body: string
          email_job_body: string
          email_on_new_job: boolean
          email_on_payment_received: boolean
          email_quote_body: string
          id: string
          invoice_next_number: number
          invoice_number_include_year: boolean
          invoice_number_padding: number
          invoice_number_prefix: string
          invoice_number_use_hyphens: boolean
          invoice_reminder_days: number
          job_next_number: number
          job_number_include_year: boolean
          job_number_padding: number
          job_number_prefix: string
          job_number_use_hyphens: boolean
          late_fee_percentage: number
          logo_url: string
          name: string
          notify_on_automation_run: boolean
          notify_on_job_assignment: boolean
          payment_terms_days: number
          pdf_footer_text: string
          pdf_show_invoice_photos: boolean
          pdf_show_job_photos: boolean
          pdf_show_line_item_details: boolean
          pdf_show_logo: boolean
          pdf_show_notes: boolean
          pdf_show_quote_photos: boolean
          pdf_show_signature: boolean
          pdf_terms_conditions: string
          phone: string
          platform_fee_percentage: number
          quote_next_number: number
          quote_number_include_year: boolean
          quote_number_padding: number
          quote_number_prefix: string
          quote_number_use_hyphens: boolean
          require_job_completion_signature: boolean
          require_mfa: boolean
          require_quote_signature: boolean
          send_weekly_summary: boolean
          state: string
          stripe_account_id: string
          stripe_charges_enabled: boolean
          stripe_onboarding_complete: boolean
          stripe_payments_enabled: boolean
          stripe_payouts_enabled: boolean
          tax_rate: number
          timeclock_allow_manual_labor_edit: boolean
          timeclock_auto_start_break_reminder: number
          timeclock_enforce_job_labor: boolean
          timeclock_max_shift_hours: number
          timeclock_require_job_selection: boolean
          timezone: string
          updated_at: string
          website: string
          zip: string
        }[]
      }
      get_deleted_documents: {
        Args: { p_company_id: string }
        Returns: {
          customer_name: string
          deleted_at: string
          document_number: string
          document_type: string
          id: string
          permanent_delete_at: string
          photo_url: string
          title: string
          total: number
        }[]
      }
      get_effective_limit: {
        Args: { p_company_id: string; p_limit_key: string }
        Returns: number
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      hard_delete_auth_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_storage_usage: {
        Args: { p_bytes: number; p_company_id: string; p_type: string }
        Returns: undefined
      }
      is_company_admin: { Args: { _user_id: string }; Returns: boolean }
      permanent_delete_document: {
        Args: { p_document_id: string; p_table_name: string }
        Returns: boolean
      }
      permanent_delete_old_soft_deleted_records: {
        Args: never
        Returns: {
          customers_deleted: number
          invoices_deleted: number
          jobs_deleted: number
          photos_deleted: number
          quotes_deleted: number
          users_deleted: number
        }[]
      }
      recalculate_company_storage: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      record_login_attempt: {
        Args: {
          attempt_email: string
          attempt_ip?: string
          attempt_success: boolean
        }
        Returns: undefined
      }
      restore_deleted_document: {
        Args: { p_document_id: string; p_table_name: string }
        Returns: boolean
      }
      sync_invoice_status_for_invoice: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      users_in_same_company: {
        Args: { _user_id1: string; _user_id2: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "technician" | "super_admin" | "manager" | "customer"
      job_priority: "low" | "medium" | "high" | "urgent"
      job_status:
        | "draft"
        | "scheduled"
        | "in_progress"
        | "completed"
        | "invoiced"
        | "paid"
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
      app_role: ["admin", "technician", "super_admin", "manager", "customer"],
      job_priority: ["low", "medium", "high", "urgent"],
      job_status: [
        "draft",
        "scheduled",
        "in_progress",
        "completed",
        "invoiced",
        "paid",
      ],
    },
  },
} as const
