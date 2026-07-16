# react-ts-fsd-agentic-toolkit

> An orchestrator-specialist agentic AI framework that automatically refactors legacy React projects into **Feature-Sliced Design (FSD)** + **TypeScript** — driven by n8n workflows and pluggable CLI tools.

---

## 🧠 Why This Exists

Standardising legacy codebases to FSD + TS manually is tedious and error-prone. A multi-agent loop breaks the problem down perfectly:

| Role | Responsibility |
|------|---------------|
| **Orchestrator** | Reads the project, maps import trees, creates the migration plan |
| **TS Migrator** | Converts JS/JSX → TS/TSX, infers prop-types |
| **FSD Slicer** | Moves files, builds `index.ts` public APIs, structures layers |
| **Dependency Fixer** | Fixes import paths, enforces FSD boundary rules |

---

## 🗂️ Project Structure

```
react-ts-fsd-agentic-toolkit/
├── core/                  # Agnostic orchestration logic
│   ├── orchestrator.md    # Main coordinator system prompt & logic
│   └── specialists/       # Specialist agent system prompts
│       ├── ts-migrator.md
│       ├── fsd-slicer.md
│       └── dependency-fixer.md
├── skills/                # Pluggable stateless developer tools
│   ├── file-parser/
│   ├── ast-modifier/
│   └── imports-linter/
├── n8n/                   # n8n JSON workflow exports & blueprints
│   ├── orchestrator-flow.json
│   └── specialist-subflows/
├── cli/                   # Lightweight CLI for local developer use
│   ├── index.js
│   └── commands/
├── README.md
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- n8n (self-hosted or cloud)
- An LLM API key (OpenAI, Anthropic, or compatible)

### 1. Install CLI tools
```bash
npm install
npm link   # makes `fsd-migrate` available globally
```

### 2. Import n8n workflows
Import the JSON files from `n8n/` into your n8n instance.

### 3. Configure your LLM credentials in n8n
Set up your API key in n8n → Credentials.

### 4. Run a migration
```bash
fsd-migrate --project /path/to/legacy-react-app
```

---

## 🏗️ Architecture

See [`core/orchestrator.md`](./core/orchestrator.md) for the full multi-agent design.

---

## 📄 License

MIT
