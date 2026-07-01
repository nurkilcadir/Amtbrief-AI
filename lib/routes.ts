export type DocumentSection = "overview" | "checklist" | "reply";

export function getScanSectionHref(scanId: string, section: DocumentSection) {
  return `/scans/${encodeURIComponent(scanId)}/${section}`;
}

export function getScanExportHref(scanId: string) {
  return `/scans/${encodeURIComponent(scanId)}/export`;
}
