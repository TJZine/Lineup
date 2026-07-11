const SOL_MODELS = ['gpt-5.6-sol', 'gpt-5.5'];
const LUNA_MODELS = ['gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4-mini'];
const SPARK_MODELS = ['gpt-5.3-codex-spark'];

export const SUPPORTED_CODEX_MODELS = new Set([...SOL_MODELS, ...LUNA_MODELS, ...SPARK_MODELS]);
export const SUPPORTED_CODEX_REASONING_EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max']);

export const CODEX_ROLE_CONTRACTS = [
    {
        role: 'explorer',
        configFile: 'agents/explorer.toml',
        readOnly: true,
        supportedModels: SPARK_MODELS,
    },
    {
        role: 'explorer_fallback',
        configFile: 'agents/explorer-fallback.toml',
        readOnly: true,
        supportedModels: LUNA_MODELS,
    },
    {
        role: 'reviewer',
        configFile: 'agents/reviewer.toml',
        readOnly: true,
        supportedModels: SOL_MODELS,
    },
    {
        role: 'maintainability_reviewer',
        configFile: 'agents/maintainability-reviewer.toml',
        readOnly: true,
        supportedModels: SOL_MODELS,
        descriptionMarkers: ['read-only reviewer', 'code-health', 'no style-only blocking'],
        instructionMarkers: [
            'code-health',
            'slop',
            'file shape',
            'test brittleness',
            'unnecessary indirection',
            'do not block on style-only preferences',
            'do not edit files',
        ],
    },
    {
        role: 'architecture_reviewer',
        configFile: 'agents/architecture-reviewer.toml',
        readOnly: true,
        supportedModels: SOL_MODELS,
        descriptionMarkers: ['read-only reviewer', 'hotspots', 'security-adjacent architecture risk'],
        instructionMarkers: [
            'hotspots',
            'owner seams',
            'cross-module coupling',
            'public contracts',
            'priority-exit',
            'security-adjacent architecture risk',
            'do not edit files',
        ],
    },
    {
        role: 'docs_researcher',
        configFile: 'agents/docs-researcher.toml',
        readOnly: true,
        supportedModels: LUNA_MODELS,
    },
    {
        role: 'planner',
        configFile: 'agents/planner.toml',
        readOnly: false,
        supportedModels: SOL_MODELS,
        instructionMarkers: [
            'own bounded planning work',
            'not product-code implementation',
            'planning artifacts',
            'execution-ready handoffs',
            'leave implementation to the worker role',
        ],
    },
    {
        role: 'planner_deep',
        configFile: 'agents/planner-deep.toml',
        readOnly: false,
        supportedModels: SOL_MODELS,
        descriptionMarkers: ['deep planning writer', 'tier 3', 'not product-code implementation'],
        instructionMarkers: [
            'deep planning work',
            'tier 3',
            'unresolved architecture/product seam',
            'do not implement product code',
            'planning artifacts',
        ],
    },
    {
        role: 'worker',
        configFile: 'agents/worker.toml',
        readOnly: false,
        supportedModels: SOL_MODELS,
    },
    {
        role: 'worker_luna',
        configFile: 'agents/worker-luna.toml',
        readOnly: false,
        supportedModels: LUNA_MODELS,
        descriptionMarkers: ['cost-optimized write-capable implementer', 'approved', 'cheap-to-verify'],
        instructionMarkers: [
            'approved, bounded, exact, cheap-to-verify execution units',
            'current execution packet',
            'stop and escalate on ambiguity',
            'plan contradiction',
            'verification failure that needs diagnosis',
        ],
    },
    {
        role: 'cleanup_worker',
        configFile: 'agents/cleanup-worker.toml',
        readOnly: false,
        supportedModels: SOL_MODELS,
        descriptionMarkers: ['cleanup-loop-specific implementer', 'approved tier 3 cleanup-loop implementation passes'],
        instructionMarkers: [
            'bounded cleanup-loop implementation write scope',
            'smallest defensible cleanup change',
            'approved execution unit',
            'tier 3 cleanup-loop implementation passes',
            'leave general implementation routing to the worker role',
        ],
    },
    {
        role: 'monitor',
        configFile: 'agents/monitor.toml',
        readOnly: true,
        supportedModels: SPARK_MODELS,
    },
    {
        role: 'monitor_fallback',
        configFile: 'agents/monitor-fallback.toml',
        readOnly: true,
        supportedModels: LUNA_MODELS,
    },
];

export const RETIRED_CODEX_AGENT_ROLES = ['worker_54_high', 'worker_terra'];

export function isSupportedModelEffortCombination(model, reasoningEffort) {
    if (!SUPPORTED_CODEX_MODELS.has(model) || !SUPPORTED_CODEX_REASONING_EFFORTS.has(reasoningEffort)) {
        return false;
    }

    return model !== 'gpt-5.4-mini' || reasoningEffort === 'low' || reasoningEffort === 'medium';
}
