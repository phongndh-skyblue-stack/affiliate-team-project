export interface ProxyResponse {
  id: string;
  name: string;
  protocol: string;
  host: string;
  port: string;
  username: string | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyListResponse {
  total: number;
  items: ProxyResponse[];
}

export interface ProxyCreate {
  name: string;
  protocol: string;
  host: string;
  port: string;
  username?: string | null;
  password?: string | null;
}

export interface ProxyUpdate {
  name?: string;
  protocol?: string;
  host?: string;
  port?: string;
  username?: string | null;
  password?: string | null;
}
