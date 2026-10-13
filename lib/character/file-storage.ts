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
  lastSavedAt?: string;
};

const bindingCache = new Map<string, SaveBinding | null>();

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: PermissionMode }) => Promise<FileSystemDirectoryHandle>;
  }
}

export type FolderSaveResult =
  | { kind: "saved"; savedAt: string; directoryName: string; mainFileName: string; backupFileName: string }
  | { kind: "unsupported" }
  | { kind: "folder-needed" }
  | { kind: "cancelled" };

export type FolderAutosaveResult = {
  savedAt: string;
  directoryName: string;
  backupFileName: string;
};

export type FolderBindingDetails = {
  status: "missing" | "ready" | "permission-needed";
  directoryName?: string;
  mainFileName?: string;
  backupFileName?: string;
  lastSavedAt?: string;
};

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
  if (bindingCache.has(characterId)) return bindingCache.get(characterId) ?? null;
  const db = await openFileDatabase();
  const value = await new Promise<SaveBinding | undefined>((resolve, reject) => {
    const request = db.transaction(FILE_DB_STORE, "readonly").objectStore(FILE_DB_STORE).get(characterId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  const binding = value ?? null;
  bindingCache.set(characterId, binding);
  return binding;
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
  bindingCache.set(characterId, binding);
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

async function queryWritePermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  const permissioned = handle as PermissionedDirectoryHandle;
  if (typeof permissioned.queryPermission !== "function") return "granted";
  return permissioned.queryPermission({ mode: "readwrite" });
}

/**
 * Must be called directly from a click handler. Calling queryPermission first
 * can consume Chromium's short-lived user activation before the permission
 * prompt opens.
 */
async function requestWritePermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  const permissioned = handle as PermissionedDirectoryHandle;
  if (typeof permissioned.requestPermission === "function") {
    return permissioned.requestPermission({ mode: "readwrite" });
  }
  return queryWritePermission(handle);
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
  return (await folderBindingDetails(characterId)).status;
}

export async function folderBindingDetails(characterId: string): Promise<FolderBindingDetails> {
  if (!supportsFolderSaving()) return { status: "missing" };
  const binding = await getBinding(characterId);
  if (!binding) return { status: "missing" };
  const status = await queryWritePermission(binding.directory) === "granted" ? "ready" : "permission-needed";
  return {
    status,
    directoryName: binding.directory.name,
    mainFileName: binding.mainFileName,
    backupFileName: binding.backupFileName,
    lastSavedAt: binding.lastSavedAt,
  };
}

/**
 * Runs only from a click handler: browsers allow choosing a directory and
 * requesting write permission only while a user gesture is active.
 */
export async function saveCharacterToFolder(character: Character, chooseAnotherFolder = false): Promise<FolderSaveResult> {
  if (!supportsFolderSaving()) return { kind: "unsupported" };

  let binding: SaveBinding | null;
  if (chooseAnotherFolder) {
    try {
      // Keep this as the very first awaited browser operation so the picker is
      // still covered by the user's click.
      const directory = await window.showDirectoryPicker!({ mode: "readwrite" });
      binding = { directory, ...characterFileNames(character.name) };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return { kind: "cancelled" };
      throw error;
    }
  } else {
    binding = bindingCache.get(character.characterId) ?? await getBinding(character.characterId);
    if (!binding) return { kind: "folder-needed" };
  }

  if (await requestWritePermission(binding.directory) !== "granted") throw new Error("directory-permission-denied");
  const savedAt = await writeMainAndBackup(binding, character);
  binding.lastSavedAt = savedAt;
  await storeBinding(character.characterId, binding);
  return {
    kind: "saved",
    savedAt,
    directoryName: binding.directory.name,
    mainFileName: binding.mainFileName,
    backupFileName: binding.backupFileName,
  };
}

/** Writes one fixed backup file. It never opens a permission dialog from the timer. */
export async function saveFolderAutosave(character: Character): Promise<FolderAutosaveResult | null> {
  if (!supportsFolderSaving()) return null;
  const binding = await getBinding(character.characterId);
  if (!binding || await queryWritePermission(binding.directory) !== "granted") return null;

  const savedAt = new Date().toISOString();
  const backupDirectory = await binding.directory.getDirectoryHandle(BACKUP_DIRECTORY, { create: true });
  await writeJson(backupDirectory, binding.backupFileName, payload(character, savedAt));
  binding.lastSavedAt = savedAt;
  await storeBinding(character.characterId, binding);
  return { savedAt, directoryName: binding.directory.name, backupFileName: binding.backupFileName };
}
