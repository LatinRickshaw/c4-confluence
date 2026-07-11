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
}
