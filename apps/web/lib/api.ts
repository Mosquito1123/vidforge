const API_BASE =
  (typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL
    : process.env.API_URL) || "http://localhost:4000";

const TOKEN_KEY = "vidforge_token";
const REFRESH_KEY = "vidforge_refresh_token";
const DEVICE_KEY = "vidforge_device_id";

/**
 * Stable per-browser device id used by login risk scoring. Not a fingerprint:
 * it only distinguishes "this browser" from "a new browser".
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(DEVICE_KEY, generated);
    return generated;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

export function clearSession() {
  setToken(null);
  setRefreshToken(null);
}

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status?: number;
};

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
        credentials: "include",
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const data = await res.json();
      if (data?.accessToken) setToken(data.accessToken);
      if (data?.refreshToken) setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const deviceId = getDeviceId();
    if (deviceId) headers["X-Device-Id"] = deviceId;

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (res.status === 401 && retry && !path.startsWith("/auth/")) {
      const ok = await tryRefresh();
      if (ok) return request<T>(path, options, false);
    }

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        message = body?.detail || body?.message || body?.error || message;
      } catch {
        // ignore parse errors
      }
      return { data: null, error: message, status: res.status };
    }

    const text = await res.text();
    if (!text) return { data: null, error: null, status: res.status };
    const data = JSON.parse(text) as T;
    return { data, error: null, status: res.status };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export type ApiUser = {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  locale?: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
};
export type CreditAccount = { balance: number | string; transactions?: unknown[] };
export type AutoRefillSettings = {
  enabled: boolean;
  threshold: number;
  amount: number;
  packageId?: string | null;
  updatedAt?: string;
};
export type ApiTask = {
  id: string;
  userId?: string;
  modelId?: string;
  /** Media tool pipeline; "generate" for text/image to video. */
  tool?: string;
  model?: { id: string; slug: string; name: string; creditsCost?: number | string; watermark?: boolean; watermarkPolicy?: boolean; watermarked?: boolean; hasWatermark?: boolean };
  status: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  progress: number;
  stage?: string | null;
  moderation?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt?: string;
  watermark?: boolean;
  watermarkPolicy?: boolean;
  watermarked?: boolean;
  hasWatermark?: boolean;
};
export type ApiModel = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  type: string;
  creditsCost: number | string;
  active: boolean;
  metadata?: Record<string, unknown> | null;
  watermark?: boolean;
  watermarkPolicy?: boolean;
  watermarked?: boolean;
  hasWatermark?: boolean;
};

export type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  adminRole?: string | null;
  isAdmin?: boolean;
  banned?: boolean;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  creditAccount?: { balance: number | string } | null;
};

export type AdminTask = ApiTask & {
  user?: { id: string; email: string; name?: string | null } | null;
};

export type AdminRefund = {
  id: string;
  status: string;
  amountCents?: number;
  reason?: string | null;
  createdAt: string;
  payment?: {
    id: string;
    userId?: string;
    amountCents?: number;
    user?: { id: string; email: string; name?: string | null } | null;
  } | null;
};

export type AdminPayment = Payment & {
  user?: { id: string; email: string; name?: string | null } | null;
  refunds?: AdminRefund[];
};

export type AdminAuditLog = {
  id: string;
  userId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
  details?: unknown;
  ip?: string | null;
  createdAt: string;
  user?: { id: string; email: string; name?: string | null } | null;
};

export type Plan = {
  id: string;
  name: string;
  price: string;
  credits: string;
  features: string[];
  highlight?: boolean;
  priceCents?: number;
  creditsAmount?: number;
};

export type Subscription = {
  id: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
};

export type Invoice = {
  id: string;
  number: string;
  status: string;
  amountCents: number;
  hostedUrl?: string;
};

