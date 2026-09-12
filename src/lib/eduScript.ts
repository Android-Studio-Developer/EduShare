import type { DeveloperBotCommand } from "../types";

export interface EduScriptResult {
  commands: DeveloperBotCommand[];
  errors: string[];
}

const functionPattern = /^def\s+([a-z_][a-z0-9_]{0,23})\s*\(\s*user\s*,\s*args\s*\)\s*:\s*$/i;
const assignmentPattern = /^([a-z_][a-z0-9_]*)\s*=\s*f?(["'])(.*)\2\s*$/i;
const returnPattern = /^return\s+f?(["'])(.*)\1\s*$/i;
const returnVariablePattern = /^return\s+([a-z_][a-z0-9_]*)\s*$/i;

function decodeString(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\\([\\"'])/g, "$1");
}

function encodeString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

/** Compile the deliberately small, Python-shaped EduPy language into safe bot commands. */
export function compileEduScript(source: string): EduScriptResult {
  const commands: DeveloperBotCommand[] = [];
  const errors: string[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let verificationDecoratorLine = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    const lineNumber = index + 1;
    if (!line || line.startsWith("#")) continue;
    if (line.toLowerCase() === "@verify") {
      if (verificationDecoratorLine) errors.push(`Line ${lineNumber}: the previous @verify needs a function.`);
      verificationDecoratorLine = lineNumber;
      continue;
    }

    const functionMatch = line.match(functionPattern);
    if (!functionMatch) {
      verificationDecoratorLine = 0;
      errors.push(`Line ${lineNumber}: expected def command(user, args):`);
      continue;
    }

    const name = functionMatch[1].toLowerCase();
    let blockIndex = index + 1;
    while (blockIndex < lines.length && (!lines[blockIndex].trim() || lines[blockIndex].trim().startsWith("#"))) blockIndex += 1;
    if (blockIndex >= lines.length || !/^\s+/.test(lines[blockIndex])) {
      errors.push(`Line ${lineNumber}: add an indented return below this function.`);
      verificationDecoratorLine = 0;
      continue;
    }

    const variables = new Map<string, string>();
    let response = "";
    let lastBlockIndex = blockIndex;

    for (; blockIndex < lines.length; blockIndex += 1) {
      const blockRaw = lines[blockIndex];
      const blockLine = blockRaw.trim();
      if (!blockLine || blockLine.startsWith("#")) {
        lastBlockIndex = blockIndex;
        continue;
      }
      if (!/^\s+/.test(blockRaw)) break;
      lastBlockIndex = blockIndex;

      const assignmentMatch = blockLine.match(assignmentPattern);
      if (assignmentMatch) {
        variables.set(assignmentMatch[1].toLowerCase(), decodeString(assignmentMatch[3]));
        continue;
      }

      const returnMatch = blockLine.match(returnPattern);
      if (returnMatch) {
        response = decodeString(returnMatch[2]);
        break;
      }

      const returnVariableMatch = blockLine.match(returnVariablePattern);
      if (returnVariableMatch) {
        const value = variables.get(returnVariableMatch[1].toLowerCase());
        if (typeof value === "string") response = value;
        else errors.push(`Line ${blockIndex + 1}: "${returnVariableMatch[1]}" was not assigned a string.`);
        break;
      }

      errors.push(`Line ${blockIndex + 1}: expected name = "text" or return f"Your reply"`);
    }

    if (!response && !errors.some((error) => error.startsWith(`Line ${lineNumber}:`))) errors.push(`Line ${lastBlockIndex + 1}: add a return for this command.`);
    if (!response.trim()) errors.push(`Line ${lastBlockIndex + 1}: the returned reply cannot be empty.`);
    if (response.length > 300) errors.push(`Line ${lastBlockIndex + 1}: reply is longer than 300 characters.`);
    if (commands.some((command) => command.name === name)) errors.push(`Line ${lineNumber}: "${name}" is already defined.`);
    if (response.trim() && response.length <= 300 && !commands.some((command) => command.name === name)) commands.push({ name, response, action: verificationDecoratorLine ? "verify" : "reply" });
    verificationDecoratorLine = 0;
    index = Math.max(index, lastBlockIndex);
  }

  if (commands.length > 12) errors.push("Bots can have up to 12 commands.");
  if (verificationDecoratorLine) errors.push(`Line ${verificationDecoratorLine}: @verify needs a function below it.`);
  return { commands: commands.slice(0, 12), errors };
}

export function commandsToEduScript(commands: DeveloperBotCommand[]) {
  return commands.map((command) => `${command.action === "verify" ? "@verify\n" : ""}def ${command.name}(user, args):\n    return f"${encodeString(command.response)}"`).join("\n\n");
}
