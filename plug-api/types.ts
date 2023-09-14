export type FileMeta = {
  name: string;
  lastModified: number;
  contentType: string;
  size: number;
  perm: "ro" | "rw";
  noSync?: boolean;
} & Record<string, any>;

// Message Queue related types
export type MQMessage = {
  id: string;
  queue: string;
  body: any;
  retries?: number;
};

export type MQStats = {
  queued: number;
  processing: number;
  dlq: number;
};

export type MQSubscribeOptions = {
  batchSize?: number;
  pollInterval?: number;
};

// Key-Value Store related types
export type KvKey = string[];

export type KV<T = any> = {
  key: KvKey;
  value: T;
};

export type OrderBy = {
  attribute: string;
  desc: boolean;
};

export type Select = {
  name: string;
  expr?: QueryExpression;
};

export type Query = {
  querySource?: string;
  filter?: QueryExpression;
  orderBy?: OrderBy[];
  select?: Select[];
  limit?: number;
  render?: string;
};

export type KvQuery = Omit<Query, "querySource"> & {
  prefix?: KvKey;
};

export type QueryExpression =
  | ["and", QueryExpression, QueryExpression]
  | ["or", QueryExpression, QueryExpression]
  | ["=", QueryExpression, QueryExpression]
  | ["!=", QueryExpression, QueryExpression]
  | ["=~", QueryExpression, QueryExpression]
  | ["!=~", QueryExpression, QueryExpression]
  | ["<", QueryExpression, QueryExpression]
  | ["<=", QueryExpression, QueryExpression]
  | [">", QueryExpression, QueryExpression]
  | [">=", QueryExpression, QueryExpression]
  | ["in", QueryExpression, QueryExpression]
  | ["attr", QueryExpression, string]
  | ["attr", string]
  | ["number", number]
  | ["string", string]
  | ["boolean", boolean]
  | ["null"]
  | ["array", QueryExpression[]]
  | ["object", Record<string, any>]
  | ["regexp", string, string] // regex, modifier
  | ["+", QueryExpression, QueryExpression]
  | ["-", QueryExpression, QueryExpression]
  | ["*", QueryExpression, QueryExpression]
  | ["%", QueryExpression, QueryExpression]
  | ["/", QueryExpression, QueryExpression]
  | ["call", string, QueryExpression[]];

export type FunctionMap = Record<string, (...args: any[]) => any>;

// Object indexing related types
export type ObjectValue<T = any> = KV<T> & { type: string };
