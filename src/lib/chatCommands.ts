export interface ChatSlashCommand {
  name: string;
  description: string;
  category: string;
  insertText: string;
}

export const BASIC_CHAT_COMMANDS: ChatSlashCommand[] = [
  { name: "shrug", description: "Add ¯\\_(ツ)_/¯ to your message.", category: "Basic", insertText: "/shrug " },
  { name: "me", description: "Send an action-style message.", category: "Basic", insertText: "/me " },
  { name: "spoiler", description: "Hide text behind a spoiler warning.", category: "Basic", insertText: "/spoiler " },
  { name: "tableflip", description: "Add the table-flip emote.", category: "Basic", insertText: "/tableflip " },
  { name: "unflip", description: "Put the table back.", category: "Basic", insertText: "/unflip " },
  { name: "tts", description: "Mark a message to be read aloud.", category: "Accessibility", insertText: "/tts " },
  { name: "settings", description: "Show where notification settings live.", category: "Settings", insertText: "/settings" },
];

export type AppliedChatCommand = { text: string; tts?: boolean } | { settings: true };

export function applyBasicChatCommand(input: string): AppliedChatCommand | null {
  const match = input.match(/^\/(shrug|me|spoiler|tableflip|unflip|tts|settings)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const command = match[1].toLowerCase();
  const content = (match[2] ?? "").trim();
  if (command === "settings") return { settings: true };
  if (!content) return { text: "" };
  if (command === "shrug") return { text: `${content} ¯\\_(ツ)_/¯` };
  if (command === "me") return { text: `＊ ${content}` };
  if (command === "spoiler") return { text: `||${content}||` };
  if (command === "tableflip") return { text: `${content} (╯°□°）╯︵ ┻━┻` };
  if (command === "unflip") return { text: `${content} ┬─┬ ノ( ゜-゜ノ)` };
  return { text: `🔊 ${content}`, tts: true };
}
