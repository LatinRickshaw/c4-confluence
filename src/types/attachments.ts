export interface ConfluenceAttachment {
  id: string;
  title: string;
  mediaType: string;
  downloadLink: string;
  version?: number;
}

export interface DrawioDiagramResult {
  found: boolean;
  message?: string;
  title?: string;
  attachmentId?: string;
  attachmentVersion?: number;
  xml?: string;
  /** Set when the page has more than one .drawio/.xml attachment - only the first is ever used. */
  warning?: string;
}
