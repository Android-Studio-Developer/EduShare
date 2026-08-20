import { Client, ID, Storage } from "appwrite";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const storage = new Storage(client);
export const CHAT_BUCKET_ID = import.meta.env.VITE_APPWRITE_CHAT_BUCKET_ID as string | undefined;
export const isAppwriteConfigured = Boolean(CHAT_BUCKET_ID);

export function chatFileViewUrl(fileId: string) {
  return storage.getFileView({ bucketId: CHAT_BUCKET_ID!, fileId });
}

export async function uploadChatFile(file: File) {
  const created = await storage.createFile({ bucketId: CHAT_BUCKET_ID!, fileId: ID.unique(), file });
  return { fileId: created.$id, url: chatFileViewUrl(created.$id) };
}

export function deleteChatFile(fileId: string) {
  return storage.deleteFile({ bucketId: CHAT_BUCKET_ID!, fileId }).catch(() => {});
}

// Manual-only — call this once from devtools if you want the "Send a ping"
// checkmark in the Appwrite console. Never wired into app startup on purpose.
export function pingAppwrite() {
  return client.ping();
}

if (import.meta.env.DEV) {
  (window as unknown as { pingAppwrite: typeof pingAppwrite }).pingAppwrite = pingAppwrite;
}
