const axios = require("axios");

const SMS_PROVIDER_NAME = String(process.env.SMS_PROVIDER_NAME || "enterprise_sms").trim();
const SMS_API_URL = String(
  process.env.ENTERPRISE_SMS_API_URL || process.env.SMS_API_URL || "",
).trim();
const SMS_API_KEY = String(process.env.ENTERPRISE_SMS_API_KEY || process.env.SMS_API_KEY || "").trim();
const SMS_API_SECRET = String(
  process.env.ENTERPRISE_SMS_API_SECRET || process.env.SMS_API_SECRET || "",
).trim();
const SMS_API_ACCOUNT = String(
  process.env.ENTERPRISE_SMS_API_ACCOUNT || process.env.SMS_API_ACCOUNT || "",
).trim();
const SMS_TEMPLATE_ID = String(
  process.env.ENTERPRISE_SMS_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || "",
).trim();
const SMS_SIGNATURE = String(
  process.env.ENTERPRISE_SMS_SIGNATURE || process.env.SMS_SIGNATURE || "",
).trim();
const SMS_TIMEOUT_MS = Math.max(Number(process.env.SMS_API_TIMEOUT_MS || 8000), 1000);
const SMS_AUTH_SCHEME = String(process.env.SMS_API_AUTH_SCHEME || "Bearer").trim();
const SMS_SUCCESS_FIELD = String(process.env.SMS_API_SUCCESS_FIELD || "").trim();
const SMS_SUCCESS_VALUE = String(process.env.SMS_API_SUCCESS_VALUE || "").trim();
const SMS_REQUEST_ID_FIELD = String(process.env.SMS_API_REQUEST_ID_FIELD || "request_id").trim();
const SMS_STATUS_FIELD = String(process.env.SMS_API_STATUS_FIELD || "status").trim();
const SMS_MESSAGE_FIELD = String(process.env.SMS_API_MESSAGE_FIELD || "message").trim();
const SMS_DEBUG_EXPOSE_CODE =
  String(process.env.SMS_DEBUG_EXPOSE_CODE || "").trim() === "true" ||
  process.env.NODE_ENV !== "production";

function getNestedValue(source, path) {
  if (!source || !path) {
    return undefined;
  }

  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((accumulator, key) => (accumulator == null ? undefined : accumulator[key]), source);
}

function applyTemplate(template, variables) {
  return String(template || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

function buildMessage({ code, ttlMinutes, purpose }) {
  const template =
    process.env.SMS_API_MESSAGE_TEMPLATE ||
    "【{{signature}}】验证码 {{code}}，{{ttl_minutes}} 分钟内有效，用于{{purpose_label}}。";

  const purposeMap = {
    password_reset: "找回密码",
    password_change: "修改密码",
  };

  return applyTemplate(template, {
    code,
    ttl_minutes: ttlMinutes,
    purpose,
    purpose_label: purposeMap[purpose] || "身份校验",
    signature: SMS_SIGNATURE || "企业通信",
  });
}

function buildHeaders(requestId) {
  const headers = {
    "Content-Type": "application/json",
    "X-Request-Id": requestId,
  };

  if (SMS_API_KEY) {
    headers.Authorization = `${SMS_AUTH_SCHEME} ${SMS_API_KEY}`;
  }

  if (SMS_API_SECRET) {
    headers["X-Api-Secret"] = SMS_API_SECRET;
  }

  return headers;
}

function buildPayload({ phone, code, ttlMinutes, purpose, requestId }) {
  const message = buildMessage({ code, ttlMinutes, purpose });

  return {
    account: SMS_API_ACCOUNT,
    phone,
    code,
    ttl_minutes: ttlMinutes,
    purpose,
    request_id: requestId,
    template_id: SMS_TEMPLATE_ID,
    signature: SMS_SIGNATURE,
    message,
  };
}

function evaluateSuccess(data) {
  if (!SMS_SUCCESS_FIELD) {
    return true;
  }

  const actual = getNestedValue(data, SMS_SUCCESS_FIELD);
  return String(actual) === SMS_SUCCESS_VALUE;
}

async function sendVerificationCode({ phone, code, ttlMinutes, purpose, requestId }) {
  const payload = buildPayload({ phone, code, ttlMinutes, purpose, requestId });

  if (!SMS_API_URL) {
    return {
      success: false,
      mocked: true,
      provider: SMS_PROVIDER_NAME,
      request_id: requestId,
      status: "mocked",
      message: "未配置企业短信 HTTPS 接口，已生成验证码并写入数据库。",
      payload,
      response: null,
      debug_code: SMS_DEBUG_EXPOSE_CODE ? code : undefined,
    };
  }

  try {
    const response = await axios.post(SMS_API_URL, payload, {
      headers: buildHeaders(requestId),
      timeout: SMS_TIMEOUT_MS,
      validateStatus: () => true,
    });

    const data = response.data;
    const success = response.status >= 200 && response.status < 300 && evaluateSuccess(data);

    return {
      success,
      mocked: false,
      provider: SMS_PROVIDER_NAME,
      request_id:
        getNestedValue(data, SMS_REQUEST_ID_FIELD) ||
        data?.request_id ||
        data?.requestId ||
        requestId,
      status: getNestedValue(data, SMS_STATUS_FIELD) || (success ? "accepted" : "rejected"),
      message:
        getNestedValue(data, SMS_MESSAGE_FIELD) ||
        data?.msg ||
        (success ? "短信发送请求已提交。" : "短信发送请求失败。"),
      payload,
      response: {
        http_status: response.status,
        data,
      },
      debug_code: SMS_DEBUG_EXPOSE_CODE ? code : undefined,
    };
  } catch (error) {
    return {
      success: false,
      mocked: false,
      provider: SMS_PROVIDER_NAME,
      request_id: requestId,
      status: "error",
      message: error?.message || "企业短信接口请求失败。",
      payload,
      response: null,
      debug_code: SMS_DEBUG_EXPOSE_CODE ? code : undefined,
    };
  }
}

module.exports = {
  SMS_PROVIDER_NAME,
  SMS_DEBUG_EXPOSE_CODE,
  sendVerificationCode,
};
