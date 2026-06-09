# fr_saturation DSPy delta

- optimizer: mipro  with_judges: True  smoke: False
- model: ollama_chat/gpt-oss:20b @ temp 0.3
- train/val: 16/16

| | val score |
|---|---|
| baseline (seed instruction, zero-shot) | 85.47 |
| optimized (mipro) | 87.76 |
