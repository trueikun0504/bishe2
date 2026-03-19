function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D+/g, "").trim();
}

function isValidCnMainlandPhone(value) {
  return /^1[3-9]\d{9}$/.test(normalizePhoneNumber(value));
}

function maskPhoneNumber(value) {
  const phone = normalizePhoneNumber(value);
  if (!phone) {
    return "";
  }
  if (phone.length < 7) {
    return phone;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

module.exports = {
  normalizePhoneNumber,
  isValidCnMainlandPhone,
  maskPhoneNumber,
};
