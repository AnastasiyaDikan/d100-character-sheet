import type { Character } from "./types";

const FILE_DB_NAME = "d100-character-sheet-files";
const FILE_DB_STORE = "save-bindings";
const BACKUP_DIRECTORY = "save";

export const FOLDER_AUTOSAVE_INTERVAL_MS = 20 * 60 * 1000;

type PermissionMode = "read" | "readwrite";
type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission(options?: { mode?: PermissionMode }): Promise<PermissionState>;
  requestPermission(options?: { mode?: PermissionMode }): Promise<PermissionState>;
};

type SaveBinding = {
  directory: FileSystemDirectoryHandle;
  mainFileName: string;
  backupFileName: string;
};

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: PermissionMode }) => Promise<FileSystemDirectoryHandle>;
  }
}

export type FolderSaveResult =
  | { kind: "saved"; savedAt: string }
  | { kind: "unsupported" }
  | { kind: "cancelled" };

function openFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(FILE_DB_STORE)) request.result.createObjectStore(FILE_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getBinding(characterId: string): Promise<SaveBinding | null> {
  const db = await openFileDatabase();
  const value = await new Promise<SaveBinding | undefined>((resolve, reject) => {
    const request = db.transaction(FILE_DB_STORE, "readonly").objectStore(FILE_DB_STORE).get(characterId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value ?? null;
}

async function storeBinding(characterId: string, binding: SaveBinding): Promise<void> {
  const db = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(FILE_DB_STORE, "readwrite");
    transaction.objectStore(FILE_DB_STORE).put(binding, characterId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export function characterFileBase(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").replace(/[. ]+$/g, "").trim() || "character";
}

export function characterFileNames(name: string) {
  const base = characterFileBase(name);
  return { mainFileName: `${base}.json`, backupFileName: `${base}.autosave.json` };
}

function payload(character: Character, savedAt = new Date().toISOString()): Character {
  return { ...character, savedAt };
}

async function permission(handle: FileSystemDirectoryHandle, request: boolean): Promise<PermissionState> {
  const permissioned = handle as PermissionedDirectoryHandle;
  if (typeof permissioned.queryPermission !== "function") return "granted";
  const current = await permissioned.queryPermission({ mode: "readwrite" });
  if (current === "granted" || !request || typeof permissioned.requestPermission !== "function") return current;
  return permissioned.requestPermission({ mode: "readwrite" });
}

async function writeJson(directory: FileSystemDirectoryHandle, fileName: string, character: Character): Promise<void> {
  const file = await directory.getFileHandle(fileName, { create: true });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(character, null, 2));
  await writable.close();
}

async function writeMainAndBackup(binding: SaveBinding, character: Character): Promise<string> {
  const savedAt = new Date().toISOString();
  const savedCharacter = payload(character, savedAt);
  await writeJson(binding.directory, binding.mainFileName, savedCharacter);
  const backupDirectory = await binding.directory.getDirectoryHandle(BACKUP_DIRECTORY, { create: true });
  await writeJson(backupDirectory, binding.backupFileName, savedCharacter);
  return savedAt;
}

export function supportsFolderSaving(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

export async function folderBindingStatus(characterId: string): Promise<"missing" | "ready" | "permission-needed"> {
  if (!supportsFolderSaving()) return "missing";
  const binding = await getBinding(characterId);
  if (!binding) return "missing";
  return await permission(binding.directory, false) === "granted" ? "ready" : "permission-needed";
}

/**
 * Runs only from a click handler: browsers allow choosing a directory and
 * requesting write permission only while a user gesture is active.
 */
export async function saveCharacterToFolder(character: Character, chooseAnotherFolder = false): Promise<FolderSaveResult> {
  if (!supportsFolderSaving()) return { kind: "unsupported" };

  let binding = chooseAnotherFolder ? null : await getBinding(character.characterId);
  if (!binding) {
    try {
      const directory = await window.showDirectoryPicker!({ mode: "readwrite" });
      binding = { directory, ...characterFileNames(character.name) };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return { kind: "cancelled" };
      throw error;
    }
  }

  if (await permission(binding.directory, true) !== "granted") throw new Error("directory-permission-denied");
  const savedAt = await writeMainAndBackup(binding, character);
  await storeBinding(character.characterId, binding);
  return { kind: "saved", savedAt };
}

/** Writes one fixed backup file. It never opens a permission dialog from the timer. */
export async function saveFolderAutosave(character: Character): Promise<string | null> {
  if (!supportsFolderSaving()) return null;
  const binding = await getBinding(character.characterId);
  if (!binding || await permission(binding.directory, false) !== "granted") return null;

  const savedAt = new Date().toISOString();
  const backupDirectory = await binding.directory.getDirectoryHandle(BACKUP_DIRECTORY, { create: true });
  await writeJson(backupDirectory, binding.backupFileName, payload(character, savedAt));
  return savedAt;
}
