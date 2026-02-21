export const UA_PHONE_PREFIX = "+380";
const UA_PHONE_COUNTRY_CODE = "380";
const UA_PHONE_TOTAL_DIGITS = 12;
const UA_PHONE_SUFFIX_LENGTH = 9;

function extractUaPhoneSuffix(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.startsWith(UA_PHONE_COUNTRY_CODE)) {
    return digits.slice(UA_PHONE_COUNTRY_CODE.length, UA_PHONE_COUNTRY_CODE.length + UA_PHONE_SUFFIX_LENGTH);
  }
  if (digits.startsWith("0")) {
    return digits.slice(1, 1 + UA_PHONE_SUFFIX_LENGTH);
  }
  return digits.slice(0, UA_PHONE_SUFFIX_LENGTH);
}

export function formatUaPhoneInput(value) {
  return `${UA_PHONE_PREFIX}${extractUaPhoneSuffix(value)}`;
}

export function isCompleteUaPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === UA_PHONE_TOTAL_DIGITS && digits.startsWith(UA_PHONE_COUNTRY_CODE);
}
