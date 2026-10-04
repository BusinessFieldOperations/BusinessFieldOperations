export type Json =
  string | number | boolean | null | {[key: string]: Json | undefined} | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      brands: {
        Row: {
          name: string;
        };
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          name: string;
        };
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
        };
        Relationships: [];
      };
      client_states: {
        Row: {
          client_id: string;
          state_id: number;
        };
        Insert: {
          client_id: string;
          state_id: number;
        };
        Update: {
          client_id?: string;
          state_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'client_states_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_states_state_id_fkey';
            columns: ['state_id'];
            isOneToOne: false;
            referencedRelation: 'states';
            referencedColumns: ['id'];
          },
        ];
      };
      clients: {
        Row: {
          id: string;
          is_active: boolean;
          legal_identity_id: string;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          legal_identity_id: string;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          legal_identity_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'clients_legal_identity_id_fkey';
            columns: ['legal_identity_id'];
            isOneToOne: true;
            referencedRelation: 'legal_identity';
            referencedColumns: ['id'];
          },
        ];
      };
      contacts: {
        Row: {
          created_at: string;
          email: string | null;
          extra_fields: Json;
          first_name: string;
          id: string;
          id_document: string | null;
          last_name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          extra_fields?: Json;
          first_name: string;
          id?: string;
          id_document?: string | null;
          last_name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          extra_fields?: Json;
          first_name?: string;
          id?: string;
          id_document?: string | null;
          last_name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      establishment: {
        Row: {
          branch_name: string | null;
          id: string;
          legal_identity_id: string;
          location: string;
          state_id: number;
        };
        Insert: {
          branch_name?: string | null;
          id?: string;
          legal_identity_id: string;
          location: string;
          state_id: number;
        };
        Update: {
          branch_name?: string | null;
          id?: string;
          legal_identity_id?: string;
          location?: string;
          state_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'establishment_legal_identity_id_fkey';
            columns: ['legal_identity_id'];
            isOneToOne: false;
            referencedRelation: 'legal_identity';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'establishment_state_id_fkey';
            columns: ['state_id'];
            isOneToOne: false;
            referencedRelation: 'states';
            referencedColumns: ['id'];
          },
        ];
      };
      legal_identity: {
        Row: {
          id: string;
          kind: Database['public']['Enums']['legal_identity_type'];
          name: string;
          rif: string;
        };
        Insert: {
          id?: string;
          kind?: Database['public']['Enums']['legal_identity_type'];
          name: string;
          rif: string;
        };
        Update: {
          id?: string;
          kind?: Database['public']['Enums']['legal_identity_type'];
          name?: string;
          rif?: string;
        };
        Relationships: [];
      };
      merchant_report_inventory: {
        Row: {
          damaged_units: number;
          expired_units: number;
          good_units: number;
          id: number;
          product_id: string;
          report_id: number;
          salesfloor_id: number | null;
          total_units: number | null;
        };
        Insert: {
          damaged_units?: number;
          expired_units?: number;
          good_units?: number;
          id?: never;
          product_id: string;
          report_id: number;
          salesfloor_id?: number | null;
          total_units?: number | null;
        };
        Update: {
          damaged_units?: number;
          expired_units?: number;
          good_units?: number;
          id?: never;
          product_id?: string;
          report_id?: number;
          salesfloor_id?: number | null;
          total_units?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'merchant_report_inventory_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'merchant_report_inventory_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_reports';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'merchant_report_inventory_report_id_salesfloor_id_fkey';
            columns: ['report_id', 'salesfloor_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_report_salesfloors';
            referencedColumns: ['report_id', 'id'];
          },
        ];
      };
      merchant_report_salesfloors: {
        Row: {
          id: number;
          name: string;
          report_id: number;
        };
        Insert: {
          id?: never;
          name: string;
          report_id: number;
        };
        Update: {
          id?: never;
          name?: string;
          report_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'merchant_report_salesfloors_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'merchant_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      merchant_reports: {
        Row: {
          client_id: string;
          establishment_id: string;
          id: number;
          latitude: number | null;
          location_accuracy_m: number | null;
          longitude: number | null;
          merchant_id: string;
          no_inventory: boolean;
          observations: string | null;
          salesman_name: string;
          state_id: number;
          submitted_at: string;
          zone: string;
        };
        Insert: {
          client_id: string;
          establishment_id: string;
          id?: never;
          latitude?: number | null;
          location_accuracy_m?: number | null;
          longitude?: number | null;
          merchant_id?: string;
          no_inventory?: boolean;
          observations?: string | null;
          salesman_name: string;
          state_id: number;
          submitted_at?: string;
          zone: string;
        };
        Update: {
          client_id?: string;
          establishment_id?: string;
          id?: never;
          latitude?: number | null;
          location_accuracy_m?: number | null;
          longitude?: number | null;
          merchant_id?: string;
          no_inventory?: boolean;
          observations?: string | null;
          salesman_name?: string;
          state_id?: number;
          submitted_at?: string;
          zone?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_merchant_reports_client_state';
            columns: ['client_id', 'state_id'];
            isOneToOne: false;
            referencedRelation: 'client_states';
            referencedColumns: ['client_id', 'state_id'];
          },
          {
            foreignKeyName: 'merchant_reports_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'merchant_reports_establishment_id_fkey';
            columns: ['establishment_id'];
            isOneToOne: false;
            referencedRelation: 'establishment';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'merchant_reports_merchant_id_fkey';
            columns: ['merchant_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'merchant_reports_state_id_fkey';
            columns: ['state_id'];
            isOneToOne: false;
            referencedRelation: 'states';
            referencedColumns: ['id'];
          },
        ];
      };
      product_establishment: {
        Row: {
          establishment_id: string;
          product_id: string;
        };
        Insert: {
          establishment_id: string;
          product_id: string;
        };
        Update: {
          establishment_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_establishment_establishment_id_fkey';
            columns: ['establishment_id'];
            isOneToOne: false;
            referencedRelation: 'establishment';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_establishment_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          brand: string | null;
          category: string | null;
          client_id: string | null;
          display_quantity: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sku: string | null;
          units_per_package: number;
        };
        Insert: {
          brand?: string | null;
          category?: string | null;
          client_id?: string | null;
          display_quantity?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sku?: string | null;
          units_per_package: number;
        };
        Update: {
          brand?: string | null;
          category?: string | null;
          client_id?: string | null;
          display_quantity?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sku?: string | null;
          units_per_package?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'products_brand_fkey';
            columns: ['brand'];
            isOneToOne: false;
            referencedRelation: 'brands';
            referencedColumns: ['name'];
          },
          {
            foreignKeyName: 'products_category_fkey';
            columns: ['category'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['name'];
          },
          {
            foreignKeyName: 'products_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          ci: string | null;
          first_name: string;
          id: string;
          is_active: boolean;
          last_name: string;
          role: Database['public']['Enums']['user_role'];
        };
        Insert: {
          ci?: string | null;
          first_name?: string;
          id: string;
          is_active?: boolean;
          last_name?: string;
          role?: Database['public']['Enums']['user_role'];
        };
        Update: {
          ci?: string | null;
          first_name?: string;
          id?: string;
          is_active?: boolean;
          last_name?: string;
          role?: Database['public']['Enums']['user_role'];
        };
        Relationships: [];
      };
      promoter_report_details: {
        Row: {
          final_inventory: number;
          initial_inventory: number;
          product_id: string;
          report_id: number;
          restocked_units: number;
          total_sales: number | null;
        };
        Insert: {
          final_inventory: number;
          initial_inventory: number;
          product_id: string;
          report_id: number;
          restocked_units?: number;
          total_sales?: number | null;
        };
        Update: {
          final_inventory?: number;
          initial_inventory?: number;
          product_id?: string;
          report_id?: number;
          restocked_units?: number;
          total_sales?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'promoter_report_details_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promoter_report_details_report_id_fkey';
            columns: ['report_id'];
            isOneToOne: false;
            referencedRelation: 'promoter_reports';
            referencedColumns: ['id'];
          },
        ];
      };
      promoter_reports: {
        Row: {
          client_id: string | null;
          establishment_id: string;
          id: number;
          latitude: number | null;
          location_accuracy_m: number | null;
          longitude: number | null;
          promoter_id: string;
          salesman_name: string;
          state_id: number | null;
          submitted_at: string;
          zone: string;
        };
        Insert: {
          client_id?: string | null;
          establishment_id: string;
          id?: never;
          latitude?: number | null;
          location_accuracy_m?: number | null;
          longitude?: number | null;
          promoter_id?: string;
          salesman_name: string;
          state_id?: number | null;
          submitted_at?: string;
          zone: string;
        };
        Update: {
          client_id?: string | null;
          establishment_id?: string;
          id?: never;
          latitude?: number | null;
          location_accuracy_m?: number | null;
          longitude?: number | null;
          promoter_id?: string;
          salesman_name?: string;
          state_id?: number | null;
          submitted_at?: string;
          zone?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_promoter_reports_client_state';
            columns: ['client_id', 'state_id'];
            isOneToOne: false;
            referencedRelation: 'client_states';
            referencedColumns: ['client_id', 'state_id'];
          },
          {
            foreignKeyName: 'promoter_reports_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promoter_reports_establishment_id_fkey';
            columns: ['establishment_id'];
            isOneToOne: false;
            referencedRelation: 'establishment';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promoter_reports_promoter_id_fkey';
            columns: ['promoter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promoter_reports_state_id_fkey';
            columns: ['state_id'];
            isOneToOne: false;
            referencedRelation: 'states';
            referencedColumns: ['id'];
          },
        ];
      };
      states: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: never;
          name: string;
        };
        Update: {
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      // [_ in never]: never;
    };
    Functions: {
      // [_ in never]: never;
    };
    Enums: {
      legal_identity_type: 'client' | 'establishment';
      user_role: 'merchant' | 'promoter' | 'administrator';
    };
    CompositeTypes: {
      // [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | {schema: keyof DatabaseWithoutInternals},
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | {schema: keyof DatabaseWithoutInternals},
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | {schema: keyof DatabaseWithoutInternals},
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | {schema: keyof DatabaseWithoutInternals},
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | {schema: keyof DatabaseWithoutInternals},
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      legal_identity_type: ['client', 'establishment'],
      user_role: ['merchant', 'promoter', 'administrator'],
    },
  },
} as const;
