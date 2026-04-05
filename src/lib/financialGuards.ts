export const MAX_REPORT_QUANTITY = 1_000_000;
export const MAX_REPORT_MONEY = 1_000_000_000;

export function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isFiniteInRange(value: unknown, maxValue: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= maxValue;
}

export function sanitizeMoney(value: unknown) {
  return isFiniteInRange(value, MAX_REPORT_MONEY) ? Number(value) : 0;
}

export function sanitizeQuantity(value: unknown) {
  return isFiniteInRange(value, MAX_REPORT_QUANTITY) ? Number(value) : 0;
}

export function hasValidInvoiceTotals(invoice: any) {
  if (!invoice) return false;

  let parsedItems = invoice.items;
  if (typeof parsedItems === 'string') {
    try { parsedItems = JSON.parse(parsedItems); } catch { parsedItems = []; }
  }

  const quantity = Array.isArray(parsedItems)
    ? parsedItems.reduce((sum: number, item: any) => sum + toFiniteNumber(item?.quantity), 0)
    : toFiniteNumber(invoice.quantity_purchased ?? invoice.requested_quantity ?? invoice.quantity);

  const total = invoice.total_amount ?? invoice.total_cost ?? invoice.subtotal ?? 0;
  const cogs = invoice.cogs_amount ?? 0;
  const grossProfit = invoice.gross_profit ?? 0;

  return isFiniteInRange(quantity, MAX_REPORT_QUANTITY)
    && isFiniteInRange(total, MAX_REPORT_MONEY)
    && isFiniteInRange(cogs, MAX_REPORT_MONEY)
    && isFiniteInRange(grossProfit, MAX_REPORT_MONEY);
}

export function hasValidTransferTotals(transfer: any, linkedInvoice?: any) {
  if (!transfer && !linkedInvoice) return false;

  let parsedLinkedItems = linkedInvoice?.items;
  if (typeof parsedLinkedItems === 'string') {
    try { parsedLinkedItems = JSON.parse(parsedLinkedItems); } catch { parsedLinkedItems = []; }
  }

  const quantity = transfer?.quantity
    ?? linkedInvoice?.quantity_purchased
    ?? linkedInvoice?.requested_quantity
    ?? (Array.isArray(parsedLinkedItems)
      ? parsedLinkedItems.reduce((sum: number, item: any) => sum + toFiniteNumber(item?.quantity), 0)
      : 0);
  const total = transfer?.total_amount ?? linkedInvoice?.total_amount ?? linkedInvoice?.total_cost ?? 0;

  return isFiniteInRange(quantity, MAX_REPORT_QUANTITY)
    && isFiniteInRange(total, MAX_REPORT_MONEY);
}
