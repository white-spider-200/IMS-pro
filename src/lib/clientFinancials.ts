export function invoiceMatchesClient(client: any, invoice: any) {
  if (!client || !invoice) return false;
  if (client.id && invoice.client_id === client.id) return true;

  const clientName = String(client.name || '').trim().toLowerCase();
  const invoiceName = String(invoice.customer_name || '').trim().toLowerCase();
  return Boolean(clientName) && clientName === invoiceName;
}

export function paymentMatchesClient(client: any, payment: any) {
  if (!client || !payment) return false;
  if (client.id && payment.client_id === client.id) return true;

  const clientName = String(client.name || '').trim().toLowerCase();
  const paymentName = String(payment.client_name || payment.customer_name || '').trim().toLowerCase();
  return Boolean(clientName) && clientName === paymentName;
}

export function getInvoiceTotal(invoice: any) {
  return Number(invoice?.total_amount ?? invoice?.total_cost ?? 0);
}

export function getClientSaleInvoices(client: any, revenueInvoices: any[]) {
  return (revenueInvoices || []).filter((invoice) => invoiceMatchesClient(client, invoice));
}

export function getClientPurchaseInvoices(client: any, purchaseInvoices: any[]) {
  return (purchaseInvoices || []).filter((invoice) => {
    if (String(invoice?.source_type || '') !== 'customer') return false;
    return invoiceMatchesClient(client, invoice);
  });
}

export function getClientPayments(
  client: any,
  payments: any[],
  options: { direction?: 'incoming' | 'outgoing'; scope?: 'sale' | 'purchase' } = {}
) {
  return (payments || []).filter((payment) => {
    if (!paymentMatchesClient(client, payment)) return false;
    if (options.direction && payment.direction !== options.direction) return false;
    if (options.scope && payment.scope !== options.scope) return false;
    return true;
  });
}

export function getInvoicePayments(invoice: any, payments: any[]) {
  return (payments || []).filter((payment) => payment?.invoice_id && payment.invoice_id === invoice?.id);
}

export function getInvoicePaidAmount(invoice: any, payments: any[]) {
  return getInvoicePayments(invoice, payments).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

export function getInvoiceRemainingAmount(invoice: any, payments: any[]) {
  return Math.max(getInvoiceTotal(invoice) - getInvoicePaidAmount(invoice, payments), 0);
}

export function getInvoicePaymentStatus(invoice: any, payments: any[]) {
  if (invoice?.status === 'cancelled') return 'cancelled';

  const total = getInvoiceTotal(invoice);
  const paid = getInvoicePaidAmount(invoice, payments);

  if (paid <= 0) return 'pending';
  if (paid >= total) return 'paid';
  return 'partial';
}

export function calculateClientFinancials(
  client: any,
  revenueInvoices: any[],
  purchaseInvoices: any[] = [],
  clientPayments: any[] = []
) {
  const matchedSales = getClientSaleInvoices(client, revenueInvoices).filter((invoice) => invoice?.status !== 'cancelled');
  const matchedPurchases = getClientPurchaseInvoices(client, purchaseInvoices).filter((invoice) => invoice?.status !== 'cancelled');

  const incomingPayments = getClientPayments(client, clientPayments, { direction: 'incoming' });
  const outgoingPayments = getClientPayments(client, clientPayments, { direction: 'outgoing' });

  const totalBilled = matchedSales.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  const paidAmount = incomingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingAmount = Math.max(totalBilled - paidAmount, 0);

  const totalPurchased = matchedPurchases.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
  const purchasePaidAmount = outgoingPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const purchasePendingAmount = Math.max(totalPurchased - purchasePaidAmount, 0);

  const balanceDue = pendingAmount;
  const creditBalance = purchasePendingAmount;
  const signedBalance = balanceDue - creditBalance;

  return {
    total_billed: totalBilled,
    paid_amount: paidAmount,
    pending_amount: pendingAmount,
    balance_due: balanceDue,
    credit_balance: creditBalance,
    total_purchased: totalPurchased,
    outgoing_paid_amount: purchasePaidAmount,
    outgoing_pending_amount: purchasePendingAmount,
    customer_owes_us: balanceDue,
    we_owe_customer: creditBalance,
    balance: signedBalance,
  };
}

export function mergeClientsWithFinancials(
  clients: any[],
  revenueInvoices: any[],
  purchaseInvoices: any[] = [],
  clientPayments: any[] = []
) {
  return (clients || []).map((client) => ({
    ...client,
    ...calculateClientFinancials(client, revenueInvoices || [], purchaseInvoices || [], clientPayments || []),
  }));
}
