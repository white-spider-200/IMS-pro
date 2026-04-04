import React, { useMemo, useState } from 'react';
import { ArrowLeft, DollarSign, FileSpreadsheet, FileText, Printer, Receipt, Wallet } from 'lucide-react';
import { collection, doc, runTransaction } from 'firebase/firestore';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { db } from '../firebase';
import { addDemoClientPayment } from '../demo/demoDatabase';
import {
  calculateClientFinancials,
  getClientPayments,
  getClientPurchaseInvoices,
  getClientSaleInvoices,
  getInvoicePaidAmount,
  getInvoicePaymentStatus,
  getInvoiceRemainingAmount,
  getInvoiceTotal,
} from '../lib/clientFinancials';
import { exportRowsToExcel, exportTextLinesToPdf } from '../lib/fileExports';
import { sanitizeMoney } from '../lib/financialGuards';

type OutletContext = {
  isDemoMode?: boolean;
  clients?: any[];
  revenueInvoices?: any[];
  purchaseInvoices?: any[];
  clientPayments?: any[];
  warehouses?: any[];
};

type InvoiceScope = 'sale' | 'purchase';

type PaymentDraft = {
  key: string;
  invoiceId: string;
  scope: InvoiceScope;
  amount: string;
  notes: string;
};

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  warehouseId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  raw: any;
};

function PaymentStatusBadge({ status }: { status: string }) {
  const classes =
    status === 'paid'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'partial'
        ? 'bg-amber-50 text-amber-700'
        : status === 'cancelled'
          ? 'bg-gray-100 text-gray-600'
          : 'bg-rose-50 text-rose-700';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {status || 'pending'}
    </span>
  );
}

function buildPaymentInvoiceLines(payment: any, client: any) {
  return [
    `Payment Invoice ${payment.receipt_number || payment.id || ''}`,
    `Customer: ${client?.name || payment.client_name || 'N/A'}`,
    `Email: ${client?.email || 'N/A'}`,
    `Phone: ${client?.phone || 'N/A'}`,
    `Direction: ${payment.direction === 'incoming' ? 'Customer paid us' : 'We paid customer'}`,
    `Scope: ${payment.scope === 'sale' ? 'Sell' : 'Buy'}`,
    `Source invoice: ${payment.invoice_number || 'N/A'}`,
    `Amount: ${sanitizeMoney(payment.amount || 0).toLocaleString()}`,
    `Date: ${payment.created_at ? new Date(payment.created_at).toLocaleString() : 'N/A'}`,
    `Notes: ${payment.notes || 'N/A'}`,
  ];
}

