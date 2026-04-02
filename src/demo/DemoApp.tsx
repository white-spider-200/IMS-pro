import React from 'react';
import { Boxes, Database, Package, Users, Warehouse as WarehouseIcon } from 'lucide-react';
import { demoBrands, demoClients, demoProducts, demoSuppliers, demoUser, demoWarehouses } from './demoData';

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-gray-900">{value}</p>
      <p className="mt-2 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

export default function DemoApp() {
  return (
    <div className="min-h-screen bg-[#f5f5f5] px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
          <div className="bg-[linear-gradient(135deg,#111827,#374151)] px-8 py-10 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Boxes className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-white/60">Local Demo</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight">IMS Pro Demo Mode</h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm text-white/70">
              This mode uses local sample data so you can review layout, navigation, and visual behavior without Firebase writes.
            </p>
          </div>

          <div className="grid gap-6 px-8 py-10 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Warehouses" value={String(demoWarehouses.length)} detail="Local warehouse records for UI testing." />
            <SummaryCard label="Products" value={String(demoProducts.length)} detail="Demo products with variants and stock." />
            <SummaryCard label="Suppliers" value={String(demoSuppliers.length)} detail="Sample vendors for master-data screens." />
            <SummaryCard label="Clients" value={String(demoClients.length)} detail="Preloaded customer records." />
          </div>

          <div className="grid gap-6 px-8 pb-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[2rem] border border-gray-200 bg-gray-50 p-6">
              <h2 className="text-xl font-black text-gray-900">What You Can Test Here</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-5">
                  <WarehouseIcon className="h-5 w-5 text-gray-500" />
                  <p className="mt-3 font-bold text-gray-900">Warehouse views</p>
                  <p className="mt-1 text-sm text-gray-500">Cards, lists, summaries, and detail presentation.</p>
                </div>
                <div className="rounded-2xl bg-white p-5">
                  <Package className="h-5 w-5 text-gray-500" />
                  <p className="mt-3 font-bold text-gray-900">Product pages</p>
                  <p className="mt-1 text-sm text-gray-500">Variants, labels, pricing, and preview states.</p>
                </div>
                <div className="rounded-2xl bg-white p-5">
                  <Users className="h-5 w-5 text-gray-500" />
                  <p className="mt-3 font-bold text-gray-900">Client and supplier UI</p>
                  <p className="mt-1 text-sm text-gray-500">Search, cards, and general presentation flows.</p>
                </div>
                <div className="rounded-2xl bg-white p-5">
                  <Database className="h-5 w-5 text-gray-500" />
                  <p className="mt-3 font-bold text-gray-900">No backend writes</p>
                  <p className="mt-1 text-sm text-gray-500">Safe mode for front-end testing only.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-white p-6">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400">Demo Account</p>
              <div className="mt-4 rounded-2xl bg-gray-50 p-5">
                <p className="text-lg font-black text-gray-900">{demoUser.name}</p>
                <p className="mt-1 text-sm text-gray-500">{demoUser.email}</p>
              </div>
              <div className="mt-6">
                <p className="text-sm font-bold text-gray-900">Demo brands</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {demoBrands.map((brand) => (
                    <span key={brand.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">
                      {brand.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
