import type { ProjectPhoto } from "./project-photo-transfer.js";
import { INTAKE_TTL } from "./project-intake-state.js";
import { imageError } from "../shared/uploads.js";
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("aplime-intake-photos", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("This browser could not save your selected photos."));
  });
}
export async function saveIntakePhotos(key: string, photos: ProjectPhoto[]) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("photos", "readwrite");
      const store = tx.objectStore("photos");
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (row) {
          if (Date.now() - row.value.updatedAt > INTAKE_TTL) row.delete();
          row.continue();
        }
      };
      if (photos.length)
        store.put(
          {
            updatedAt: Date.now(),
            photos: photos.map(({ preview, ...photo }) => photo),
          },
          key,
        );
      else store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(
          new Error(
            "Could not save photos in this browser. Remove them to continue, then add them after signing in.",
          ),
        );
      tx.onabort = tx.onerror;
    });
  } finally {
    db.close();
  }
}
export async function loadIntakePhotos(key: string): Promise<ProjectPhoto[]> {
  const db = await database();
  try {
    const result = await new Promise<any>((resolve, reject) => {
      const req = db.transaction("photos").objectStore("photos").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!result || Date.now() - result.updatedAt > INTAKE_TTL) return [];
    return result.photos
      .slice(0, 5)
      .filter((p: any) => p.file instanceof File && !imageError(p.file))
      .map((p: any) => ({ ...p, preview: URL.createObjectURL(p.file) }));
  } finally {
    db.close();
  }
}
