import type { DeveloperBotCommand, DeveloperBotCondition, DeveloperBotPanel } from "../types";

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
const panelPattern = /^panel\s+f?(["'])(.*)\1\s*$/i;
const descriptionPattern = /^description\s+f?(["'])(.*)\1\s*$/i;
const colorPattern = /^color\s+(["'])(#[0-9a-f]{6})\1\s*$/i;
const fieldPattern = /^field\s+(["'])(.*?)\1\s+(["'])(.*?)\3\s*$/i;
const buttonPattern = /^button\s+(["'])(.*?)\1(?:\s+(verify|link)(?:\s+(["'])(.*?)\4)?)?\s*$/i;
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
    panel "Server verification"
    description "Welcome {user}. Verify to unlock the server."
    color "#60a5fa"
    field "Minecraft name" "{args}"
    field "Status" "Ready to verify"
    button "Verify me" verify`,
  },
  {
    id: "server-helper",
    name: "Minecraft server helper",
    description: "Replies with server status, code, and quick help.",
    source: `command code:
    panel "🎮 Minecraft Education"
    description "The world is online."
    color "#22c55e"
    field "Join code" "ABC123"
    field "Need help?" "Ping @admins"

command help:
    say "Commands: code, rules, verify. Args are whatever the user types after the command."`,
  },
  {
    id: "support-bot",
    name: "Support ticket starter",
    description: "Collects a short problem description using {args}.",
    source: `command ticket:
    panel "🛠️ Support request"
    description "A staff member will reply soon."
    color "#a855f7"
    field "Member" "{user}"
    field "Problem" "{args}"`,
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
    let panel: DeveloperBotPanel | undefined;
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
        const title = decodeString(embedMatch[2]);
        panel = { ...(panel ?? { title }), title };
        continue;
      }

      const panelMatch = blockLine.match(panelPattern);
      if (panelMatch) {
        const title = decodeString(panelMatch[2]);
        panel = { ...(panel ?? { title }), title };
        continue;
      }

      const descriptionMatch = blockLine.match(descriptionPattern);
      if (descriptionMatch) {
        if (!panel) errors.push(`Line ${blockIndex + 1}: add panel "Title" before description.`);
        else panel.description = decodeString(descriptionMatch[2]);
        continue;
      }

      const colorMatch = blockLine.match(colorPattern);
      if (colorMatch) {
        if (!panel) errors.push(`Line ${blockIndex + 1}: add panel "Title" before color.`);
        else panel.color = colorMatch[2].toLowerCase();
        continue;
      }

      const fieldMatch = blockLine.match(fieldPattern);
      if (fieldMatch) {
        if (!panel) errors.push(`Line ${blockIndex + 1}: add panel "Title" before field.`);
        else panel.fields = [...(panel.fields ?? []), { name: decodeString(fieldMatch[2]), value: decodeString(fieldMatch[4]) }].slice(0, 8);
        continue;
      }

      const buttonMatch = blockLine.match(buttonPattern);
      if (buttonMatch) {
        if (!panel) errors.push(`Line ${blockIndex + 1}: add panel "Title" before button.`);
        else {
          const buttonAction = buttonMatch[3]?.toLowerCase() === "link" ? "link" : "verify";
          const url = buttonAction === "link" ? decodeString(buttonMatch[5] ?? "") : undefined;
          if (buttonAction === "link" && !/^https:\/\//i.test(url ?? "")) errors.push(`Line ${blockIndex + 1}: link buttons need an https:// URL.`);
          else panel.button = { label: decodeString(buttonMatch[2]), action: buttonAction, ...(url ? { url } : {}) };
        }
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

      errors.push(`Line ${blockIndex + 1}: expected if/elif/else, say "text", panel "title", description "text", field "name" "value", button "label" verify, authenticate user, or return "text".`);
    }

    const validConditions = conditions.filter((condition) => condition.response.trim());
    if (!response && !validConditions.length && !panel && !errors.some((error) => error.startsWith(`Line ${lineNumber}:`))) errors.push(`Line ${lastBlockIndex + 1}: add a reply or a panel for this command.`);
    if (conditions.some((condition) => !condition.response.trim())) errors.push(`Line ${lastBlockIndex + 1}: every if/elif branch needs a reply.`);
    if (response.length > 300 || validConditions.some((condition) => condition.response.length > 300)) errors.push(`Line ${lastBlockIndex + 1}: each reply must be 300 characters or shorter.`);
    if (commands.some((command) => command.name === name)) errors.push(`Line ${lineNumber}: "${name}" is already defined.`);
    if ((response.trim() || validConditions.length || panel) && response.length <= 300 && !commands.some((command) => command.name === name)) commands.push({ name, response, action, ...(validConditions.length ? { conditions: validConditions } : {}), ...(panel ? { panel } : {}) });
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
    if (command.panel) {
      lines.push(`    panel "${encodeString(command.panel.title)}"`);
      if (command.panel.description) lines.push(`    description "${encodeString(command.panel.description)}"`);
      if (command.panel.color) lines.push(`    color "${command.panel.color}"`);
      (command.panel.fields ?? []).forEach((field) => lines.push(`    field "${encodeString(field.name)}" "${encodeString(field.value)}"`));
      if (command.panel.button) lines.push(`    button "${encodeString(command.panel.button.label)}" ${command.panel.button.action}${command.panel.button.url ? ` "${encodeString(command.panel.button.url)}"` : ""}`);
    }
    if (command.conditions?.length) {
      if (command.response) lines.push(`    else:`, `        say "${encodeString(command.response)}"`);
    } else if (command.response) lines.push(`    say "${encodeString(command.response)}"`);
    return lines.join("\n");
  }).join("\n\n");
}

function fillTemplate(value: string, user: string, args: string) {
  return value.replace(/\{user\}/gi, user).replace(/\{args\}/gi, args || "nothing");
}

export function renderDeveloperBotPanel(command: DeveloperBotCommand, user: string, args: string): DeveloperBotPanel | undefined {
  if (!command.panel) return undefined;
  return {
    ...command.panel,
    title: fillTemplate(command.panel.title, user, args.trim()),
    description: command.panel.description ? fillTemplate(command.panel.description, user, args.trim()) : undefined,
    fields: command.panel.fields?.map((field) => ({ ...field, name: fillTemplate(field.name, user, args.trim()), value: fillTemplate(field.value, user, args.trim()) })),
  };
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
  return fillTemplate(match?.response || command.response || command.panel?.description || command.panel?.title || "I don't have a response for that yet.", user, input);
}
