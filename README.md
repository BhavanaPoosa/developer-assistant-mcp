# Developer MCP Server

This is a local [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that connects to Claude Desktop, allowing it to run real developer tools on your machine — like generating components, searching code, and running terminal commands.

---

## Available Tools

| Tool Name          | Description                                                    |
|--------------------|----------------------------------------------------------------|
| `create-file`       | Create a new file with specific content                        |
| `get-file-list`     | Return a list of files in a directory                          |
| `search-code`       | Search for a string or pattern in project files                |
| `explain-code`      | Let Claude read and explain source code                        |
| `run-command`       | Execute safe terminal commands on your machine                 |
| `generate-component`| Scaffold a new component (React, Angular, or Svelte)           |
| `create-project`    | Create a new project (React, Svelte, Spring Boot)              |

> Each tool returns human-readable results and supports follow-up actions in Claude Desktop.

---

## Supported Frameworks

### In `generate-component`
- React (functional with props)
- Angular (basic component structure)
- Svelte (script + style + markup)

### In `create-project`
- React: Vite or Create React App
- Svelte: Vite
- Spring Boot: Maven template with basic structure

Claude can optionally:
- Run install commands like `npm install`, `mvn install`
- Open your project in VS Code (`code .`) or IntelliJ (`idea .`)

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/developer-mcp-server.git
cd developer-mcp-server
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the server

```bash
npm run build
```

---

## Claude Desktop Configuration

Edit your Claude config:

```json
{
  "mcpServers": {
    "developer": {
      "command": "node",
      "args": [
        "YOUR_FULL_PATH\build\index.js"
      ]
    }
  }
}
```

Restart Claude Desktop to activate it.

---

## Folder Structure

```
developer-mcp-server/
├── src/
│   └── index.ts             # MCP server and tool registration
├── build/                   # Transpiled output
├── package.json
├── tsconfig.json
└── README.md
```

---

##  Tooling & Technologies
- TypeScript + Node.js
- Claude Desktop + JSON-RPC
- `@modelcontextprotocol/sdk`
- Zod for input validation

