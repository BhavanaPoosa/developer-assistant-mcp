import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

// Initialize the MCP server
const server = new McpServer({
  name: "developer",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

const execAsync = promisify(exec);

// Capitalize component name
function toComponentName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Search for keyword in code file content
async function searchKeywordInFile(filePath: string, keyword: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split("\n");
    return lines
      .map((line, index) => line.includes(keyword) ? `${path.basename(filePath)}:${index + 1}: ${line.trim()}` : null)
      .filter((line): line is string => !!line);
  } catch {
    return [];
  }
}


// create-file
server.tool("create-file", "Create a file with given content", {
  filename: z.string(),
  content: z.string(),
}, async ({ filename, content }) => {
  const fullPath = path.resolve(filename);
  await fs.writeFile(fullPath, content, "utf-8");
  return {
    content: [{ type: "text", text: `✅ File created: ${fullPath}` }],
  };
});

// get-file-list
server.tool("get-file-list", "List files in a directory", {
  folder: z.string().default("."),
}, async ({ folder }) => {
  const fullPath = path.resolve(folder);
  try {
    const files = await fs.readdir(fullPath);
    return {
      content: [{ type: "text", text: `📂 Files in ${fullPath}:\n${files.join("\n")}` }],
    };
  } catch (e) {
    return {
      content: [{ type: "text", text: `❌ Error reading directory: ${e}` }],
    };
  }
});

// run-command
server.tool("run-command", "Run a safe shell command and return output", {
  command: z.string().describe("Shell command to execute (safe only)"),
}, async ({ command }) => {
  // Simple blacklist of dangerous commands
  const forbiddenPatterns = [
    /\brm\b/,           // Unix remove
    /\brmdir\b/,        // Unix remove dir
    /\bdel\b/,          // Windows delete
    /\bformat\b/,       // Disk format
    /\bshutdown\b/,     // System shutdown
    /\bmkfs\b/,         // Make filesystem
    /\bpoweroff\b/,
    /\binit\b/,
    /\bkill\b/,
    /:\s*(){}/,         // fork bomb
    /\b--no-preserve-root\b/,
  ];

  if (forbiddenPatterns.some((pattern) => pattern.test(command))) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Refused to run potentially dangerous command:\n\`${command}\``,
        },
      ],
    };
  }

  try {
    const { stdout, stderr } = await execAsync(command);
    return {
      content: [
        {
          type: "text",
          text: `🖥️ Output:\n${stdout || stderr || "(no output)"}`,
        },
      ],
    };
  } catch (e: any) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Command failed:\n${e.message}`,
        },
      ],
    };
  }
});


// generate-component
server.tool("generate-component", "Generate a component for a chosen framework", {
  name: z.string().describe("Component name"),
  folder: z.string().optional().default("src/components"),
  framework: z.enum(["react", "angular", "svelte"]).describe("Framework to use"),
}, async ({ name, folder, framework }) => {
  const componentName = toComponentName(name);
  const targetFolder = path.resolve(folder);
  let filePath: string;
  let content: string;

  switch (framework) {
    case "react":
      filePath = path.join(targetFolder, `${componentName}.tsx`);
      content = `import React from "react";

const ${componentName} = () => {
  return <div>${componentName} works!</div>;
};

export default ${componentName};
`;
      break;

    case "angular":
      // Angular usually has .component.ts, .html, and .css
      filePath = path.join(targetFolder, `${name}.component.ts`);
      await fs.mkdir(targetFolder, { recursive: true });

      await fs.writeFile(path.join(targetFolder, `${name}.component.ts`), `import { Component } from '@angular/core';

@Component({
  selector: 'app-${name}',
  templateUrl: './${name}.component.html',
  styleUrls: ['./${name}.component.css']
})
export class ${componentName}Component {
}
`, "utf-8");

      await fs.writeFile(path.join(targetFolder, `${name}.component.html`), `<p>${componentName} works!</p>`, "utf-8");
      await fs.writeFile(path.join(targetFolder, `${name}.component.css`), `/* Styles for ${componentName} */`, "utf-8");

      return {
        content: [{
          type: "text",
          text: `✅ Angular component created in: ${targetFolder}`,
        }],
      };

    case "svelte":
      filePath = path.join(targetFolder, `${componentName}.svelte`);
      content = `<script>
  // Svelte component logic here
</script>

<style>
  /* Styles for ${componentName} */
</style>

