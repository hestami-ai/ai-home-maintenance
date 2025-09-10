export interface TimelineEntry {
    id: string;
    service_request: string;
    entry_type: 'COMMENT' | 'STATUS_CHANGE' | 'DOCUMENT' | string;
    content: string;
    metadata?: {
        attachments?: Array<{
            id: string;
            filename: string;
            url: string;
            media_type: string;
            size: number;
        }>;
        new_status?: string;
        reason?: string;
        document_url?: string;
        document_name?: string;
        [key: string]: any;
    };
    created_at: string;
    updated_at: string;
    created_by?: {
        id: string;
        username: string;
        email?: string;
        first_name?: string;
        last_name?: string;
    };
    is_read: boolean;
    is_deleted: boolean;
}

export interface TimelineComment extends TimelineEntry {
    entry_type: 'COMMENT';
    visibility?: 'ALL' | 'PROPERTY_OWNER' | 'PROVIDER' | 'STAFF';
}

export interface TimelineStatusChange extends TimelineEntry {
    entry_type: 'STATUS_CHANGE';
    metadata: {
        old_status: string;
        new_status: string;
        reason?: string;
    };
}

export interface TimelineDocument extends TimelineEntry {
    entry_type: 'DOCUMENT';
    metadata: {
        document_url: string;
        document_name: string;
        document_type?: string;
        document_size?: number;
    };
}

export interface TimelineReadReceipt {
    id: string;
    entry: string;
    user: string;
    read_at: string;
}

export interface UnreadCountResponse {
    count: number;
}
