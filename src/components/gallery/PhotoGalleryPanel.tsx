import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "../../i18n/I18nContext";
import { getGalleryMediaUrl } from "../../lib/photoGalleryDisplay";
import { isVideoItem } from "../../lib/photoGalleryLocal";
import { renderTransformedDataUrl, renderTransformedImage } from "../../lib/photoGalleryTransform";
import { useChatComposerStore } from "../../store/chatComposerStore";
import { getVisiblePhotos, usePhotoGalleryStore } from "../../store/photoGalleryStore";
import { useUiStore } from "../../store/uiStore";
import type { PhotoItem } from "../../types/photoGallery";
import { PhotoGalleryGrid } from "./PhotoGalleryGrid";
import { PhotoGallerySidebar } from "./PhotoGallerySidebar";
import { PhotoGalleryViewer } from "./PhotoGalleryViewer";

export function PhotoGalleryPanel() {
  const { t } = useTranslation();
  const pushToast = useUiStore((s) => s.pushToast);
  const signalOpenChat = useUiStore((s) => s.signalOpenChat);
  const photos = usePhotoGalleryStore((s) => s.photos);
  const selectedFolder = usePhotoGalleryStore((s) => s.selectedFolder);
  const folderAliases = usePhotoGalleryStore((s) => s.folderAliases);
  const search = usePhotoGalleryStore((s) => s.search);
  const removePhoto = usePhotoGalleryStore((s) => s.removePhoto);
  const rotatePhotoLeft = usePhotoGalleryStore((s) => s.rotatePhotoLeft);
  const rotatePhotoRight = usePhotoGalleryStore((s) => s.rotatePhotoRight);
  const flipPhotoHorizontal = usePhotoGalleryStore((s) => s.flipPhotoHorizontal);
  const flipPhotoVertical = usePhotoGalleryStore((s) => s.flipPhotoVertical);
  const openComposerWithImage = useChatComposerStore((s) => s.openComposerWithImage);
  const setVisionEnabled = useChatComposerStore((s) => s.setVisionEnabled);

  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState("");
  const [busy, setBusy] = useState<"copy" | "delete" | "chat" | null>(null);

  const viewerList = useMemo(
    () => getVisiblePhotos({ photos, selectedFolder, search, folderAliases }),
    [photos, selectedFolder, search, folderAliases],
  );

  const viewerIndex = useMemo(
    () => (viewerPhotoId ? viewerList.findIndex((p) => p.id === viewerPhotoId) : -1),
    [viewerList, viewerPhotoId],
  );

  const viewerPhoto = useMemo(
    () => (viewerIndex >= 0 ? viewerList[viewerIndex] ?? null : null),
    [viewerList, viewerIndex],
  );

  const goToPhoto = useCallback(async (photo: PhotoItem) => {
    const url = await getGalleryMediaUrl(photo.path, photo.kind);
    setViewerPhotoId(photo.id);
    setViewerSrc(url);
  }, []);

  const onViewPhoto = useCallback((photo: PhotoItem, src: string) => {
    setViewerPhotoId(photo.id);
    setViewerSrc(src);
  }, []);

  const onPrevious = useCallback(() => {
    if (viewerIndex > 0) {
      void goToPhoto(viewerList[viewerIndex - 1]);
    }
  }, [goToPhoto, viewerIndex, viewerList]);

  const onNext = useCallback(() => {
    if (viewerIndex >= 0 && viewerIndex < viewerList.length - 1) {
      void goToPhoto(viewerList[viewerIndex + 1]);
    }
  }, [goToPhoto, viewerIndex, viewerList]);

  const onCopy = useCallback(async () => {
    if (!viewerPhoto || !viewerSrc || isVideoItem(viewerPhoto)) return;
    setBusy("copy");
    try {
      const blob = await renderTransformedImage(viewerSrc, viewerPhoto.transform);
      const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";
      await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
      pushToast(t("photoGallery.copied"), "success");
    } catch {
      pushToast(t("photoGallery.copyFailed"), "error");
    } finally {
      setBusy(null);
    }
  }, [pushToast, t, viewerPhoto, viewerSrc]);

  const onDelete = useCallback(() => {
    if (!viewerPhoto || viewerIndex < 0) return;
    setBusy("delete");
    const nextPhoto =
      viewerList[viewerIndex + 1] ?? viewerList[viewerIndex - 1] ?? null;
    removePhoto(viewerPhoto.id);
    if (nextPhoto) {
      void goToPhoto(nextPhoto);
    } else {
      setViewerPhotoId(null);
      setViewerSrc("");
    }
    pushToast(t("photoGallery.deleted"), "success");
    setBusy(null);
  }, [goToPhoto, pushToast, removePhoto, t, viewerIndex, viewerList, viewerPhoto]);

  const onSendToChat = useCallback(async () => {
    if (!viewerPhoto || isVideoItem(viewerPhoto)) return;
    setBusy("chat");
    try {
      const src = viewerSrc || (await getGalleryMediaUrl(viewerPhoto.path, viewerPhoto.kind));
      const dataUrl = await renderTransformedDataUrl(src, viewerPhoto.transform);
      setVisionEnabled(true);
      openComposerWithImage(dataUrl, viewerPhoto.fileName);
      signalOpenChat();
      setViewerPhotoId(null);
      setViewerSrc("");
      pushToast(t("photoGallery.sentToChat"), "success");
    } catch (e) {
      pushToast(String(e), "error");
    } finally {
      setBusy(null);
    }
  }, [
    openComposerWithImage,
    pushToast,
    setVisionEnabled,
    signalOpenChat,
    t,
    viewerPhoto,
    viewerSrc,
  ]);

  return (
    <div className="zeus-photo-gallery flex h-full min-h-0 flex-col p-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <PhotoGallerySidebar />
        <PhotoGalleryGrid onViewPhoto={onViewPhoto} />
      </div>

      <PhotoGalleryViewer
        open={Boolean(viewerPhoto && viewerSrc)}
        photo={viewerPhoto}
        src={viewerSrc}
        navIndex={Math.max(0, viewerIndex)}
        navTotal={viewerList.length}
        hasPrevious={viewerIndex > 0}
        hasNext={viewerIndex >= 0 && viewerIndex < viewerList.length - 1}
        copying={busy === "copy"}
        deleting={busy === "delete"}
        sendingToChat={busy === "chat"}
        onClose={() => {
          setViewerPhotoId(null);
          setViewerSrc("");
        }}
        onCopy={() => void onCopy()}
        onDelete={onDelete}
        onSendToChat={() => void onSendToChat()}
        onPrevious={onPrevious}
        onNext={onNext}
        onRotateLeft={() => viewerPhoto && !isVideoItem(viewerPhoto) && rotatePhotoLeft(viewerPhoto.id)}
        onRotateRight={() => viewerPhoto && !isVideoItem(viewerPhoto) && rotatePhotoRight(viewerPhoto.id)}
        onFlipHorizontal={() => viewerPhoto && !isVideoItem(viewerPhoto) && flipPhotoHorizontal(viewerPhoto.id)}
        onFlipVertical={() => viewerPhoto && !isVideoItem(viewerPhoto) && flipPhotoVertical(viewerPhoto.id)}
      />
    </div>
  );
}
