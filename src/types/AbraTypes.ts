/**
 * iCaffe Core SDK - Type Definitions
 * Immutable base for Zero-G Apps
 */

export interface EmployeeProfile {
    id: string;
    name: string;
    role: 'super_admin' | 'admin' | 'manager' | 'chef' | 'barista' | 'checker' | 'staff';
    access_level: number; // 2-10 hierarchy
    business_id: string;
    permissions: string[];
}

export interface AuthInterface {
    identify(): Promise<EmployeeProfile>;
}

export interface QueryResult<T = any> {
    data: T[];
    error: any | null;
    correlation_id: string;
}

export interface CommitResult {
    success: boolean;
    correlation_id: string;
    timestamp: string;
    rollback_token: string;
}

export interface CommitOptions {
    app_id: string;
    reason?: string;
    bypass_cache?: boolean;
}

export interface DBInterface {
    query<T = any>(table: string, filter?: object): Promise<QueryResult<T>>;
    commit<T = any>(table: string, data: Partial<T> | Partial<T>[], options: CommitOptions): Promise<CommitResult>;
}

export interface AIResponse {
    content: string;
    suggestions: string[];
    tokens_used: number;
}

export interface AIInterface {
    consult(prompt: string, context?: any): Promise<AIResponse>;
}

// ------------------------------------------------------------------
// ABRAKADABRA ENGINE INTERFACES (Magic Theme)
// ------------------------------------------------------------------

export interface AbraManifesto {
    spell_id: string;
    incantation: string; // Title
    effect: string; // Description
    caster: {
        employee_id: string;
        role: string;
        business_id: string;
    };
    correlation_id: string;
    timestamp: string;
    target_component: {
        component_id: string;
        file_path: string;
        current_behavior: string;
        proposed_behavior: string;
    };
    impact_analysis: {
        affected_screens: Array<{ file_path: string; impact_type: string; description: string }>;
        affected_supabase_tables: string[];
        affected_dexie_tables: string[];
        affected_rpcs: string[];
        risk_level: 'low' | 'medium' | 'high' | 'critical';
    };
    database_requirements: {
        needs_supabase_migration: boolean;
        needs_dexie_version_bump: boolean;
        new_rpc_functions: any[];
    };
    security_audit: {
        rls_affected: boolean;
        exposes_financial_data: boolean;
        requires_auth_change: boolean;
        forbidden_patterns_check: {
            uses_raw_sql: boolean;
            uses_service_role_key: boolean;
            bypasses_rls: boolean;
            modifies_auth_tables: boolean;
        };
    };
    files: {
        modified: any[];
        created: any[];
    };
    ui_changes: {
        modifies_layout: boolean;
        modifies_styles: boolean;
        user_approval_required: boolean;
    };
}

export interface RegistryInterface {
    lookup(componentId: string): Promise<any>;
}

export interface AbrakadabraInterface {
    /** Retrieve a stored AbraManifesto (Action Plan) */
    getManifesto(spellId: string): Promise<AbraManifesto>;

    /** Trigger the creation/sandbox phase (formerly triggerEvolution) */
    castSpell(incantation: string): Promise<AbraManifesto>;

    /** Promote the spell to production (formerly promote) */
    prestoPromote(spellId: string, token: string): Promise<CommitResult>;

    /** Revert a spell (formerly rollback) */
    dispel(token: string): Promise<CommitResult>;
}

export interface ICaffeSDK {
    auth: AuthInterface;
    db: DBInterface;
    ai: AIInterface;
    registry: RegistryInterface;
    abrakadabra: AbrakadabraInterface;
}

export interface AbraIntent {
    intent_type: 'UI_MODIFICATION' | 'LOGIC_FIX' | 'FEATURE_ADDITION';
    primary_component_id: string;
    hebrew_description: string;
    english_summary: string;
    affected_entities: string[];
    risk_assessment: 'low' | 'medium' | 'high';
}

export type LogLevel = 'info' | 'warn' | 'error' | 'security';

export interface PlatformLog {
    app_id: string;
    correlation_id: string;
    message: string;
    level: LogLevel;
    timestamp: string;
    metadata?: any;
}
