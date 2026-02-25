-- Historian Registry Seed Data
-- Initial data for development and testing

-- Note: Actual seed data will be generated from spec corpus
-- This file is a placeholder for development

-- Example: Insert a base model adapter record
INSERT INTO model_adapters (adapter_id, base_model, status, training_config)
VALUES (
    'base-qwen3-8b-v0',
    'Qwen3-8B',
    'PROMOTED',
    '{"quantization": "4bit", "lora_rank": 8, "lora_alpha": 16}'::JSONB
)
ON CONFLICT (adapter_id) DO NOTHING;
