export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          deal_id: string | null
          id: string
          organization_id: string
          reason: string | null
          source: string
          visibility: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          deal_id?: string | null
          id?: string
          organization_id: string
          reason?: string | null
          source?: string
          visibility?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          deal_id?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          source?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_prices: {
        Row: {
          amount: number | null
          organization_id: string
          service_id: string
        }
        Insert: {
          amount?: number | null
          organization_id: string
          service_id: string
        }
        Update: {
          amount?: number | null
          organization_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_prices_organization_id_service_id_fkey"
            columns: ["organization_id", "service_id"]
            isOneToOne: true
            referencedRelation: "service_catalog"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contacts: {
        Row: {
          customer_id: string
          email: string | null
          external_id: string
          id: string
          name: string | null
          organization_id: string
          phone: string | null
          version: number
        }
        Insert: {
          customer_id: string
          email?: string | null
          external_id: string
          id?: string
          name?: string | null
          organization_id: string
          phone?: string | null
          version?: number
        }
        Update: {
          customer_id?: string
          email?: string | null
          external_id?: string
          id?: string
          name?: string | null
          organization_id?: string
          phone?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contract_periods: {
        Row: {
          attempts: number
          contract_id: string
          deal_id: string | null
          id: string
          last_error: string | null
          organization_id: string
          period_end: string
          period_start: string
          revision_id: string
          service_last_day: string | null
          status: string
          template_snapshot: Json
        }
        Insert: {
          attempts?: number
          contract_id: string
          deal_id?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          period_end: string
          period_start: string
          revision_id: string
          service_last_day?: string | null
          status?: string
          template_snapshot: Json
        }
        Update: {
          attempts?: number
          contract_id?: string
          deal_id?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          period_end?: string
          period_start?: string
          revision_id?: string
          service_last_day?: string | null
          status?: string
          template_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_periods_organization_id_contract_id_fkey"
            columns: ["organization_id", "contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contract_periods_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: true
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contract_periods_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "contract_periods_organization_id_revision_id_fkey"
            columns: ["organization_id", "revision_id"]
            isOneToOne: false
            referencedRelation: "contract_revisions"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      contract_revisions: {
        Row: {
          contract_id: string
          effective_at: string
          id: string
          organization_id: string
          reason: string | null
          settings: Json
          version: number
        }
        Insert: {
          contract_id: string
          effective_at: string
          id?: string
          organization_id: string
          reason?: string | null
          settings: Json
          version: number
        }
        Update: {
          contract_id?: string
          effective_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          settings?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_revisions_organization_id_contract_id_fkey"
            columns: ["organization_id", "contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          member_id: string
          organization_id: string
          read_at: string | null
          removed_at: string | null
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          member_id: string
          organization_id: string
          read_at?: string | null
          removed_at?: string | null
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          member_id?: string
          organization_id?: string
          read_at?: string | null
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversation_members_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          organization_id: string
          title: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          organization_id: string
          title: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          organization_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_locations: {
        Row: {
          address: string | null
          customer_id: string
          external_id: string
          id: string
          latitude: number | null
          longitude: number | null
          manual_pin: boolean
          name: string | null
          organization_id: string
          version: number
        }
        Insert: {
          address?: string | null
          customer_id: string
          external_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          manual_pin?: boolean
          name?: string | null
          organization_id: string
          version?: number
        }
        Update: {
          address?: string | null
          customer_id?: string
          external_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          manual_pin?: boolean
          name?: string | null
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_locations_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      customers: {
        Row: {
          archived: boolean
          category: string | null
          created_at: string
          external_id: string
          id: string
          name: string
          note: string | null
          organization_id: string
          version: number
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_at?: string
          external_id: string
          id?: string
          name: string
          note?: string | null
          organization_id: string
          version?: number
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_at?: string
          external_id?: string
          id?: string
          name?: string
          note?: string | null
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_comments: {
        Row: {
          actor_id: string
          body: string
          created_at: string
          deal_id: string
          id: string
          mentions: string[]
          organization_id: string
        }
        Insert: {
          actor_id: string
          body: string
          created_at?: string
          deal_id: string
          id?: string
          mentions?: string[]
          organization_id: string
        }
        Update: {
          actor_id?: string
          body?: string
          created_at?: string
          deal_id?: string
          id?: string
          mentions?: string[]
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_comments_organization_id_actor_id_fkey"
            columns: ["organization_id", "actor_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deal_comments_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deal_comments_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      deal_members: {
        Row: {
          deal_id: string
          member_id: string
          organization_id: string
        }
        Insert: {
          deal_id: string
          member_id: string
          organization_id: string
        }
        Update: {
          deal_id?: string
          member_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_members_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deal_members_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deal_members_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      deals: {
        Row: {
          accountable_id: string | null
          archived: boolean
          completion_reason: string | null
          created_at: string
          created_by: string | null
          creation_source: string
          customer_id: string | null
          delivered_at: string | null
          due_at: string | null
          first_confirmed_at: string | null
          id: string
          intake: Json | null
          intake_department_id: string | null
          location_id: string | null
          loss_reason_id: string | null
          open_work_snapshot: string[]
          organization_id: string
          pipeline: string
          rank: number
          serial: string
          stage: string
          title: string | null
          version: number
          zero_reason: string | null
        }
        Insert: {
          accountable_id?: string | null
          archived?: boolean
          completion_reason?: string | null
          created_at?: string
          created_by?: string | null
          creation_source: string
          customer_id?: string | null
          delivered_at?: string | null
          due_at?: string | null
          first_confirmed_at?: string | null
          id?: string
          intake?: Json | null
          intake_department_id?: string | null
          location_id?: string | null
          loss_reason_id?: string | null
          open_work_snapshot?: string[]
          organization_id: string
          pipeline?: string
          rank?: number
          serial: string
          stage?: string
          title?: string | null
          version?: number
          zero_reason?: string | null
        }
        Update: {
          accountable_id?: string | null
          archived?: boolean
          completion_reason?: string | null
          created_at?: string
          created_by?: string | null
          creation_source?: string
          customer_id?: string | null
          delivered_at?: string | null
          due_at?: string | null
          first_confirmed_at?: string | null
          id?: string
          intake?: Json | null
          intake_department_id?: string | null
          location_id?: string | null
          loss_reason_id?: string | null
          open_work_snapshot?: string[]
          organization_id?: string
          pipeline?: string
          rank?: number
          serial?: string
          stage?: string
          title?: string | null
          version?: number
          zero_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_organization_id_accountable_id_fkey"
            columns: ["organization_id", "accountable_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_intake_department_id_fkey"
            columns: ["organization_id", "intake_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "customer_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_loss_reason_id_fkey"
            columns: ["organization_id", "loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_stage_fkey"
            columns: ["organization_id", "stage"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "code"]
          },
        ]
      }
      department_members: {
        Row: {
          department_id: string
          member_id: string
          organization_id: string
        }
        Insert: {
          department_id: string
          member_id: string
          organization_id: string
        }
        Update: {
          department_id?: string
          member_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_members_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "department_members_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      departments: {
        Row: {
          archived: boolean
          id: string
          name: string
          organization_id: string
          version: number
        }
        Insert: {
          archived?: boolean
          id?: string
          name: string
          organization_id: string
          version?: number
        }
        Update: {
          archived?: boolean
          id?: string
          name?: string
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          filters: Json
          format: string
          id: string
          last_error: string | null
          module: string
          organization_id: string
          request_id: string
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at?: string
          filters?: Json
          format: string
          id?: string
          last_error?: string | null
          module: string
          organization_id: string
          request_id: string
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          filters?: Json
          format?: string
          id?: string
          last_error?: string | null
          module?: string
          organization_id?: string
          request_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          archived: boolean
          as_of: string
          id: string
          kind: string
          name: string
          opening_amount: number
          organization_id: string
          version: number
        }
        Insert: {
          archived?: boolean
          as_of?: string
          id?: string
          kind: string
          name: string
          opening_amount?: number
          organization_id: string
          version?: number
        }
        Update: {
          archived?: boolean
          as_of?: string
          id?: string
          kind?: string
          name?: string
          opening_amount?: number
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_documents: {
        Row: {
          actor_id: string | null
          amount: number
          category: string | null
          counterparty: string | null
          created_at: string
          customer_id: string | null
          deal_id: string | null
          due_date: string | null
          id: string
          kind: string
          linked_id: string | null
          organization_id: string
          reason: string | null
          source_key: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          category?: string | null
          counterparty?: string | null
          created_at?: string
          customer_id?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          kind: string
          linked_id?: string | null
          organization_id: string
          reason?: string | null
          source_key: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          category?: string | null
          counterparty?: string | null
          created_at?: string
          customer_id?: string | null
          deal_id?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          linked_id?: string | null
          organization_id?: string
          reason?: string | null
          source_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_documents_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "financial_documents_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "financial_documents_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "financial_documents_organization_id_linked_id_fkey"
            columns: ["organization_id", "linked_id"]
            isOneToOne: false
            referencedRelation: "financial_documents"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string
          cursor: number
          errors: Json
          file_hash: string
          id: string
          mapping: Json
          organization_id: string
          rows: Json
          status: string
          storage_path: string | null
          version: number
          worker_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          cursor?: number
          errors?: Json
          file_hash: string
          id?: string
          mapping: Json
          organization_id: string
          rows: Json
          status?: string
          storage_path?: string | null
          version?: number
          worker_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          cursor?: number
          errors?: Json
          file_hash?: string
          id?: string
          mapping?: Json
          organization_id?: string
          rows?: Json
          status?: string
          storage_path?: string | null
          version?: number
          worker_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          organization_id: string
          revoked_at: string | null
          token_hash: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          organization_id: string
          revoked_at?: string | null
          token_hash: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          revoked_at?: string | null
          token_hash?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          locked_until: string | null
          organization_id: string
          payload: Json
          result: Json | null
          run_after: string
          status: string
          type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          organization_id: string
          payload?: Json
          result?: Json | null
          run_after?: string
          status?: string
          type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          organization_id?: string
          payload?: Json
          result?: Json | null
          run_after?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          archived: boolean
          id: string
          name: string
          organization_id: string
          version: number
        }
        Insert: {
          archived?: boolean
          id?: string
          name: string
          organization_id: string
          version?: number
        }
        Update: {
          archived?: boolean
          id?: string
          name?: string
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          meeting_id: string
          member_id: string
          organization_id: string
        }
        Insert: {
          meeting_id: string
          member_id: string
          organization_id: string
        }
        Update: {
          meeting_id?: string
          member_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_organization_id_meeting_id_fkey"
            columns: ["organization_id", "meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "meeting_participants_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      meetings: {
        Row: {
          agenda: string | null
          cancelled: boolean
          created_by: string
          customer_id: string | null
          deal_id: string | null
          ends_at: string
          id: string
          kind: string
          location: string | null
          organization_id: string
          outcome: string | null
          starts_at: string
          title: string
          url: string | null
          version: number
        }
        Insert: {
          agenda?: string | null
          cancelled?: boolean
          created_by: string
          customer_id?: string | null
          deal_id?: string | null
          ends_at: string
          id?: string
          kind: string
          location?: string | null
          organization_id: string
          outcome?: string | null
          starts_at: string
          title: string
          url?: string | null
          version?: number
        }
        Update: {
          agenda?: string | null
          cancelled?: boolean
          created_by?: string
          customer_id?: string | null
          deal_id?: string | null
          ends_at?: string
          id?: string
          kind?: string
          location?: string | null
          organization_id?: string
          outcome?: string | null
          starts_at?: string
          title?: string
          url?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "meetings_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "meetings_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "meetings_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "meetings_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      memberships: {
        Row: {
          avatar_path: string | null
          id: string
          is_admin: boolean
          joined_at: string
          name: string
          organization_id: string
          overrides: Json
          role_id: string | null
          skills: string[]
          status: string
          user_id: string
          version: number
        }
        Insert: {
          avatar_path?: string | null
          id?: string
          is_admin?: boolean
          joined_at?: string
          name: string
          organization_id: string
          overrides?: Json
          role_id?: string | null
          skills?: string[]
          status?: string
          user_id: string
          version?: number
        }
        Update: {
          avatar_path?: string | null
          id?: string
          is_admin?: boolean
          joined_at?: string
          name?: string
          organization_id?: string
          overrides?: Json
          role_id?: string | null
          skills?: string[]
          status?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_role_id_fkey"
            columns: ["organization_id", "role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          body: string
          conversation_id: string
          created_at: string
          deleted: boolean
          id: string
          organization_id: string
          version: number
        }
        Insert: {
          author_id: string
          body: string
          conversation_id: string
          created_at?: string
          deleted?: boolean
          id?: string
          organization_id: string
          version?: number
        }
        Update: {
          author_id?: string
          body?: string
          conversation_id?: string
          created_at?: string
          deleted?: boolean
          id?: string
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "messages_organization_id_author_id_fkey"
            columns: ["organization_id", "author_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "messages_organization_id_conversation_id_fkey"
            columns: ["organization_id", "conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          deal_id: string | null
          event_key: string
          id: string
          label: string
          organization_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string
          deal_id?: string | null
          event_key: string
          id?: string
          label: string
          organization_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string | null
          event_key?: string
          id?: string
          label?: string
          organization_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notifications_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "notifications_organization_id_recipient_id_fkey"
            columns: ["organization_id", "recipient_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          join_token: string
          logo_path: string | null
          name: string
          slug: string
          timezone: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          join_token?: string
          logo_path?: string | null
          name: string
          slug: string
          timezone?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          join_token?: string
          logo_path?: string | null
          name?: string
          slug?: string
          timezone?: string
          version?: number
        }
        Relationships: []
      }
      outbox_events: {
        Row: {
          created_at: string
          delivered_at: string | null
          entity_id: string | null
          id: string
          organization_id: string
          topic: string
          version: number
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          id?: string
          organization_id: string
          topic: string
          version?: number
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          entity_id?: string | null
          id?: string
          organization_id?: string
          topic?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "outbox_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          document_id: string
          id: string
          organization_id: string
          payment_id: string
          reversal_of: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          document_id: string
          id?: string
          organization_id: string
          payment_id: string
          reversal_of?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          document_id?: string
          id?: string
          organization_id?: string
          payment_id?: string
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "financial_documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_payment_id_fkey"
            columns: ["organization_id", "payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_reversal_of_fkey"
            columns: ["organization_id", "reversal_of"]
            isOneToOne: true
            referencedRelation: "payment_allocations"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string
          actor_id: string
          amount: number
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          method: string
          note: string | null
          organization_id: string
          payment_date: string
          reason: string | null
          receipt_url: string | null
          reversed_payment_id: string | null
          version: number
        }
        Insert: {
          account_id: string
          actor_id: string
          amount: number
          created_at?: string
          customer_id?: string | null
          direction: string
          id?: string
          method?: string
          note?: string | null
          organization_id: string
          payment_date: string
          reason?: string | null
          receipt_url?: string | null
          reversed_payment_id?: string | null
          version?: number
        }
        Update: {
          account_id?: string
          actor_id?: string
          amount?: number
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          method?: string
          note?: string | null
          organization_id?: string
          payment_date?: string
          reason?: string | null
          receipt_url?: string | null
          reversed_payment_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_account_id_fkey"
            columns: ["organization_id", "account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "payments_organization_id_reversed_payment_id_fkey"
            columns: ["organization_id", "reversed_payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          code: string
          color: string
          label: string
          organization_id: string
          pipeline: string
          position: number
          version: number
        }
        Insert: {
          code: string
          color?: string
          label: string
          organization_id: string
          pipeline: string
          position: number
          version?: number
        }
        Update: {
          code?: string
          color?: string
          label?: string
          organization_id?: string
          pipeline?: string
          position?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_items: {
        Row: {
          deal_id: string
          id: string
          organization_id: string
          status: string
        }
        Insert: {
          deal_id: string
          id?: string
          organization_id: string
          status: string
        }
        Update: {
          deal_id?: string
          id?: string
          organization_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_items_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: true
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "portfolio_items_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      resource_links: {
        Row: {
          archived: boolean
          category: string | null
          created_by: string
          deal_id: string
          id: string
          organization_id: string
          provider: string
          title: string
          url: string
          version: number
        }
        Insert: {
          archived?: boolean
          category?: string | null
          created_by: string
          deal_id: string
          id?: string
          organization_id: string
          provider?: string
          title: string
          url: string
          version?: number
        }
        Update: {
          archived?: boolean
          category?: string | null
          created_by?: string
          deal_id?: string
          id?: string
          organization_id?: string
          provider?: string
          title?: string
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_links_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "resource_links_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "resource_links_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      roles: {
        Row: {
          archived: boolean
          id: string
          name: string
          organization_id: string
          permissions: string[]
          version: number
        }
        Insert: {
          archived?: boolean
          id?: string
          name: string
          organization_id: string
          permissions?: string[]
          version?: number
        }
        Update: {
          archived?: boolean
          id?: string
          name?: string
          organization_id?: string
          permissions?: string[]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_catalog: {
        Row: {
          archived: boolean
          department_id: string
          description: string | null
          id: string
          name: string
          organization_id: string
          task_templates: Json
          version: number
        }
        Insert: {
          archived?: boolean
          department_id: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
          task_templates?: Json
          version?: number
        }
        Update: {
          archived?: boolean
          department_id?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          task_templates?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          billing_day: number
          category: string
          created_at: string
          customer_id: string
          end_date: string | null
          first_payment_date: string
          id: string
          next_period_start: string
          organization_id: string
          proration_policy: string
          service_last_day: string | null
          source_deal_id: string | null
          status: string
          title: string
          version: number
        }
        Insert: {
          billing_day: number
          category?: string
          created_at?: string
          customer_id: string
          end_date?: string | null
          first_payment_date: string
          id?: string
          next_period_start: string
          organization_id: string
          proration_policy?: string
          service_last_day?: string | null
          source_deal_id?: string | null
          status?: string
          title: string
          version?: number
        }
        Update: {
          billing_day?: number
          category?: string
          created_at?: string
          customer_id?: string
          end_date?: string | null
          first_payment_date?: string
          id?: string
          next_period_start?: string
          organization_id?: string
          proration_policy?: string
          service_last_day?: string | null
          source_deal_id?: string | null
          status?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "service_contracts_organization_id_source_deal_id_fkey"
            columns: ["organization_id", "source_deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "service_contracts_organization_id_source_deal_id_fkey"
            columns: ["organization_id", "source_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      tool_reservations: {
        Row: {
          cancelled: boolean
          checked_out_at: string | null
          ends_at: string
          id: string
          member_id: string
          organization_id: string
          quantity: number
          returned_at: string | null
          starts_at: string
          tool_id: string
          unit_number: number | null
          version: number
        }
        Insert: {
          cancelled?: boolean
          checked_out_at?: string | null
          ends_at: string
          id?: string
          member_id: string
          organization_id: string
          quantity?: number
          returned_at?: string | null
          starts_at: string
          tool_id: string
          unit_number?: number | null
          version?: number
        }
        Update: {
          cancelled?: boolean
          checked_out_at?: string | null
          ends_at?: string
          id?: string
          member_id?: string
          organization_id?: string
          quantity?: number
          returned_at?: string | null
          starts_at?: string
          tool_id?: string
          unit_number?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tool_reservations_organization_id_member_id_fkey"
            columns: ["organization_id", "member_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "tool_reservations_organization_id_tool_id_fkey"
            columns: ["organization_id", "tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      tool_units: {
        Row: {
          organization_id: string
          state: string
          tool_id: string
          unit_number: number
          version: number
        }
        Insert: {
          organization_id: string
          state?: string
          tool_id: string
          unit_number: number
          version?: number
        }
        Update: {
          organization_id?: string
          state?: string
          tool_id?: string
          unit_number?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tool_units_organization_id_tool_id_fkey"
            columns: ["organization_id", "tool_id"]
            isOneToOne: false
            referencedRelation: "tools"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      tools: {
        Row: {
          capacity: number
          id: string
          kind: string
          name: string
          organization_id: string
          state: string
          version: number
        }
        Insert: {
          capacity: number
          id?: string
          kind: string
          name: string
          organization_id: string
          state?: string
          version?: number
        }
        Update: {
          capacity?: number
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          state?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          default_admin_id: string
          department_id: string
          enabled: boolean
          id: string
          name: string
          organization_id: string
          version: number
        }
        Insert: {
          default_admin_id: string
          department_id: string
          enabled?: boolean
          id?: string
          name: string
          organization_id: string
          version?: number
        }
        Update: {
          default_admin_id?: string
          department_id?: string
          enabled?: boolean
          id?: string
          name?: string
          organization_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_default_admin_id_fkey"
            columns: ["organization_id", "default_admin_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "webhook_endpoints_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          deal_id: string | null
          endpoint_id: string
          external_event_id: string
          id: string
          last_error: string | null
          organization_id: string
          payload: Json
          payload_hash: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deal_id?: string | null
          endpoint_id: string
          external_event_id: string
          id?: string
          last_error?: string | null
          organization_id: string
          payload: Json
          payload_hash: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deal_id?: string | null
          endpoint_id?: string
          external_event_id?: string
          id?: string
          last_error?: string | null
          organization_id?: string
          payload?: Json
          payload_hash?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_endpoint_id_fkey"
            columns: ["organization_id", "endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      work_items: {
        Row: {
          archived: boolean
          assignee_id: string | null
          billing_interval: string
          catalog_id: string | null
          catalog_snapshot: Json | null
          created_at: string
          deal_id: string
          department_id: string
          description: string | null
          due_at: string | null
          ends_at: string | null
          id: string
          kind: string
          name: string
          organization_id: string
          parent_service_id: string | null
          quantity: number
          starts_at: string | null
          status: string
          version: number
        }
        Insert: {
          archived?: boolean
          assignee_id?: string | null
          billing_interval?: string
          catalog_id?: string | null
          catalog_snapshot?: Json | null
          created_at?: string
          deal_id: string
          department_id: string
          description?: string | null
          due_at?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          name: string
          organization_id: string
          parent_service_id?: string | null
          quantity?: number
          starts_at?: string | null
          status?: string
          version?: number
        }
        Update: {
          archived?: boolean
          assignee_id?: string | null
          billing_interval?: string
          catalog_id?: string | null
          catalog_snapshot?: Json | null
          created_at?: string
          deal_id?: string
          department_id?: string
          description?: string | null
          due_at?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          name?: string
          organization_id?: string
          parent_service_id?: string | null
          quantity?: number
          starts_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "work_items_organization_id_assignee_id_fkey"
            columns: ["organization_id", "assignee_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_items_organization_id_catalog_id_fkey"
            columns: ["organization_id", "catalog_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_items_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_items_organization_id_deal_id_fkey"
            columns: ["organization_id", "deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "work_items_organization_id_deal_id_parent_service_id_fkey"
            columns: ["organization_id", "deal_id", "parent_service_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["organization_id", "deal_id", "id"]
          },
          {
            foreignKeyName: "work_items_organization_id_department_id_fkey"
            columns: ["organization_id", "department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      work_prices: {
        Row: {
          amount: number | null
          organization_id: string
          work_id: string
        }
        Insert: {
          amount?: number | null
          organization_id: string
          work_id: string
        }
        Update: {
          amount?: number | null
          organization_id?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_prices_organization_id_work_id_fkey"
            columns: ["organization_id", "work_id"]
            isOneToOne: true
            referencedRelation: "work_items"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      deal_cards: {
        Row: {
          accountable_id: string | null
          archived: boolean | null
          commercial: Json | null
          completion_reason: string | null
          created_at: string | null
          created_by: string | null
          creation_source: string | null
          customer_id: string | null
          delivered_at: string | null
          display_stage: string | null
          due_at: string | null
          first_confirmed_at: string | null
          id: string | null
          intake: Json | null
          intake_department_id: string | null
          location_id: string | null
          loss_reason_id: string | null
          open_work_snapshot: string[] | null
          organization_id: string | null
          pipeline: string | null
          rank: number | null
          serial: string | null
          stage: string | null
          title: string | null
          version: number | null
          zero_reason: string | null
        }
        Insert: {
          accountable_id?: string | null
          archived?: boolean | null
          commercial?: never
          completion_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_source?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          display_stage?: never
          due_at?: string | null
          first_confirmed_at?: string | null
          id?: string | null
          intake?: Json | null
          intake_department_id?: string | null
          location_id?: string | null
          loss_reason_id?: string | null
          open_work_snapshot?: string[] | null
          organization_id?: string | null
          pipeline?: string | null
          rank?: number | null
          serial?: string | null
          stage?: string | null
          title?: string | null
          version?: number | null
          zero_reason?: string | null
        }
        Update: {
          accountable_id?: string | null
          archived?: boolean | null
          commercial?: never
          completion_reason?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_source?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          display_stage?: never
          due_at?: string | null
          first_confirmed_at?: string | null
          id?: string | null
          intake?: Json | null
          intake_department_id?: string | null
          location_id?: string | null
          loss_reason_id?: string | null
          open_work_snapshot?: string[] | null
          organization_id?: string | null
          pipeline?: string | null
          rank?: number | null
          serial?: string | null
          stage?: string | null
          title?: string | null
          version?: number | null
          zero_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_organization_id_accountable_id_fkey"
            columns: ["organization_id", "accountable_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_created_by_fkey"
            columns: ["organization_id", "created_by"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organization_id_intake_department_id_fkey"
            columns: ["organization_id", "intake_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_location_id_fkey"
            columns: ["organization_id", "location_id"]
            isOneToOne: false
            referencedRelation: "customer_locations"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_loss_reason_id_fkey"
            columns: ["organization_id", "loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "deals_organization_id_stage_fkey"
            columns: ["organization_id", "stage"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["organization_id", "code"]
          },
        ]
      }
    }
    Functions: {
      accept_webhook: {
        Args: { endpoint: string; payload: Json; payload_hash: string }
        Returns: string
      }
      account_options: {
        Args: { org: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      admin_access_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      admin_access_read: {
        Args: { org: string; page_offset?: number }
        Returns: Json
      }
      board_filtered: {
        Args: {
          cursors: Json
          filters: Json
          org: string
          search: string
          which_pipeline: string
        }
        Returns: Json
      }
      board_page: {
        Args: {
          org: string
          page_number?: number
          search?: string
          which_pipeline?: string
        }
        Returns: Json
      }
      claim_bootstrap: { Args: never; Returns: string }
      complete_member: { Args: { job: string; org: string }; Returns: Json }
      crm_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      customer_create: {
        Args: {
          customer_category: string
          customer_name: string
          customer_note: string
          org: string
          request_id: string
        }
        Returns: Json
      }
      download_export: { Args: { job: string; org: string }; Returns: Json }
      export_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      export_page: {
        Args: {
          job: string
          org: string
          part_index?: number
          row_offset?: number
        }
        Returns: Json
      }
      finance_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      identity_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      import_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      invite_accept: {
        Args: { display_name: string; token: string }
        Returns: string
      }
      invite_create: {
        Args: { email_address: string; org: string }
        Returns: string
      }
      join_organization: {
        Args: { display_name: string; join_token: string }
        Returns: string
      }
      login_context: { Args: never; Returns: Json }
      monthly_portfolio: { Args: { org: string }; Returns: Json }
      operations_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      overview_report: {
        Args: { date_from?: string; date_to?: string; org: string }
        Returns: Json
      }
      prepare_member: {
        Args: { org: string; payload: Json; request_id: string }
        Returns: Json
      }
      price_summary: { Args: { d: string; org: string }; Returns: Json }
      process_exports: { Args: never; Returns: number }
      run_worker: { Args: never; Returns: number }
      subscription_command: {
        Args: {
          expected_version: number
          operation: string
          org: string
          payload: Json
          request_id: string
        }
        Returns: Json
      }
      todo_items: {
        Args: {
          org: string
          scope?: string
          search?: string
          skip_rows?: number
        }
        Returns: {
          archived: boolean
          assignee_id: string | null
          billing_interval: string
          catalog_id: string | null
          catalog_snapshot: Json | null
          created_at: string
          deal_id: string
          department_id: string
          description: string | null
          due_at: string | null
          ends_at: string | null
          id: string
          kind: string
          name: string
          organization_id: string
          parent_service_id: string | null
          quantity: number
          starts_at: string | null
          status: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "work_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      webhook_signing_keys: { Args: { endpoint: string }; Returns: string[] }
      workspace_stats: { Args: { org: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
