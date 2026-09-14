import type { DeveloperBotCommand, DeveloperBotCondition } from "../types";

export interface EduScriptResult {
  commands: DeveloperBotCommand[];
  errors: string[];
}

export interface EduScriptTemplate {
  id: string;
  name: string;
  description: string;
  source: string;
}

const headerPatterns = [
  /^def\s+([a-z_][a-z0-9_]{0,23})\s*\(\s*user\s*,\s*args\s*\)\s*:\s*$/i,
  /^command\s+([a-z_][a-z0-9_-]{0,23})\s*:\s*$/i,
  /^on\s+([a-z_][a-z0-9_-]{0,23})\s*:\s*$/i,
];
const assignmentPattern = /^(?:let\s+)?([a-z_][a-z0-9_]*)\s*=\s*f?(["'])(.*)\2\s*$/i;
const outputPattern = /^(?:return|reply|say|send)\s+f?(["'])(.*)\1\s*$/i;
const outputVariablePattern = /^(?:return|reply|say|send)\s+([a-z_][a-z0-9_]*)\s*$/i;
const embedPattern = /^embed\s+f?(["'])(.*)\1\s*$/i;
const buttonPattern = /^button\s+f?(["'])(.*)\1\s*$/i;
const authenticatePattern = /^(?:authenticate|verify)\s+user\s*$/i;
const conditionPattern = /^(if|elif)\s+args\s*(==|contains|starts_with)\s*(["'])(.*)\3\s*:\s*$/i;
const emptyConditionPattern = /^if\s+(not\s+)?args\s*:\s*$/i;
const elsePattern = /^else\s*:\s*$/i;

export const eduScriptTemplates: EduScriptTemplate[] = [
  {
    id: "auth-panel",
    name: "Join + authenticate panel",
    description: "Users run one command, get verified, and receive join instructions.",
    source: `# People type: /yourbot join minecraft-name
@verify
command join:
    authenticate user
    embed "✅ Authentication panel"
    say "Welcome {user}! You are verified. Join code / extra info: {args}"
    button "Joined + verified"`,
  },
  {
    id: "server-helper",
    name: "Minecraft server helper",
    description: "Replies with server status, code, and quick help.",
    source: `command code:
    embed "🎮 MC Education"
    say "Join code: ABC123 • Ask staff if the world is full."
    button "Copy join code"

command help:
    say "Commands: code, rules, verify. Args are whatever the user types after the command."`,
  },
  {
    id: "support-bot",
    name: "Support ticket starter",
    description: "Collects a short problem description using {args}.",
    source: `command ticket:
    embed "🛠️ Support request"
    say "{user} needs help with: {args}"
    button "Staff will reply soon"`,
  },
  {
    id: "smart-helper",
    name: "Smart if / else helper",
    description: "Give a different answer based on what the member types.",
    source: `command help:
    if args == "rules":
        say "Read #rules before chatting."
    elif args contains "join":
        say "Ask an admin for the current Minecraft join code."
    else:
        say "Try: help rules or help join"`,
  },
];

function decodeString(value: string) {
  return value.replace(/\\n/g, "\n").replace(/\\([\\"'])/g, "$1");
}

function encodeString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function cleanCommandName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
}

function parseHeader(line: string) {
  for (const pattern of headerPatterns) {
    const match = line.match(pattern);
    if (match) return cleanCommandName(match[1]);
  }
  return "";
}

function appendLine(current: string, next: string) {
  const clean = next.trim();
  if (!clean) return current;
  return current ? `${current}\n${clean}` : clean;
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
    if (/^@(verify|auth|authenticate)$/i.test(line)) {
      if (verificationDecoratorLine) errors.push(`Line ${lineNumber}: the previous @verify needs a command below it.`);
      verificationDecoratorLine = lineNumber;
      continue;
    }

    const name = parseHeader(line);
    if (!name) {
      verificationDecoratorLine = 0;
      errors.push(`Line ${lineNumber}: expected command name:, on name:, or def name(user, args):`);
      continue;
    }

    let blockIndex = index + 1;
    while (blockIndex < lines.length && (!lines[blockIndex].trim() || lines[blockIndex].trim().startsWith("#"))) blockIndex += 1;
    if (blockIndex >= lines.length || !/^\s+/.test(lines[blockIndex])) {
      errors.push(`Line ${lineNumber}: add indented actions below this command.`);
      verificationDecoratorLine = 0;
      continue;
    }

    const variables = new Map<string, string>();
    let response = "";
    const conditions: DeveloperBotCondition[] = [];
    let activeCondition: DeveloperBotCondition | null = null;
    let action: DeveloperBotCommand["action"] = verificationDecoratorLine ? "verify" : "reply";
    let lastBlockIndex = blockIndex;
    let ended = false;

    for (; blockIndex < lines.length; blockIndex += 1) {
      const blockRaw = lines[blockIndex];
      const blockLine = blockRaw.trim();
      if (!blockLine || blockLine.startsWith("#")) {
        lastBlockIndex = blockIndex;
        continue;
      }
      if (!/^\s+/.test(blockRaw)) break;
      lastBlockIndex = blockIndex;

      const conditionMatch = blockLine.match(conditionPattern);
      if (conditionMatch) {
        const operator = conditionMatch[2].toLowerCase() === "==" ? "equals" : conditionMatch[2].toLowerCase() as DeveloperBotCondition["operator"];
        activeCondition = { operator, value: decodeString(conditionMatch[4]), response: "" };
        conditions.push(activeCondition);
        continue;
      }
      const emptyMatch = blockLine.match(emptyConditionPattern);
      if (emptyMatch) {
        activeCondition = { operator: emptyMatch[1] ? "empty" : "not_empty", value: "", response: "" };
        conditions.push(activeCondition);
        continue;
      }
      if (elsePattern.test(blockLine)) {
        activeCondition = null;
        continue;
      }

      const assignmentMatch = blockLine.match(assignmentPattern);
      if (assignmentMatch) {
        variables.set(assignmentMatch[1].toLowerCase(), decodeString(assignmentMatch[3]));
        continue;
      }

      if (authenticatePattern.test(blockLine)) {
        action = "verify";
        continue;
      }

      const embedMatch = blockLine.match(embedPattern);
      if (embedMatch) {
        const next = `**${decodeString(embedMatch[2])}**`;
        if (activeCondition) activeCondition.response = appendLine(activeCondition.response, next);
        else response = appendLine(response, next);
        continue;
      }

      const buttonMatch = blockLine.match(buttonPattern);
      if (buttonMatch) {
        const next = `▸ ${decodeString(buttonMatch[2])}`;
        if (activeCondition) activeCondition.response = appendLine(activeCondition.response, next);
        else response = appendLine(response, next);
        continue;
      }

      const outputMatch = blockLine.match(outputPattern);
      if (outputMatch) {
        const next = decodeString(outputMatch[2]);
        if (activeCondition) activeCondition.response = appendLine(activeCondition.response, next);
        else response = appendLine(response, next);
        ended = blockLine.toLowerCase().startsWith("return") && !activeCondition;
        if (ended) break;
        continue;
      }

      const outputVariableMatch = blockLine.match(outputVariablePattern);
      if (outputVariableMatch) {
        const value = variables.get(outputVariableMatch[1].toLowerCase());
        if (typeof value === "string") {
          if (activeCondition) activeCondition.response = appendLine(activeCondition.response, value);
          else response = appendLine(response, value);
        }
        else errors.push(`Line ${blockIndex + 1}: "${outputVariableMatch[1]}" was not assigned a string.`);
        ended = blockLine.toLowerCase().startsWith("return") && !activeCondition;
        if (ended) break;
        continue;
      }

      errors.push(`Line ${blockIndex + 1}: expected if/elif/else, say "text", embed "title", button "label", authenticate user, let name = "text", or return "text".`);
    }

    const validConditions = conditions.filter((condition) => condition.response.trim());
    if (!response && !validConditions.length && !errors.some((error) => error.startsWith(`Line ${lineNumber}:`))) errors.push(`Line ${lastBlockIndex + 1}: add a say/reply/return for this command.`);
    if (conditions.some((condition) => !condition.response.trim())) errors.push(`Line ${lastBlockIndex + 1}: every if/elif branch needs a reply.`);
    if (response.length > 300 || validConditions.some((condition) => condition.response.length > 300)) errors.push(`Line ${lastBlockIndex + 1}: each reply must be 300 characters or shorter.`);
    if (commands.some((command) => command.name === name)) errors.push(`Line ${lineNumber}: "${name}" is already defined.`);
    if ((response.trim() || validConditions.length) && response.length <= 300 && !commands.some((command) => command.name === name)) commands.push({ name, response, action, ...(validConditions.length ? { conditions: validConditions } : {}) });
    verificationDecoratorLine = 0;
    index = Math.max(index, ended ? blockIndex : lastBlockIndex);
  }

  if (commands.length > 12) errors.push("Bots can have up to 12 commands.");
  if (verificationDecoratorLine) errors.push(`Line ${verificationDecoratorLine}: @verify needs a command below it.`);
  return { commands: commands.slice(0, 12), errors };
}

export function commandsToEduScript(commands: DeveloperBotCommand[]) {
  return commands.map((command) => {
    const lines = [`${command.action === "verify" ? "@verify\n" : ""}command ${command.name}:`];
    (command.conditions ?? []).forEach((condition, index) => {
      const keyword = index === 0 ? "if" : "elif";
      if (condition.operator === "empty") lines.push(`    if not args:`);
      else if (condition.operator === "not_empty") lines.push(`    if args:`);
      else lines.push(`    ${keyword} args ${condition.operator === "equals" ? "==" : condition.operator} "${encodeString(condition.value)}":`);
      lines.push(`        say "${encodeString(condition.response)}"`);
    });
    if (command.conditions?.length) {
      if (command.response) lines.push(`    else:`, `        say "${encodeString(command.response)}"`);
    } else lines.push(`    say "${encodeString(command.response)}"`);
    return lines.join("\n");
  }).join("\n\n");
}

export function renderDeveloperBotCommand(command: DeveloperBotCommand, user: string, args: string) {
  const input = args.trim();
  const lower = input.toLowerCase();
  const match = (command.conditions ?? []).find((condition) => {
    const expected = condition.value.trim().toLowerCase();
    if (condition.operator === "empty") return !input;
    if (condition.operator === "not_empty") return !!input;
    if (condition.operator === "contains") return lower.includes(expected);
    if (condition.operator === "starts_with") return lower.startsWith(expected);
    return lower === expected;
  });
  return (match?.response || command.response || "I don't have a response for that yet.")
    .replace(/\{user\}/gi, user)
    .replace(/\{args\}/gi, input || "nothing");
}
