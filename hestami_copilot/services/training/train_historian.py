#!/usr/bin/env python3
"""
Historian LoRA Training Script

Trains a LoRA adapter for the Historian adjudication model using QLoRA.
Supports incremental training with replay buffers to prevent catastrophic forgetting.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml


def load_config(config_path: str) -> dict:
    with open(config_path, "r") as f:
        return yaml.safe_load(f)


def setup_model(model_path: str, config: dict):
    from unsloth import FastLanguageModel
    
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_path,
        max_seq_length=config.get("max_seq_length", 2048),
        dtype=None,
        load_in_4bit=config.get("load_in_4bit", True),
    )
    
    model = FastLanguageModel.get_peft_model(
        model,
        r=config.get("lora_rank", 8),
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_alpha=config.get("lora_alpha", 16),
        lora_dropout=config.get("lora_dropout", 0),
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=config.get("seed", 42),
    )
    
    return model, tokenizer


def load_training_data(data_path: str, tokenizer, config: dict):
    from datasets import Dataset
    
    examples = []
    data_file = Path(data_path)
    
    if data_file.is_dir():
        for jsonl_file in data_file.glob("*.jsonl"):
            with open(jsonl_file, "r") as f:
                for line in f:
                    if line.strip():
                        examples.append(json.loads(line))
    else:
        with open(data_file, "r") as f:
            for line in f:
                if line.strip():
                    examples.append(json.loads(line))
    
    if not examples:
        raise ValueError(f"No training examples found in {data_path}")
    
    print(f"Loaded {len(examples)} training examples")
    
    def format_prompt(example):
        proposal = example.get("action_proposal", {})
        adjudication = example.get("adjudication_response", {})
        
        if isinstance(proposal, dict):
            proposal = json.dumps(proposal, indent=2)
        if isinstance(adjudication, dict):
            adjudication = json.dumps(adjudication, indent=2)
        
        system_msg = "You are the Historian, a Constitutional Court adjudicator for software development governance. You evaluate ActionProposals against specifications and decisions. Output ONLY valid JSON."

        text = (
            f"<|im_start|>system\n{system_msg}<|im_end|>\n"
            f"<|im_start|>user\nEvaluate this ActionProposal:\n\n{proposal}<|im_end|>\n"
            f"<|im_start|>assistant\n{adjudication}<|im_end|>"
        )
        return {"text": text}
    
    formatted = [format_prompt(ex) for ex in examples]
    return Dataset.from_list(formatted)


def create_trainer(model, tokenizer, dataset, config: dict, output_dir: str):
    from trl import SFTTrainer
    from transformers import TrainingArguments
    from unsloth import is_bfloat16_supported
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=config.get("batch_size", 2),
        gradient_accumulation_steps=config.get("gradient_accumulation_steps", 4),
        warmup_steps=config.get("warmup_steps", 5),
        num_train_epochs=config.get("epochs", 3),
        learning_rate=config.get("learning_rate", 2e-4),
        fp16=not is_bfloat16_supported(),
        bf16=is_bfloat16_supported(),
        logging_steps=config.get("logging_steps", 1),
        optim="adamw_8bit",
        weight_decay=config.get("weight_decay", 0.01),
        lr_scheduler_type=config.get("lr_scheduler", "linear"),
        seed=config.get("seed", 42),
        save_strategy="epoch",
        save_total_limit=3,
        report_to="none",  # Disable wandb/tensorboard logging
    )
    
    return SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=config.get("max_seq_length", 2048),
        dataset_num_proc=2,
        packing=False,
        args=training_args,
    )


def save_adapter(model, tokenizer, output_dir: str, adapter_name: str):
    adapter_path = Path(output_dir) / adapter_name
    adapter_path.mkdir(parents=True, exist_ok=True)
    
    model.save_pretrained(adapter_path)
    tokenizer.save_pretrained(adapter_path)
    
    metadata = {
        "adapter_name": adapter_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "base_model": os.environ.get("MODEL_PATH", "unknown"),
        "type": "lora",
    }
    
    with open(adapter_path / "adapter_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"Adapter saved to {adapter_path}")
    return adapter_path


def main():
    parser = argparse.ArgumentParser(description="Train Historian LoRA adapter")
    parser.add_argument("--config", default=os.environ.get("CONFIG_PATH", "/app/configs/default.yaml"))
    parser.add_argument("--model", default=os.environ.get("MODEL_PATH", "/models/base"))
    parser.add_argument("--data", default=os.environ.get("TRAINING_DATA_PATH", "/training-data"))
    parser.add_argument("--output", default=os.environ.get("ADAPTERS_PATH", "/models/adapters"))
    parser.add_argument("--name", default=None)
    args = parser.parse_args()
    
    print(f"Loading config from {args.config}")
    config = load_config(args.config)
    
    adapter_name = args.name or f"historian_v{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    print("=== Historian LoRA Training ===")
    print(f"Base model: {args.model}")
    print(f"Training data: {args.data}")
    print(f"Output: {args.output}/{adapter_name}")
    
    print("Loading model...")
    model, tokenizer = setup_model(args.model, config)
    
    print("Loading training data...")
    dataset = load_training_data(args.data, tokenizer, config)
    
    print("Setting up trainer...")
    trainer = create_trainer(model, tokenizer, dataset, config, args.output)
    
    print("Starting training...")
    trainer_stats = trainer.train()
    
    print("Saving adapter...")
    adapter_path = save_adapter(model, tokenizer, args.output, adapter_name)
    
    print("\n=== Training Complete ===")
    print(f"Adapter: {adapter_path}")
    print(f"Training loss: {trainer_stats.training_loss:.4f}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
