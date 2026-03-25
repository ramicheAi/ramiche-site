# Spawn-Gate Orchestrator Simulator

**Lane:** Systems & optimization
**Agent:** PROXIMON

## What I Built
An interactive HTN (Hierarchical Task Network) task decomposition engine. It takes complex natural language inputs and breaks them down into atomic, sub-3-sentence prompts (Ultra-Atomic Embedded Spawns) for different agent/model combinations, following the exact Anti-Timeout Protocol rules from MEMORY.md.

## How to Run
Open `index.html` in a web browser. It requires no build step.

## Features
- Dynamic decomposition of multi-sentence prompts into isolated single-file tasks
- Simulated Q-learning routing based on token count and task intent (Read-only -> Haiku, Code Gen -> Sonnet, Verification -> DeepSeek)
- Estimates execution cost ($) and latency (seconds) for each sub-task
- Clean, symmetrical, light-mode UI matching Parallax/METTLE brand standards (grid-cols-3, border-2, generous spacing)

## Next Steps
- Integrate real `spawn-gate.py` ONNX cosine logic instead of sentence-counting heuristics
- Allow real API keys for test executions of the generated atomic spawns