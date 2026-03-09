export interface User {
  id: string;
  name: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
}

export type ScanStatus = 'PENDING' | 'SAFE' | 'QUARANTINED';
export type MessageStatus = 'SENT' | 'DELIVERED' | 'READ';

export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  objectKey: string;
  scanStatus: ScanStatus;
  expiresAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string | null;
  attachmentId: string | null;
  status: MessageStatus;
  createdAt: string;
}
