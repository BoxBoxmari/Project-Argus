export interface Item {
    id: string;
    url: string;
    key: string;
    priority: number;
    retries: number;
    addedAt: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Req {
    url: string;
    domain?: string;
}