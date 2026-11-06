/** "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" -> "merchandise or service not as described" */
export function humanize(code: string) {
  return code.replaceAll("_", " ").toLowerCase();
}

export function offerText(offerType: string, amount: string) {
  return `${humanize(offerType)} $${amount}`;
}
