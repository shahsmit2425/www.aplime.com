export type ProjectPhoto = {
  key: string;
  file: File;
  preview: string;
  uploadId?: string;
  uploadPath?: string;
  transferred?: boolean;
  done?: boolean;
  saved?: boolean;
};
export type PhotoTransport = {
  request: (path: string, body: unknown) => Promise<any>;
  upload: (path: string, file: File) => Promise<void>;
};
export async function transferProjectPhoto(
  projectId: string,
  photo: ProjectPhoto,
  transport: PhotoTransport,
) {
  if (photo.transferred) return;
  if (!photo.uploadId) {
    const reservation = await transport.request(
      `/projects/${projectId}/photos/reservations`,
      {
        name: photo.file.name,
        contentType: photo.file.type,
        size: photo.file.size,
        clientKey: photo.key,
      },
    );
    photo.uploadId = reservation.id;
    photo.uploadPath = reservation.uploadPath;
  }
  await transport.upload(
    photo.uploadPath || `/project-photos/${photo.uploadId}/content`,
    photo.file,
  );
  photo.transferred = true;
}
// Keep successful transfers across retries; only the final atomic commit marks
// the new project's photos saved. A lost commit response can safely be retried.
export async function publishPhotos(
  projectId: string,
  photos: ProjectPhoto[],
  transport: PhotoTransport,
  progress: (message: string) => void = () => {},
) {
  if (!photos.length) return;
  for (let i = 0; i < photos.length; i++) {
    progress(`Uploading photo ${i + 1} of ${photos.length}…`);
    await transferProjectPhoto(projectId, photos[i], transport);
  }
  progress("Saving project photos…");
  try {
    await transport.request(`/projects/${projectId}/photos/complete`, {
      photoIds: photos.map((photo) => photo.uploadId!),
    });
  } catch (error) {
    // An explicit integrity failure needs fresh bytes; a lost HTTP response
    // only needs an idempotent completion retry.
    if ((error as { status?: number }).status === 400)
      for (const photo of photos) if (!photo.saved) photo.transferred = false;
    throw error;
  }
  for (const photo of photos) {
    photo.done = true;
    photo.saved = true;
  }
}