export type Payment = {
  id: string;
  type: string;
  provider?: string;
  status: string;
  amountCents: number;
  currency?: string;
  credits?: number;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export type CreditPackage = {
  id: string;
  name: string;
  credits: string | number;
  priceCents: number;
};

export type Session = {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current?: boolean;
};

// ---------------------------------------------------------------- phone / KYC

export type PhonePurpose = "login" | "register" | "bind" | "unbind";
export type SmsChannel = "aliyun" | "tencent";

export type SmsCodeResponse = {
  success: boolean;
  maskedPhone: string;
  channel: SmsChannel;
  expiresIn: number;
  retryAfter: number;
  debugCode?: string;
};

export type PhoneBindingStatus = {
  bound: boolean;
  phone: string | null;
  maskedPhone: string | null;
  verifiedAt: string | null;
};

export type RiskDecision = "allow" | "challenge" | "deny";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskSignal = {
  type: string;
  severity: number;
  detail: string;
};

export type RiskAssessment = {
  decision: RiskDecision;
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  reasons: string[];
  retryAfter?: number;
};

export type RiskChallengeType = "sms";

export type RiskChallengeRequired = {
  riskChallengeRequired: true;
  challengeToken: string;
  challengeType: RiskChallengeType;
  maskedPhone: string | null;
  expiresIn: number;
  risk: RiskAssessment;
  user?: ApiUser;
  debugCode?: string;
};

export type LoginAuditEntry = {
  id: string;
  userId: string | null;
  method: "password" | "phone" | "oauth" | "mfa";
  result: "succeeded" | "failed" | "challenged" | "blocked";
  reason: string | null;
  ipMasked: string | null;
  userAgent: string | null;
  deviceId: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  createdAt: string;
};

export type RiskEvent = {
  id: string;
  userId: string | null;
  action: string;
  decision: RiskDecision;
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  ipMasked: string | null;
  deviceId: string | null;
  createdAt: string;
};

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export type KycRecord = {
  id: string;
  userId: string;
  status: KycStatus;
  documentType: "id_card";
  maskedRealName: string;
  maskedIdNumber: string;
  provider: "stub" | "aliyun" | "tencent";
  providerRequestId: string | null;
  gender: "male" | "female" | "unknown";
  age: number | null;
  isAdult: boolean;
  regionCode: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
};

export type KycStatusResponse = {
  status: KycStatus;
  record: KycRecord | null;
};

type AuthPayload = {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  user?: ApiUser;
  risk?: RiskAssessment;
  riskChallengeRequired?: boolean;
  challengeToken?: string;
  challengeType?: RiskChallengeType;
  maskedPhone?: string | null;
  expiresIn?: number;
  isNewUser?: boolean;
  debugCode?: string;
};

function persistAuth(payload: AuthPayload | null | undefined) {
  const token = payload?.accessToken || payload?.token;
  if (token) setToken(token);
  if (payload?.refreshToken) setRefreshToken(payload.refreshToken);
}

export const api = {
  // Auth
  login: async (email: string, password: string, mfaCode?: string) => {
    const res = await request<{
      accessToken?: string;
      refreshToken?: string;
      token?: string;
      user: ApiUser;
      mfaRequired?: boolean;
      mfaToken?: string;
      risk?: RiskAssessment;
      riskChallengeRequired?: boolean;
      challengeToken?: string;
      challengeType?: RiskChallengeType;
      maskedPhone?: string | null;
      expiresIn?: number;
      debugCode?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, mfaCode }),
    });
    const token = res.data?.accessToken || res.data?.token;
    if (token) setToken(token);
    if (res.data?.refreshToken) setRefreshToken(res.data.refreshToken);
    return res;
  },
  register: async (email: string, password: string, name?: string) => {
    const res = await request<{
      accessToken?: string;
      refreshToken?: string;
      token?: string;
      user: ApiUser;
      verificationToken?: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    const token = res.data?.accessToken || res.data?.token;
    if (token) setToken(token);
    if (res.data?.refreshToken) setRefreshToken(res.data.refreshToken);
    return res;
  },
  logout: async (refreshToken?: string | null) => {
    const rt = refreshToken ?? getRefreshToken();
    const res = await request<null>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: rt }),
    });
    clearSession();
    return res;
  },
  refresh: async (refreshToken?: string | null) => {
    const rt = refreshToken ?? getRefreshToken();
    const res = await request<{ accessToken?: string; refreshToken?: string }>(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken: rt }) }
    );
    if (res.data?.accessToken) setToken(res.data.accessToken);
    if (res.data?.refreshToken) setRefreshToken(res.data.refreshToken);
    return res;
  },
  verifyEmail: (token: string) =>
    request<{ success: boolean; userId: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  requestPasswordReset: (email: string) =>
    request<{ success: boolean; resetToken?: string }>("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ success: boolean }>("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  mfaSetup: () => request<{ secret: string; otpauthUrl: string }>("/auth/mfa/setup", { method: "POST" }),
  mfaEnable: (code: string) =>
    request<{ success: boolean; mfaEnabled: boolean }>("/auth/mfa/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  mfaDisable: (code: string) =>
    request<{ success: boolean; mfaEnabled: boolean }>("/auth/mfa/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  mfaStatus: () => request<{ mfaEnabled: boolean }>("/auth/mfa/status"),
  mfaVerify: (mfaToken: string, code: string) =>
    request<{ accessToken?: string; refreshToken?: string; user: ApiUser }>("/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ mfaToken, code }),
    }).then((res) => {
      if (res.data?.accessToken) setToken(res.data.accessToken);
      if (res.data?.refreshToken) setRefreshToken(res.data.refreshToken);
      return res;
    }),

  // User / credits
  me: () => request<ApiUser & { creditAccount?: CreditAccount }>("/users/me"),
  updateMe: (data: { name?: string; avatarUrl?: string | null; bio?: string | null; locale?: string }) =>
    request<ApiUser>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  creditsBalance: () => request<CreditAccount>("/credits/balance"),
  getAutoRefillSettings: () => request<AutoRefillSettings>("/credits/auto-refill"),
  updateAutoRefillSettings: (data: Partial<AutoRefillSettings>) =>
    request<AutoRefillSettings>("/credits/auto-refill", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  runAutoRefill: () => request<unknown>("/credits/auto-refill", { method: "POST" }),

  // Billing
  getSubscription: () => request<Subscription>("/billing/subscription"),
  listInvoices: () => request<Invoice[]>("/billing/invoices"),
  listPayments: () => request<Payment[]>("/billing/payments"),
  listCreditPackages: () => request<CreditPackage[]>("/billing/credit-packages"),
  createCheckout: (payload: Record<string, unknown>) =>
    request<{
      checkoutUrl?: string | null;
      message?: string;
      provider?: string;
      paymentId?: string;
      status?: string;
      qrCode?: string | null;
      payUrl?: string | null;
      prepayId?: string | null;
      sessionId?: string | null;
      duplicate?: boolean;
    }>("/payments/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getPayment: (id: string) =>
    request<Payment & { qrCode?: string | null; payUrl?: string | null; prepayId?: string | null }>(
      `/payments/${id}`
    ),
  cancelSubscription: () =>
    request<Subscription>("/billing/subscription/cancel", { method: "POST" }),

  // Sessions
  listSessions: () => request<Session[]>("/auth/sessions"),
  revokeSession: (id: string) =>
    request<{ success: boolean }>(`/auth/sessions/${id}`, { method: "DELETE" }),

  // Phone auth
  sendPhoneCode: (phone: string, purpose: PhonePurpose, channel?: SmsChannel) =>
    request<SmsCodeResponse>("/auth/phone/sms/send", {
      method: "POST",
      body: JSON.stringify({ phone, purpose, channel }),
    }),
  phoneLogin: async (phone: string, code: string) => {
    const res = await request<AuthPayload>("/auth/phone/login", {
      method: "POST",
      body: JSON.stringify({ phone, code, deviceId: getDeviceId() }),
    });
    persistAuth(res.data);
    return res;
  },
  phoneRegister: async (phone: string, code: string, name?: string) => {
    const res = await request<AuthPayload>("/auth/phone/register", {
      method: "POST",
      body: JSON.stringify({ phone, code, name, deviceId: getDeviceId() }),
    });
    persistAuth(res.data);
    return res;
  },
  phoneStatus: () => request<PhoneBindingStatus>("/auth/phone/status"),
  bindPhone: (phone: string, code: string) =>
    request<PhoneBindingStatus>("/auth/phone/bind", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    }),
  sendUnbindCode: () =>
    request<SmsCodeResponse>("/auth/phone/sms/unbind", { method: "POST" }),
  unbindPhone: (code: string) =>
    request<{ success: boolean }>("/auth/phone/unbind", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  // Login risk control
  verifyRiskChallenge: async (challengeToken: string, code: string) => {
    const res = await request<AuthPayload>("/auth/risk/challenge/verify", {
      method: "POST",
      body: JSON.stringify({ challengeToken, code, deviceId: getDeviceId() }),
    });
    persistAuth(res.data);
    return res;
  },
  resendRiskChallenge: (challengeToken: string) =>
    request<{ maskedPhone: string; expiresIn: number; debugCode?: string }>(
      "/auth/risk/challenge/resend",
      { method: "POST", body: JSON.stringify({ challengeToken }) }
    ),
  riskEvents: () => request<RiskEvent[]>("/auth/risk/events"),
  loginAudit: () => request<LoginAuditEntry[]>("/auth/risk/login-audit"),

  // Real-name verification (KYC)
  kycStatus: () => request<KycStatusResponse>("/kyc/status"),
  submitKyc: (data: {
    realName: string;
    idNumber: string;
    documentType?: "id_card";
    idCardFrontUrl?: string | null;
    idCardBackUrl?: string | null;
  }) => request<KycRecord>("/kyc/submit", { method: "POST", body: JSON.stringify(data) }),

  // OAuth
  oauthStart: (provider: string) =>
    request<{ provider: string; url?: string; message?: string }>(`/auth/oauth/${provider}`),
  oauthCallback: (provider: string, data: { code?: string; email?: string; name?: string }) =>
    request<{ accessToken?: string; refreshToken?: string; user: ApiUser }>(
      `/auth/oauth/${provider}/callback`,
      { method: "POST", body: JSON.stringify(data) }
    ).then((res) => {
      if (res.data?.accessToken) setToken(res.data.accessToken);
      if (res.data?.refreshToken) setRefreshToken(res.data.refreshToken);
      return res;
    }),

  // Models
  listModels: (all = false) =>
    request<ApiModel[]>(`/models${all ? "?all=true" : ""}`),

  // Media tools (edit / watermark removal / voiceover)
  listTools: () => request<{ slug: string; credits: number }[]>("/tools"),
  getModel: (id: string) => request<ApiModel>(`/models/${id}`),

  // Tasks
  createTask: (payload: {
    modelId?: string;
    model?: string;
    /** Media tool pipeline: video-edit | watermark-removal | voiceover. */
    tool?: string;
    input: Record<string, unknown>;
    priority?: string;
  }) =>
    request<ApiTask>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listTasks: () => request<ApiTask[]>("/tasks"),
  getTask: (id: string) => request<ApiTask>(`/tasks/${id}`),
  cancelTask: (id: string) =>
    request<ApiTask>(`/tasks/${id}/cancel`, { method: "PATCH" }),

  // Admin (protected)
  adminListUsers: (query?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.status) params.set("status", query.status);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<{ items: AdminUser[]; total: number; page: number; limit: number }>(
      `/admin/users${qs ? `?${qs}` : ""}`
    );
  },
  adminGetUser: (id: string) => request<AdminUser & { tasks?: ApiTask[] }>(`/admin/users/${id}`),
  adminBanUser: (id: string, reason?: string) =>
    request<AdminUser>(`/admin/users/${id}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminUnbanUser: (id: string) =>
    request<AdminUser>(`/admin/users/${id}/unban`, { method: "POST" }),
  adminAdjustCredits: (id: string, amount: number, reason?: string, idempotencyKey?: string) =>
    request<{ userId: string; amount: number; balance: number | string; transaction?: unknown }>(
      `/admin/users/${id}/credits`,
      {
        method: "POST",
        body: JSON.stringify({ amount, reason, idempotencyKey }),
      }
    ),
  adminListTasks: (query?: { status?: string; userId?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.userId) params.set("userId", query.userId);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<{ items: AdminTask[]; total: number; page: number; limit: number }>(
      `/admin/tasks${qs ? `?${qs}` : ""}`
    );
  },
  adminRetryTask: (id: string) =>
    request<ApiTask>(`/admin/tasks/${id}/retry`, { method: "POST" }),
  adminCancelTask: (id: string) =>
    request<ApiTask>(`/admin/tasks/${id}/cancel`, { method: "POST" }),
  adminListModels: (all = true) =>
    request<ApiModel[]>(`/admin/models${all ? "?all=true" : ""}`),
  adminGetModel: (id: string) => request<ApiModel>(`/admin/models/${id}`),
  adminCreateModel: (data: {
    slug: string;
    name: string;
    provider: string;
    type?: string;
    creditsCost: number;
    active?: boolean;
    metadata?: Record<string, unknown>;
    watermark?: boolean;
  }) =>
    request<ApiModel>("/admin/models", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateModel: (
    id: string,
    data: Partial<{
      name: string;
      provider: string;
      type: string;
      creditsCost: number;
      active: boolean;
      metadata: Record<string, unknown>;
      watermark: boolean;
    }>
  ) =>
    request<ApiModel>(`/admin/models/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminDeleteModel: (id: string) =>
    request<unknown>(`/admin/models/${id}`, { method: "DELETE" }),
  adminListRefunds: (query?: { status?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<{ items: AdminRefund[]; total: number; page: number; limit: number }>(
      `/admin/refunds${qs ? `?${qs}` : ""}`
    );
  },
  adminListPayments: (query?: { userId?: string; status?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.userId) params.set("userId", query.userId);
    if (query?.status) params.set("status", query.status);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<{ items: AdminPayment[]; total: number; page: number; limit: number }>(
      `/admin/payments${qs ? `?${qs}` : ""}`
    );
  },
  adminProcessRefund: (data: { paymentId: string; amountCents?: number; reason?: string }) =>
    request<AdminRefund>("/admin/refunds", { method: "POST", body: JSON.stringify(data) }),
  adminApproveRefund: (id: string) =>
    request<AdminRefund>(`/admin/refunds/${id}/approve`, { method: "POST" }),
  adminRejectRefund: (id: string, reason?: string) =>
    request<AdminRefund>(`/admin/refunds/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  adminListAuditLogs: (query?: {
    userId?: string;
    action?: string;
    targetId?: string;
    targetType?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (query?.userId) params.set("userId", query.userId);
    if (query?.action) params.set("action", query.action);
    if (query?.targetId) params.set("targetId", query.targetId);
    if (query?.targetType) params.set("targetType", query.targetType);
    if (query?.page) params.set("page", String(query.page));
    if (query?.limit) params.set("limit", String(query.limit));
    const qs = params.toString();
    return request<{ items: AdminAuditLog[]; total: number; page: number; limit: number }>(
      `/admin/audit-logs${qs ? `?${qs}` : ""}`
    );
  },

  // Plans (may not exist)
  listPlans: async (): Promise<ApiResponse<Plan[]>> => {
    const candidates = ["/plans", "/pricing/plans", "/billing/plans", "/subscriptions/plans"];
    for (const path of candidates) {
      const res = await request<Plan[]>(path);
      if (!res.error && res.data) return res;
    }
    return { data: null, error: "No plans endpoint" };
  },

  // Upload
  // Multipart is the primary path (the API exposes POST /uploads). Presigned
  // uploads are attempted afterwards for deployments backed by object storage.
  uploadFile: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    try {
      const headers: Record<string, string> = {};
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/uploads`, {
        method: "POST",
        body: form,
        credentials: "include",
        headers,
      });
      if (res.ok) {
        return { data: await res.json(), error: null };
      }
    } catch {
      // fall through to presigned upload
    }

    const presignCandidates = ["/uploads/presigned", "/uploads/presign", "/storage/presign", "/storage/presigned"];
    const body = JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });
    for (const path of presignCandidates) {
      const res = await request<Record<string, unknown>>(path, {
        method: "POST",
        body,
      });
      if (!res.error && res.data) {
        const d = res.data as Record<string, unknown>;
        const uploadUrl =
          (d.uploadUrl as string) ||
          (d.putUrl as string) ||
          (d.presignedUrl as string) ||
          (d.url as string);
        const publicUrl =
          (d.publicUrl as string) ||
          (d.fileUrl as string) ||
          (d.downloadUrl as string) ||
          (d.key as string) ||
          (d.url as string);
        if (uploadUrl && uploadUrl !== publicUrl) {
          try {
            const putRes = await fetch(uploadUrl, {
              method: (d.method as string) || "PUT",
              body: file,
              headers: (d.headers as Record<string, string>) || {
                "Content-Type": file.type,
              },
            });
            if (putRes.ok) {
              return { data: { url: publicUrl || uploadUrl }, error: null };
            }
          } catch {
            // fall through
          }
        }
        if (publicUrl) {
          return { data: { url: publicUrl }, error: null };
        }
      }
    }

    return { data: null, error: "Upload failed" };
  },
  validateCoupon: (code: string) =>
    request<{ valid: boolean; code: string; reason?: string; discountCents?: number; credits?: number }>("/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  redeemCoupon: (code: string, paymentId?: string) =>
    request<{ redemption?: unknown; credits?: number; discountCents?: number }>("/coupons/redeem", {
      method: "POST",
      body: JSON.stringify({ code, paymentId }),
    }),
  createInviteCode: (dto: { maxUses?: number | null; rewardCredits?: number; expiresAt?: string | null }) =>
    request<{ id: string; code: string }>("/invites", {
      method: "POST",
      body: JSON.stringify(dto),
    }),
  redeemInviteCode: (code: string) =>
    request<{ id: string; status: string }>("/invites/redeem", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  listReferrals: () => request<unknown[]>("/referrals"),
};

export default api;
