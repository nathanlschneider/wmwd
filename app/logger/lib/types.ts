export type TimeShape = {
  time: number;
};

export type ErrorShape = {
  msg: string;
};

export type InfoShape = {
  msg: string;
};

export type SuccessShape = {
  msg: string;
};

export type DebugShape = {
  msg: string;
};

export type WarnShape = {
  msg: string;
};

export type BodyShape = {
  type: "error" | "info" | "debug" | "warn" | "success" | "request";
  time: number | string;
  msg: string | object;
  req?: string | object;
  id?: string;
};

export type ConfigShape = {
  logFile: {
    format: "styled" | "ndjson";
    enabled: boolean;
    timeType: "locale" | "epoch" | "timestamp" | "none";
    colorizeStyledLog: boolean;
  };
  console: {
    format: "styled" | "ndjson";
    enabled: boolean;
    timeType: "locale" | "epoch" | "timestamp" | "none";
    colorizeStyledLog: boolean;
  };
};

export type ServerConfigShape = {
  serverOptions: { port: number; host: string };
};
export interface LoggerConfig {
  logFile: {
    enabled: boolean;
    format: string;
    colorizeStyledLog: boolean;
    timeType: string;
  };
  console: {
    enabled: boolean;
    format: string;
    colorizeStyledLog: boolean;
    timeType: string;
  };
}

export interface Send {
  logData: string;
  error: string;
}

export type LogDataShape = {
  body: BodyShape;
  format: string;
  colorize: boolean;
  timeType: string;
};

export type LogSystem = "app" | "request";

export interface RequestPayload {
  payload: Record<string, unknown>; // More specific type than 'unknown'
  signature: string;
}

export interface ApiResponse {
  success: boolean; // Remove the optional modifier
  error?: string;
  received?: Record<string, unknown>;
  requestId: string;
  timestamp?: number; // Add timestamp for consistency
}

export interface VerificationPayload {
  verificationType: "connection";
  platformId: string;
  timestamp: number;
}

export interface OwnershipPayload {
  validationId: string;
  verificationType: "ownership";
}

export interface RequestContext {
  requestId: string;
  correlationId: string;
  timestamp: number;
  ip: string;
  startTime: number;
}
export interface ResJsonType {
  logData: string;
  error?: string;
}

export interface BlockedIP {
  id: string;
  ip: string;
}

export interface APIResponse {
  blockedIps: BlockedIP[];
}
