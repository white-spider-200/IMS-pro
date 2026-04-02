import React, { useMemo } from 'react';
import { ArrowLeft, Download, FileSpreadsheet, FileText, ArrowUpRight } from 'lucide-react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { exportRowsToExcel, exportTextLinesToPdf } from '../lib/fileExports';

type EntityType = 'warehouses' | 'brands' | 'categories' | 'products' | 'product_variants';

type OutletContext = {
  warehouses?: any[];
  brands?: any[];
  categories?: any[];
  products?: any[];
  variants?: any[];
  balances?: any[];
  movements?: any[];
  suppliers?: any[];
};

type MovementRow = {
  id: string;
  timestamp: number;
  date: string;
  warehouse: string;
  product: string;
  variant: string;
  type: string;
  quantity: number;
  status: string;
  notes: string;
};

const PAGE_CONFIG: Record<EntityType, { singular: string; backPath: string; paramLabel: string }> = {
  warehouses: { singular: 'Warehouse', backPath: '/warehouses', paramLabel: 'warehouseId' },
  brands: { singular: 'Brand', backPath: '/brands', paramLabel: 'brandId' },
  categories: { singular: 'Category', backPath: '/categories', paramLabel: 'categoryId' },
  products: { singular: 'Product', backPath: '/products', paramLabel: 'productId' },
  product_variants: { singular: 'Variant', backPath: '/variants', paramLabel: 'variantId' },
};

