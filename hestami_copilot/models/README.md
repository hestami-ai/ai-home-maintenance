# Models

This directory contains model artifacts for the Historian.

## Structure

- `adapters/` - LoRA adapters (versioned by timestamp)
  - Each adapter is a directory with the adapter weights and config
  - Example: `historian-lora-20250128-120000/`

- `merged/` - Merged FP16 checkpoints (base + adapter)
  - Used for final deployment and Ollama packaging
  - Example: `historian-merged-v1.0/`

- `registry.json` - Model lineage and version tracking
  - Records all adapters, their training batches, benchmark scores
  - Tracks current production adapter
  - Maintains promotion/rollback history

## Model Lifecycle

1. **Training**: New LoRA adapter trained from batch
2. **Validation**: Benchmark suite run against adapter
3. **Promotion**: If benchmarks pass, adapter promoted to production
4. **Archive**: Old adapters archived (not deleted)

## Adapter Naming Convention

```
historian-lora-{YYYYMMDD}-{HHMMSS}
```

## Promotion Gates

An adapter must pass all hard gates before promotion:
- Label accuracy >= 90%
- Citation precision >= 95%
- UNKNOWN accuracy >= 95%
- JSON validity = 100%
- Unsupported assertion rate <= 1%
- No regression > 2% on any core metric

## Rollback

If a promoted adapter causes issues:
1. Identify the problematic adapter
2. Set `current_adapter` in registry.json to previous adapter ID
3. Reload the inference service

## Ollama Packaging

For deployment via Ollama:
```bash
# Merge base + adapter
python scripts/merge_adapter.py --adapter adapters/current

# Quantize to GGUF
python scripts/quantize_gguf.py --model merged/current --output historian.gguf

# Create Ollama model
ollama create historian -f Modelfile
```