<div>${componentName} works!</div>
`;
      break;

    default:
      return {
        content: [{ type: "text", text: `❌ Unsupported framework: ${framework}` }],
      };
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");

  return {
    content: [{
      type: "text",
      text: `✅ ${framework.charAt(0).toUpperCase() + framework.slice(1)} component created: ${filePath}`,
    }],
  };
});


// search-code
server.tool("search-code", "Search for a keyword in code files", {
  keyword: z.string(),
  folder: z.string().default("."),
}, async ({ keyword, folder }) => {
  const fullPath = path.resolve(folder);
  const files = await fs.readdir(fullPath);
  const matches: string[] = [];

  for (const file of files) {
    const ext = path.extname(file);
    if (![".js", ".ts", ".tsx"].includes(ext)) continue;

    const fileMatches = await searchKeywordInFile(path.join(fullPath, file), keyword);
    matches.push(...fileMatches);
  }

  return {
    content: [{
      type: "text",
      text: matches.length
        ? `🔍 Matches for "${keyword}":\n` + matches.join("\n")
        : `🔍 No matches for "${keyword}" in ${fullPath}`,
    }],
  };
});

//explain-code
server.tool("explain-code", "Read code from a file and explain it", {
  path: z.string().describe("Path to the code file"),
}, async ({ path: filePath }) => {
  const fullPath = path.resolve(filePath);
  try {
    const content = await fs.readFile(fullPath, "utf-8");
    return {
      content: [
        { type: "text", text: `📄 File content for Claude to analyze:\n\n${content}` },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `❌ Failed to read file: ${err}` }],
    };
  }
});

//create-project framework: react, svelte, spring boot
server.tool("create-project", "Generate a starter project", {
  name: z.string().describe("Project name"),
  framework: z.enum(["react", "springboot", "svelte"]).describe("Framework to scaffold"),
  tooling: z.enum(["vite", "cra"]).optional().describe("Tooling for React projects"),
}, async ({ name, framework, tooling }) => {
  const rootPath = path.resolve(name);
  await fs.mkdir(rootPath, { recursive: true });

  try {
    switch (framework) {
      case "react": {
        const useVite = tooling !== "cra";

        if (useVite) {
          // Vite-based React scaffold
          await fs.mkdir(path.join(rootPath, "src"), { recursive: true });
          await fs.writeFile(path.join(rootPath, "package.json"), JSON.stringify({
            name,
            version: "1.0.0",
            scripts: {
              start: "vite",
              build: "vite build",
              dev: "vite"
            },
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0"
            },
            devDependencies: {
              vite: "^4.0.0",
              typescript: "^5.0.0"
            }
          }, null, 2));

          await fs.writeFile(path.join(rootPath, "index.html"), `<!DOCTYPE html>
<html lang="en">
  <head><title>${name}</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`);

          await fs.writeFile(path.join(rootPath, "src", "main.tsx"), `import React from "react";
import ReactDOM from "react-dom/client";

const App = () => <h1>${name} (React with Vite)</h1>;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
`);
        } else {
          // CRA setup: prepare directory, then suggest command
          return {
            content: [
              {
                type: "text",
                text: `📦 To scaffold a Create React App project named "${name}", run:\n\n\`npx create-react-app ${name} --template typescript\`\n\nWould you like me to run that now?`,
              },
            ],
            suggested_follow_ups: [
              {
                name: "Run Create React App",
                description: `Run CRA init for ${name}`,
                parameters: {
                  path: path.dirname(rootPath),
                  command: `npx create-react-app ${name} --template typescript`,
                },
                tool_choice: "run-command-in-dir",
              },
            ],
          };
        }
        break;
      }

      case "svelte": {
        await fs.mkdir(path.join(rootPath, "src"), { recursive: true });
        await fs.writeFile(path.join(rootPath, "package.json"), JSON.stringify({
          name,
          version: "1.0.0",
          scripts: {
            dev: "vite",
            build: "vite build"
          },
          dependencies: {
            svelte: "^4.0.0"
          },
          devDependencies: {
            vite: "^4.0.0"
          }
        }, null, 2));

        await fs.writeFile(path.join(rootPath, "index.html"), `<!DOCTYPE html>
<html>
  <head><title>${name}</title></head>
  <body>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`);

        await fs.writeFile(path.join(rootPath, "src", "App.svelte"), `<script>
  let message = "${name} (Svelte)";
</script>

<main>
  <h1>{message}</h1>
</main>`);
        await fs.writeFile(path.join(rootPath, "src", "main.js"), `import App from './App.svelte';

const app = new App({
  target: document.body,
});

export default app;`);
        break;
      }

      case "springboot": {
        const javaRoot = path.join(rootPath, "src", "main", "java", "com", "example", name.toLowerCase());
        const resources = path.join(rootPath, "src", "main", "resources");
        await fs.mkdir(javaRoot, { recursive: true });
        await fs.mkdir(resources, { recursive: true });

        await fs.writeFile(path.join(rootPath, "pom.xml"), `<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>${name}</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter</artifactId>
    </dependency>
  </dependencies>
</project>`);

        await fs.writeFile(path.join(javaRoot, `${name}Application.java`), `package com.example.${name.toLowerCase()};

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class ${name}Application {
    public static void main(String[] args) {
        SpringApplication.run(${name}Application.class, args);
    }
}`);
        await fs.writeFile(path.join(resources, "application.properties"), ``);
        break;
      }
    }

    const installCommand = framework === "springboot" ? "mvn install" : "npm install";

    return {
      content: [
        {
          type: "text",
          text: `✅ ${framework} project created at: ${rootPath}\n\nWould you like to run \`${installCommand}\` now?`,
        },
      ],
      suggested_follow_ups: [
        {
          name: "Run install command",
          description: `Run ${installCommand} in ${name}`,
          parameters: {
            path: rootPath,
            command: installCommand,
          },
          tool_choice: "run-command-in-dir",
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `❌ Failed to create project: ${err}` }],
    };
  }
});



async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Developer MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
