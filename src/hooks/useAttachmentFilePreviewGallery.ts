import {
  attachmentPreviewKindFromUrl,
  type AttachmentFilePreviewGalleryItem,
  type AttachmentFilePreviewViewer,
} from "@/components/attachments/AttachmentFilePreview";
import { useCallback, useState } from "react";

/**
 * Shared full-screen {@link AttachmentFilePreview} state: open from a list of URLs,
 * enable prev/next when more than one item (same behavior as order details & support viewer).
 */
export function useAttachmentFilePreviewGallery() {
  const [viewer, setViewer] = useState<AttachmentFilePreviewViewer>(null);

  const openPreview = useCallback((items: readonly AttachmentFilePreviewGalleryItem[], clickedUrl: string) => {
    const u = clickedUrl.trim();
    if (!u) return;
    const normalized = items
      .map((x) => ({ url: (x.url ?? "").trim(), name: x.name ?? null }))
      .filter((x) => x.url.length > 0);
    const idx = normalized.findIndex((x) => x.url === u);
    if (idx < 0) return;
    const kind = attachmentPreviewKindFromUrl(u);
    const row = normalized[idx];
    const name = row?.name?.trim() ? row.name.trim() : null;
    if (normalized.length > 1) {
      setViewer({ kind, url: u, name, gallery: { items: normalized, index: idx } });
    } else {
      setViewer({ kind, url: u, name });
    }
  }, []);

  const closePreview = useCallback(() => setViewer(null), []);

  const onGalleryNavigate = useCallback((delta: -1 | 1) => {
    setViewer((v) => {
      if (!v?.gallery) return v;
      const { items, index } = v.gallery;
      const ni = index + delta;
      if (ni < 0 || ni >= items.length) return v;
      const item = items[ni];
      return {
        kind: attachmentPreviewKindFromUrl(item.url),
        url: item.url,
        name: item.name?.trim() ? item.name.trim() : null,
        gallery: { items, index: ni },
      };
    });
  }, []);

  return { viewer, openPreview, closePreview, onGalleryNavigate };
}