function buildPrintablePaymentInvoiceHtml(payment: any, client: any) {
  const lines = buildPaymentInvoiceLines(payment, client);
  const lineItems = lines
    .map((line) => {
      const [label, ...rest] = line.split(': ');
      const value = rest.join(': ') || '';
      return `<tr><td>${label}</td><td>${value}</td></tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${payment.receipt_number || 'Payment Invoice'}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 24px; color: #6b7280; }
      table { width: 100%; border-collapse: collapse; }
      td { border: 1px solid #e5e7eb; padding: 12px; vertical-align: top; }
      td:first-child { width: 220px; font-weight: 700; background: #f9fafb; }
    </style>
  </head>
  <body>
    <h1>${payment.receipt_number || 'Payment Invoice'}</h1>
    <p>Printable payment receipt for customer delivery.</p>
    <table>${lineItems}</table>
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`;
}

export default function ClientPaymentsPage() {
  const navigate = useNavigate();
  const { clientId } = useParams();
  const {
    isDemoMode,
    clients = [],
    revenueInvoices = [],
    purchaseInvoices = [],
    clientPayments = [],
    warehouses = [],
  } = useOutletContext<OutletContext>();

  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const client = useMemo(
    () => clients.find((entry) => entry.id === clientId) || null,
    [clientId, clients]
  );

  const getWarehouseName = (warehouseId: string) =>
    warehouses.find((warehouse) => warehouse.id === warehouseId)?.name || 'Unknown Warehouse';

  const salePayments = useMemo(
    () => (client ? getClientPayments(client, clientPayments, { direction: 'incoming', scope: 'sale' }) : []),
    [client, clientPayments]
  );

  const purchasePayments = useMemo(
    () => (client ? getClientPayments(client, clientPayments, { direction: 'outgoing', scope: 'purchase' }) : []),
    [client, clientPayments]
  );

  const saleInvoices = useMemo<InvoiceRow[]>(() => {
    if (!client) return [];

    return getClientSaleInvoices(client, revenueInvoices)
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || 'N/A',
        createdAt: invoice.created_at || '',
        warehouseId: invoice.warehouse_id,
        totalAmount: getInvoiceTotal(invoice),
        paidAmount: getInvoicePaidAmount(invoice, salePayments),
        remainingAmount: getInvoiceRemainingAmount(invoice, salePayments),
        paymentStatus: getInvoicePaymentStatus(invoice, salePayments),
        raw: invoice,
      }))
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  }, [client, revenueInvoices, salePayments]);

  const customerPurchaseInvoices = useMemo<InvoiceRow[]>(() => {
    if (!client) return [];

    return getClientPurchaseInvoices(client, purchaseInvoices)
      .map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || 'N/A',
        createdAt: invoice.created_at || '',
        warehouseId: invoice.receiving_warehouse_id || invoice.warehouse_id,
        totalAmount: getInvoiceTotal(invoice),
        paidAmount: getInvoicePaidAmount(invoice, purchasePayments),
        remainingAmount: getInvoiceRemainingAmount(invoice, purchasePayments),
        paymentStatus: getInvoicePaymentStatus({ ...invoice, status: invoice.payment_status || 'pending' }, purchasePayments),
        raw: invoice,
      }))
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  }, [client, purchaseInvoices, purchasePayments]);

  const ledgerRows = useMemo(() => {
    if (!client) return [];

    return getClientPayments(client, clientPayments)
      .map((payment) => ({
        ...payment,
        amount: sanitizeMoney(payment.amount || 0),
      }))
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
  }, [client, clientPayments]);

  const summary = useMemo(
    () => (client ? calculateClientFinancials(client, revenueInvoices, purchaseInvoices, clientPayments) : null),
    [client, clientPayments, purchaseInvoices, revenueInvoices]
  );

  const openDraft = (row: InvoiceRow, scope: InvoiceScope) => {
    if (row.remainingAmount <= 0) return;

    setPaymentDraft({
      key: `${scope}-${row.id}`,
      invoiceId: row.id,
      scope,
      amount: String(row.remainingAmount),
      notes: '',
    });
  };

  const closeDraft = () => {
    setPaymentDraft(null);
  };

  const handleSavePayment = async (row: InvoiceRow, scope: InvoiceScope) => {
    if (!client || !paymentDraft || paymentDraft.invoiceId !== row.id || paymentDraft.scope !== scope) return;

    const amount = Number(paymentDraft.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }

    if (amount > row.remainingAmount) {
      toast.error('Payment amount cannot exceed the remaining balance.');
      return;
    }

    const createdAt = new Date().toISOString();
    const receiptNumber = `PAY-${Date.now()}`;
    const payment = {
      client_id: client.id,
      client_name: client.name,
      direction: (scope === 'sale' ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing',
      scope,
      invoice_id: row.id,
      invoice_number: row.invoiceNumber,
      receipt_number: receiptNumber,
      amount,
      notes: paymentDraft.notes.trim(),
      created_at: createdAt,
    };

    setIsSavingPayment(true);
    try {
      if (isDemoMode) {
        addDemoClientPayment({
          clientId: client.id,
          clientName: client.name,
          direction: payment.direction,
          scope,
          invoiceId: row.id,
          invoiceNumber: row.invoiceNumber,
          receiptNumber,
          amount,
          notes: payment.notes,
          createdAt,
        });
      } else {
        const paymentRef = doc(collection(db, 'client_payments'));
        const invoiceRef = doc(db, scope === 'sale' ? 'revenue_invoices' : 'purchase_invoices', row.id);
        const clientRef = doc(db, 'clients', client.id);
        const nextPaidAmount = row.paidAmount + amount;
        const nextStatus = nextPaidAmount >= row.totalAmount ? 'paid' : 'partial';

        const nextRevenueInvoices =
          scope === 'sale'
            ? revenueInvoices.map((invoice) =>
                invoice.id === row.id
                  ? {
                      ...invoice,
                      status: nextStatus,
                      paid_amount: nextPaidAmount,
                      paid_at: nextStatus === 'paid' ? createdAt : null,
                    }
                  : invoice
              )
            : revenueInvoices;

        const nextPurchaseInvoices =
          scope === 'purchase'
            ? purchaseInvoices.map((invoice) =>
                invoice.id === row.id
                  ? {
                      ...invoice,
                      payment_status: nextStatus,
                      paid_amount: nextPaidAmount,
                      paid_at: nextStatus === 'paid' ? createdAt : null,
                    }
                  : invoice
              )
            : purchaseInvoices;

        const updatedFinancials = calculateClientFinancials(
          client,
          nextRevenueInvoices,
          nextPurchaseInvoices,
          [...clientPayments, { id: paymentRef.id, ...payment }]
        );

        await runTransaction(db, async (transaction) => {
          transaction.set(paymentRef, payment);

          if (scope === 'sale') {
            transaction.set(
              invoiceRef,
              {
                status: nextStatus,
                paid_amount: nextPaidAmount,
                paid_at: nextStatus === 'paid' ? createdAt : null,
              },
              { merge: true }
            );
          } else {
            transaction.set(
              invoiceRef,
              {
                payment_status: nextStatus,
                paid_amount: nextPaidAmount,
                paid_at: nextStatus === 'paid' ? createdAt : null,
              },
              { merge: true }
            );
          }

          transaction.set(
            clientRef,
            {
              ...updatedFinancials,
              last_modified: createdAt,
            },
            { merge: true }
          );
        });
      }

      toast.success(scope === 'sale' ? 'Customer payment saved.' : 'Outgoing payment saved.');
      closeDraft();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save payment');
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleExportExcel = () => {
    if (!client || ledgerRows.length === 0) {
      toast.info('No payment ledger available to export');
      return;
    }

    exportRowsToExcel(
      `${client.name.replace(/\s+/g, '_')}_payments.xls`,
      `${client.name} Payments`,
      ['Receipt', 'Date', 'Direction', 'Scope', 'Invoice', 'Amount', 'Notes'],
      ledgerRows.map((payment) => [
        payment.receipt_number || payment.id || 'N/A',
        payment.created_at ? new Date(payment.created_at).toLocaleString() : 'N/A',
        payment.direction === 'incoming' ? 'Customer paid us' : 'We paid customer',
        payment.scope === 'sale' ? 'Sell' : 'Buy',
        payment.invoice_number || 'N/A',
        payment.amount,
        payment.notes || '',
      ])
    );
  };

  const handleExportPdf = () => {
    if (!client || !summary || ledgerRows.length === 0) {
      toast.info('No payment ledger available to export');
      return;
    }

    const lines = [
      `${client.name} Payment Ledger`,
      `Email: ${client.email || 'N/A'}`,
      `Phone: ${client.phone || 'N/A'}`,
      `Customer owes us: ${summary.customer_owes_us}`,
      `We owe customer: ${summary.we_owe_customer}`,
      `Incoming payments: ${summary.paid_amount}`,
      `Outgoing payments: ${summary.outgoing_paid_amount}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Receipt | Date | Direction | Scope | Invoice | Amount | Notes',
      ...ledgerRows.map(
        (payment) =>
          `${payment.receipt_number || payment.id || 'N/A'} | ${payment.created_at ? new Date(payment.created_at).toLocaleString() : 'N/A'} | ${payment.direction === 'incoming' ? 'Customer paid us' : 'We paid customer'} | ${payment.scope === 'sale' ? 'Sell' : 'Buy'} | ${payment.invoice_number || 'N/A'} | ${payment.amount} | ${payment.notes || ''}`
      ),
    ];

    exportTextLinesToPdf(`${client.name.replace(/\s+/g, '_')}_payments.pdf`, lines);
  };

  const handleDownloadPaymentPdf = (payment: any) => {
    const filename = `${(payment.receipt_number || payment.id || 'payment').replace(/\s+/g, '_')}.pdf`;
    exportTextLinesToPdf(filename, buildPaymentInvoiceLines(payment, client));
  };

  const handlePrintPaymentInvoice = (payment: any) => {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!popup) {
      toast.error('Unable to open print window. Please allow popups.');
      return;
    }

    popup.document.open();
    popup.document.write(buildPrintablePaymentInvoiceHtml(payment, client));
    popup.document.close();
  };

  if (!client || !summary) {
    return (
      <div className="rounded-[2rem] border border-gray-200 bg-white p-10 shadow-sm">
        <p className="text-sm font-semibold text-gray-500">Client not found.</p>
        <button
          type="button"
          onClick={() => navigate('/clients')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Clients
        </button>
      </div>
    );
  }

  const renderInvoiceTable = (rows: InvoiceRow[], scope: InvoiceScope) => (
    rows.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
        <DollarSign className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-4 text-sm font-semibold text-gray-500">
          {scope === 'sale' ? 'No sell invoices recorded for this customer yet.' : 'No buy invoices recorded for this customer yet.'}
        </p>
      </div>
    ) : (
      <div className="overflow-hidden rounded-3xl border border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const isOpen = paymentDraft?.key === `${scope}-${row.id}`;
                return (
                  <React.Fragment key={`${scope}-${row.id}`}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4 font-semibold text-gray-900">{row.invoiceNumber}</td>
                      <td className="px-4 py-4 text-gray-600">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-4 text-gray-700">{getWarehouseName(row.warehouseId)}</td>
                      <td className="px-4 py-4 text-right font-bold text-gray-900">${sanitizeMoney(row.totalAmount).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-700">${sanitizeMoney(row.paidAmount).toLocaleString()}</td>
                      <td className="px-4 py-4 text-right font-semibold text-rose-700">${sanitizeMoney(row.remainingAmount).toLocaleString()}</td>
                      <td className="px-4 py-4">
                        <PaymentStatusBadge status={row.paymentStatus} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        {row.remainingAmount > 0 && row.paymentStatus !== 'cancelled' ? (
                          <button
                            type="button"
                            onClick={() => openDraft(row, scope)}
                            className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                          >
                            <Wallet className="h-4 w-4" />
                            Add Payment
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">Settled</span>
                        )}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                            <label className="space-y-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Amount</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={paymentDraft.amount}
                                onChange={(event) =>
                                  setPaymentDraft((current) => current ? { ...current, amount: event.target.value } : current)
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</span>
                              <input
                                type="text"
                                value={paymentDraft.notes}
                                onChange={(event) =>
                                  setPaymentDraft((current) => current ? { ...current, notes: event.target.value } : current)
                                }
                                placeholder={scope === 'sale' ? 'Received from customer' : 'Paid to customer'}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                              />
                            </label>
                            <div className="flex items-end justify-end gap-2">
                              <button
                                type="button"
                                onClick={closeDraft}
                                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingPayment}
                                onClick={() => handleSavePayment(row, scope)}
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.12),_transparent_35%),linear-gradient(135deg,#111827,#1f2937)] px-8 py-8 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate(`/clients/${client.id}/transfers`)}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Transfers
              </button>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.3em] text-white/60">Customer Payments</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight">{client.name}</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/70">
                Record every payment from the customer after a sale and every payment from us after buying from the customer.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-600"
              >
                <FileText className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-gray-100 px-8 py-6 md:grid-cols-4">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Customer Owes Us</p>
            <p className="mt-2 text-2xl font-black text-emerald-900">${sanitizeMoney(summary.customer_owes_us).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">We Owe Customer</p>
            <p className="mt-2 text-2xl font-black text-amber-900">${sanitizeMoney(summary.we_owe_customer).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-violet-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-700">Incoming Payments</p>
            <p className="mt-2 text-2xl font-black text-violet-900">${sanitizeMoney(summary.paid_amount).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-sky-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-700">Outgoing Payments</p>
            <p className="mt-2 text-2xl font-black text-sky-900">${sanitizeMoney(summary.outgoing_paid_amount).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">Sell Invoices</p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">Customer Pays Us</h2>
            </div>
            <Receipt className="h-8 w-8 text-emerald-500" />
          </div>
          {renderInvoiceTable(saleInvoices, 'sale')}
        </section>

        <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">Buy Invoices</p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">We Pay Customer</h2>
            </div>
            <Wallet className="h-8 w-8 text-amber-500" />
          </div>
          {renderInvoiceTable(customerPurchaseInvoices, 'purchase')}
        </section>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-8 py-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400">Payment Ledger</p>
          <h2 className="mt-2 text-2xl font-black text-gray-900">All Recorded Payments</h2>
        </div>

        {ledgerRows.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <DollarSign className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-4 text-sm font-semibold text-gray-500">No payment entries have been recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledgerRows.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-semibold text-gray-900">{payment.receipt_number || payment.id || 'N/A'}</td>
                    <td className="px-4 py-4 text-gray-600">
                      {payment.created_at ? new Date(payment.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-4 font-semibold text-gray-900">
                      {payment.direction === 'incoming' ? 'Customer paid us' : 'We paid customer'}
                    </td>
                    <td className="px-4 py-4 text-gray-700">{payment.scope === 'sale' ? 'Sell' : 'Buy'}</td>
                    <td className="px-4 py-4 text-gray-700">{payment.invoice_number || 'N/A'}</td>
                    <td className="px-4 py-4 text-right font-bold text-gray-900">${sanitizeMoney(payment.amount).toLocaleString()}</td>
                    <td className="px-4 py-4 text-gray-600">{payment.notes || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadPaymentPdf(payment)}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          <FileText className="h-4 w-4" />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrintPaymentInvoice(payment)}
                          className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