const formatDate = (value: any) => {
  if (!value) return 'N/A';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

export default function EntityReportPage({ entityType }: { entityType: EntityType }) {
  const navigate = useNavigate();
  const params = useParams();
  const {
    warehouses = [],
    brands = [],
    categories = [],
    products = [],
    variants = [],
    balances = [],
    movements = [],
    suppliers = [],
  } = useOutletContext<OutletContext>();

  const entityId = params[PAGE_CONFIG[entityType].paramLabel];

  const getWarehouseName = (warehouseId: string) =>
    warehouses.find((entry) => entry.id === warehouseId)?.name || 'Unknown Warehouse';
  const getCategoryName = (categoryId: string) =>
    categories.find((entry) => entry.id === categoryId)?.name || 'N/A';
  const getSupplierName = (supplierId: string) =>
    suppliers.find((entry) => entry.id === supplierId)?.name || 'N/A';
  const getProductName = (productId: string) =>
    products.find((entry) => entry.id === productId)?.name || 'Unknown Product';

  const entity = useMemo(() => {
    switch (entityType) {
      case 'warehouses':
        return warehouses.find((entry) => entry.id === entityId) || null;
      case 'brands':
        return brands.find((entry) => entry.id === entityId) || null;
      case 'categories':
        return categories.find((entry) => entry.id === entityId) || null;
      case 'products':
        return products.find((entry) => entry.id === entityId) || null;
      case 'product_variants':
        return variants.find((entry) => entry.id === entityId) || null;
      default:
        return null;
    }
  }, [brands, categories, entityId, entityType, products, variants, warehouses]);

  const pageTitle = useMemo(() => {
    if (!entity) return '';
    if (entityType === 'product_variants') {
      return entity.variant_code || entity.barcode || 'Variant';
    }
    return entity.name || PAGE_CONFIG[entityType].singular;
  }, [entity, entityType]);

  const pageSubtitle = useMemo(() => {
    if (!entity) return '';
    if (entityType === 'warehouses') return 'All recorded movements in this warehouse.';
    if (entityType === 'brands') return 'All recorded movements for products in this brand.';
    if (entityType === 'categories') return 'All recorded movements for products in this category.';
    if (entityType === 'products') return 'All recorded movements for this product.';
    return `All recorded movements for ${getProductName(entity.product_id)}.`;
  }, [entity, entityType, getProductName]);

  const movementRows = useMemo<MovementRow[]>(() => {
    if (!entity) return [];

    const relatedVariantIds = (() => {
      if (entityType === 'product_variants') {
        return [entity.id];
      }

      if (entityType === 'products') {
        return variants.filter((variant) => variant.product_id === entity.id).map((variant) => variant.id);
      }

      if (entityType === 'brands') {
        const productIds = products.filter((product) => product.brand_id === entity.id).map((product) => product.id);
        return variants.filter((variant) => productIds.includes(variant.product_id)).map((variant) => variant.id);
      }

      if (entityType === 'categories') {
        const productIds = products.filter((product) => product.category_id === entity.id).map((product) => product.id);
        return variants.filter((variant) => productIds.includes(variant.product_id)).map((variant) => variant.id);
      }

      if (entityType === 'warehouses') {
        return variants.map((variant) => variant.id);
      }

      return [];
    })();

    return movements
      .filter((movement) => {
        if (entityType === 'warehouses') {
          return movement.warehouse_id === entity.id;
        }
        return relatedVariantIds.includes(movement.variant_id);
      })
      .map((movement) => {
        const variant = variants.find((entry) => entry.id === movement.variant_id);
        const product = products.find((entry) => entry.id === variant?.product_id);

        return {
          id: movement.id,
          timestamp: new Date(movement.timestamp?.toDate ? movement.timestamp.toDate() : movement.timestamp || 0).getTime(),
          date: formatDate(movement.timestamp),
          warehouse: getWarehouseName(movement.warehouse_id),
          product: product?.name || 'Unknown Product',
          variant: variant?.variant_code || variant?.barcode || movement.variant_id || 'N/A',
          type: movement.movement_type || 'N/A',
          quantity: Number(movement.quantity || 0),
          status: movement.status || 'N/A',
          notes: movement.notes || '',
        };
      })
      .sort((left, right) => right.timestamp - left.timestamp);
  }, [entity, entityType, movements, products, variants, warehouses]);

  const handleExportExcel = () => {
    if (!entity || movementRows.length === 0) {
      toast.info('No report data available to export');
      return;
    }

    exportRowsToExcel(
      `${String(pageTitle).replace(/\s+/g, '_')}.xls`,
      pageTitle,
      ['Date', 'Warehouse', 'Product', 'Variant', 'Type', 'Quantity', 'Status', 'Notes'],
      movementRows.map((movement) => [
        movement.date,
        movement.warehouse,
        movement.product,
        movement.variant,
        movement.type,
        movement.quantity,
        movement.status,
        movement.notes || '-',
      ])
    );
  };

  const handleExportPdf = () => {
    if (!entity || movementRows.length === 0) {
      toast.info('No report data available to export');
      return;
    }

    const lines = [
      pageTitle,
      pageSubtitle,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Movements',
      'Date | Warehouse | Product | Variant | Type | Quantity | Status | Notes',
      ...movementRows.map((movement) =>
        [movement.date, movement.warehouse, movement.product, movement.variant, movement.type, movement.quantity, movement.status, movement.notes || '-'].join(' | ')
      ),
    ];

    exportTextLinesToPdf(`${String(pageTitle).replace(/\s+/g, '_')}.pdf`, lines);
  };

  if (!entity) {
    return (
      <div className="app-surface p-10">
        <p className="text-sm font-semibold text-gray-500">{PAGE_CONFIG[entityType].singular} not found.</p>
        <button
          type="button"
          onClick={() => navigate(PAGE_CONFIG[entityType].backPath)}
          className="app-button-primary mt-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-surface overflow-hidden">
        <div className="border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:gap-6">
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => navigate(PAGE_CONFIG[entityType].backPath)}
                  className="app-button-secondary"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-gray-400">{PAGE_CONFIG[entityType].singular} Report</p>
                  <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
                    <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{pageTitle}</h1>
                    <button
                      type="button"
                      onClick={() => navigate('/reports/movements')}
                      className="group flex items-center gap-2.5 self-start rounded-full border border-indigo-100 bg-indigo-50/50 px-4 py-1.5 text-[11px] font-bold text-indigo-600 transition-all hover:bg-indigo-50 hover:border-indigo-200 shadow-sm"
                    >
                      <span className="flex h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      Detailed Report
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{pageSubtitle}</p>
                </div>
              </div>

            </div>

            <div className="flex flex-wrap gap-3 xl:justify-end">
              <button
                type="button"
                onClick={handleExportExcel}
                className="app-button-secondary"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </button>
              <button type="button" onClick={handleExportPdf} className="app-button-secondary">
                <FileText className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {movementRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <Download className="h-6 w-6 text-gray-300" />
              </div>
              <p className="mt-5 text-base font-semibold text-gray-700">No movement history found.</p>
              <p className="mt-2 text-sm text-gray-500">
                This {PAGE_CONFIG[entityType].singular.toLowerCase()} does not have any recorded transfers or stock activity yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50/80 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    <tr>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Warehouse</th>
                      <th className="px-5 py-4">Product</th>
                      <th className="px-5 py-4">Variant</th>
                      <th className="px-5 py-4">Type</th>
                      <th className="px-5 py-4 text-right">Quantity</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {movementRows.map((movement) => (
                      <tr key={movement.id} className="transition-colors hover:bg-gray-50/70">
                        <td className="px-5 py-4 text-gray-600">{movement.date}</td>
                        <td className="px-5 py-4 font-medium text-gray-700">{movement.warehouse}</td>
                        <td className="px-5 py-4 text-gray-700">{movement.product}</td>
                        <td className="px-5 py-4 font-medium text-gray-900">{movement.variant}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold capitalize text-indigo-700">
                            {movement.type}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-gray-900">{movement.quantity}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                            {movement.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{movement.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
