export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_suggestions: {
        Row: {
          applied_at: string | null;
          category:
            | "shrink_action"
            | "clarify_trigger"
            | "refine_identity"
            | "keep_setup"
            | "weekly_adjustment"
            | "low_consistency_hint";
          confidence: number | null;
          current_value: string | null;
          dismissed_at: string | null;
          habit_id: string;
          headline: string;
          id: string;
          input_snapshot: Json | null;
          message: string;
          model_name: string | null;
          output_snapshot: Json | null;
          proposed_value: string | null;
          reason_code: string | null;
          shown_at: string;
          suggested_field:
            | "tiny_action"
            | "stack_trigger"
            | "identity_statement"
            | "none"
            | null;
          trigger_source:
            | "create_habit"
            | "repeated_miss"
            | "weekly_review"
            | "manual_help"
            | "low_consistency";
          user_id: string;
        };
        Insert: {
          applied_at?: string | null;
          category:
            | "shrink_action"
            | "clarify_trigger"
            | "refine_identity"
            | "keep_setup"
            | "weekly_adjustment"
            | "low_consistency_hint";
          confidence?: number | null;
          current_value?: string | null;
          dismissed_at?: string | null;
          habit_id: string;
          headline: string;
          id?: string;
          input_snapshot?: Json | null;
          message: string;
          model_name?: string | null;
          output_snapshot?: Json | null;
          proposed_value?: string | null;
          reason_code?: string | null;
          shown_at?: string;
          suggested_field?:
            | "tiny_action"
            | "stack_trigger"
            | "identity_statement"
            | "none"
            | null;
          trigger_source:
            | "create_habit"
            | "repeated_miss"
            | "weekly_review"
            | "manual_help"
            | "low_consistency";
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_suggestions"]["Insert"]>;
        Relationships: [];
      };
      habit_context: {
        Row: {
          available_time_band:
            | "under_2_min"
            | "about_5_min"
            | "ten_plus_min"
            | null;
          common_obstacle:
            | "forget"
            | "busy"
            | "low_motivation"
            | "routine_changes"
            | "too_big"
            | "other"
            | null;
          created_at: string;
          difficulty_expectation: "very_easy" | "manageable" | "hard" | null;
          habit_id: string;
          id: string;
          motivation_reason: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          available_time_band?:
            | "under_2_min"
            | "about_5_min"
            | "ten_plus_min"
            | null;
          common_obstacle?:
            | "forget"
            | "busy"
            | "low_motivation"
            | "routine_changes"
            | "too_big"
            | "other"
            | null;
          created_at?: string;
          difficulty_expectation?: "very_easy" | "manageable" | "hard" | null;
          habit_id: string;
          id?: string;
          motivation_reason?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["habit_context"]["Insert"]>;
        Relationships: [];
      };
      habit_logs: {
        Row: {
          created_at: string;
          habit_id: string;
          id: string;
          log_date: string;
          note: string | null;
          status: "done" | "skipped" | "missed";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          habit_id: string;
          id?: string;
          log_date: string;
          note?: string | null;
          status: "done" | "skipped" | "missed";
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["habit_logs"]["Insert"]>;
        Relationships: [];
      };
      habits: {
        Row: {
          created_at: string;
          id: string;
          identity_statement: string | null;
          is_active: boolean;
          name: string;
          preferred_time_window: string | null;
          reminder_enabled: boolean;
          reminder_time: string | null;
          start_date: string;
          stack_trigger: string;
          tiny_action: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          identity_statement?: string | null;
          is_active?: boolean;
          name: string;
          preferred_time_window?: string | null;
          reminder_enabled?: boolean;
          reminder_time?: string | null;
          start_date: string;
          stack_trigger: string;
          tiny_action: string;
          updated_at?: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["habits"]["Insert"]>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          created_at: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Insert"]>;
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          adjustment_note: string | null;
          created_at: string;
          habit_id: string;
          id: string;
          tiny_action_too_hard: boolean | null;
          trigger_worked: boolean | null;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          adjustment_note?: string | null;
          created_at?: string;
          habit_id: string;
          id?: string;
          tiny_action_too_hard?: boolean | null;
          trigger_worked?: boolean | null;
          updated_at?: string;
          user_id: string;
          week_start: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_reviews"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      ai_suggestion_category:
        | "shrink_action"
        | "clarify_trigger"
        | "refine_identity"
        | "keep_setup"
        | "weekly_adjustment"
        | "low_consistency_hint";
      ai_trigger_source:
        | "create_habit"
        | "repeated_miss"
        | "weekly_review"
        | "manual_help"
        | "low_consistency";
      available_time_band: "under_2_min" | "about_5_min" | "ten_plus_min";
      common_obstacle:
        | "forget"
        | "busy"
        | "low_motivation"
        | "routine_changes"
        | "too_big"
        | "other";
      difficulty_expectation: "very_easy" | "manageable" | "hard";
      habit_log_status: "done" | "skipped" | "missed";
    };
    CompositeTypes: Record<string, never>;
  };
};
