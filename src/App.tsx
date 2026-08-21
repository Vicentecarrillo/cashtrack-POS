import React, { useEffect, useMemo, useState, useRef } from "react";
import Numpad from "./components/Numpad";
import Products from "./components/Products";
import {
  ensureDurableStorage,
  deviceId,
  APP_VERSION,
  API_ACTIONS,
} from "./config";
import { putEvent, countUnsynced, Product, getMeta, setMeta } from "./db";
import { useSyncQueue } from "./useSyncQueue";
import { exportCSV } from "./exportCSV";
import Cart from "./components/Cart";
import ThemeToggle from "./components/ThemeToggle";
import MobileCartSheet from "./components/MobileCartSheet";
import { usePersistentState } from "./usePersistentState";
import { useCatalog } from "./useCatalog";
import { usePersistentString } from "./usePersistentString";
import { filterByLocation } from "./filterByLocation";
import { currency } from "./currency";
import {
  calculatediscount,
  calculatesubTotal,
  calculateTotal,
  type CartItem,
} from "./cart";
import SaleExpenseModal from "./components/SaleExpenseModal";
import HistoryModal from "./components/HistoryModal";
import { Search } from "lucide-react";
import { callConfig } from "./apiWrapper";
import RefreshButton from "./components/RefreshButton";
import SuccessToast from "./components/SuccessToast";

export default function App() {
  const [unsynced, setUnsynced] = useState(0);
  const [search, setSearch] = useState("");

  const { requestSync } = useSyncQueue({
    onCount: setUnsynced, // keep your badge accurate
  });
  const [online, setOnline] = useState(navigator.onLine);
  const devId = useMemo(() => deviceId(), []);
  const [location, setLocation] = usePersistentString("pos:location", "");
  const {
    products: allProducts,
    activeSheetID,
    configSheetID,
    user_name,
    role,
    locations,
    loading,
    error,
    ready,
    refresh,
  } = useCatalog();
  const [sheetID, setSheetID] = useState<string | null>(activeSheetID);
  // const [configID, setConfigSheetID] = useState<string | null>(configSheetID);
  const _activeSheetID = () => sheetID || activeSheetID;
  // const _configSheetID = () => configID || configSheetID;

  // Build a locations list for the dropdown that ALWAYS contains the current location
  const locationsDisplay = useMemo(() => {
    const set = new Set(locations.map((r) => r.toLowerCase()));
    if (location) set.add(location.toLowerCase());
    // keep admin first, sort the rest
    const arr = Array.from(set);
    arr.sort((a, b) =>
      a === "admin" ? -1 : b === "admin" ? 1 : a.localeCompare(b)
    );
    return arr;
  }, [locations, location]);

  // Only after the network attempt completes, ensure location is valid
  useEffect(() => {
    if (!ready || locationsDisplay.length === 0) return;
    setLocation((curr) =>
      locationsDisplay.includes(curr) ? curr : locationsDisplay[0]
    );
  }, [ready, locationsDisplay, setLocation]);

  // filter locally (no network)
  const products = useMemo(
    () => filterByLocation(allProducts, location),
    [allProducts, location]
  );

  const cartKey = `cart:${location}`;
  const noteKey = `note:${location}`;
  const discountKey = `discount:${location}`;
  const cashKey = `cash:${location}`;

  // Cart + inputs persisted
  const [cart, setCart] = usePersistentState<CartItem[]>(cartKey, []);
  const [discountInput, setDiscountInput] = usePersistentState<string>(
    discountKey,
    ""
  );
  const [paymentType, setPaymentType] = useState<"cash" | "card">("cash");
  const [cashInput, setCashInput] = usePersistentState<string>(cashKey, "");
  const [note, setNote] = usePersistentState<string>(noteKey, "");
  const [cartOpen, setCartOpen] = useState(false);
  const [saleExpenseOpen, setSaleExpenseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const itemCount = useMemo(
    () => cart.reduce((n, ci) => n + ci.qty, 0),
    [cart]
  );

  useEffect(() => {
    ensureDurableStorage();
  }, []);

  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);


  useEffect(() => {
    (async () => setUnsynced(await countUnsynced()))();
  }, []);

  const [copied, setCopied] = useState(false);
  const copyToClipboard = async (t: string | null) => {
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // reset after 2s
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  // Optional: reuse Numpad for the cash field
  const press = (k: string) => {
    setCashInput((curr) => {
      if (k === "del") return curr.slice(0, -1);
      if (k === "." && curr.includes(".")) return curr;
      return curr + k;
    });
  };

  function addToCart(p: Product) {
    setCart((items) => {
      const i = items.findIndex((ci) => ci.product.product_id === p.product_id);
      if (i === -1) return [...items, { product: p, qty: 1 }];
      const copy = items.slice();
      copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
      return copy;
    });
  }

  const inc = (id: string) =>
    setCart((items) =>
      items.map((ci) =>
        ci.product.product_id === id ? { ...ci, qty: ci.qty + 1 } : ci
      )
    );
  const dec = (id: string) =>
    setCart((items) =>
      items.flatMap((ci) => {
        if (ci.product.product_id !== id) return [ci];
        const q = ci.qty - 1;
        return q <= 0 ? [] : [{ ...ci, qty: q }];
      })
    );
  const removeItem = (id: string) =>
    setCart((items) => items.filter((ci) => ci.product.product_id !== id));
  const clearCart = () => {
    setCart([]);
    setCartOpen(false);
  };

  const subTotal = useMemo(() => calculatesubTotal(cart), [cart]);
  const discount = useMemo(
    () => calculatediscount(subTotal, discountInput),
    [discountInput, subTotal]
  );

  const total = calculateTotal(subTotal, discount);

  async function save() {
    if (cart.length === 0) {
      alert("Add items first");
      return;
    }
    if (total <= 0) {
      alert("Total must be > 0");
      return;
    }

    const timeStamp = new Date().toISOString();

    const line_items = cart.map((ci) => ({
      product_id: ci.product.product_id,
      name: ci.product.name,
      category: ci.product.category,
      vendor: ci.product.vendor,
      quantity: ci.qty,
      unit_price: ci.product.price,
      unit_cost: ci.product.unit_cost,
      line_total: ci.product.price * ci.qty,
      location: location,
      timestamp: timeStamp,
      payment_type: paymentType,
    }));

    const evt = {
      kind: "sale",
      payment_type: paymentType,
      local_event_id: crypto.randomUUID?.() ?? String(Date.now()),
      ts: timeStamp,
      location: location,
      user_name,
      amount: total,
      note,
      device_id: devId,
      synced: 0 as 0 | 1,
      attempts: 0,
      app_version: APP_VERSION,
      line_items, // ← include line items
      discount: discount, // optional metadata
      discount_pct: parseFloat(discountInput || "0"),
    };

    await putEvent(evt);

    // reset UI
    setCart([]);
    setDiscountInput("");
    setCashInput("");
    setPaymentType("cash");
    setNote("");
    setUnsynced(await countUnsynced());
    requestSync();

    // Show success animation
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  }

  return (
    <div className="min-h-dvh flex flex-col h-full overflow-hidden">
      <div
        className="container-main mx-auto w-full max-w-5xl md:rounded-2xl shadow-xl
                  border-none md:border md:border-slate-200 bg-slate-100
                  md:dark:border-slate-700 dark:bg-slate-800/80 overflow-hidden flex flex-col overflow-hidden"
      >
        <div
          className="p-4 md:rounded-2xl shadow-xl
                border-none md:border md:border-slate-200 bg-stone-100/33
                md:dark:border-slate-700 dark:bg-slate-800/80 min-h-screen flex flex-col overflow-hidden"
        >
          {/* <h1 className="mb-3 text-xl font-semibold">Cashtrack</h1> */}

          {/* HEADER */}
          <div className="mb-4 flex flex-wrap items-start text-slate-300 text-sm">
            <span className="inline-flex items-center gap-1 px-1 py-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  online ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="leading-none">
                {online ? "Online" : "Offline"}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 px-1 py-1 text-sm">
              ⏳ {unsynced}
            </span>
            <span className="inline-flex items-center gap-1 px-1 py-1 text-sm">
              <RefreshButton onClick={refresh} loading={loading} />
            </span>

            {/* Register selector on the right */}
            <div className="ml-auto flex flex-col items-end gap-1">
              {/* <label htmlFor="register" className="text-fg-3 pr-2">
                Register
              </label> */}
              <div className="h-9 flex items-center gap-2">
                <select
                  id="register"
                  value={location}
                  onChange={(e) => setLocation(e.target.value.toLowerCase())}
                  className="select px-2 text-sm"
                >
                  {locationsDisplay.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <ThemeToggle />
                <button
                  aria-label="Menu"
                  onClick={() => setMenuOpen(true)}
                  className="h-9 p-2 rounded-lg border"
                >
                  <div className="space-y-1">
                    <span className="block h-0.5 w-5 bg-slate-300 dark:bg-slate-200"></span>
                    <span className="block h-0.5 w-5 bg-slate-300 dark:bg-slate-200"></span>
                    <span className="block h-0.5 w-5 bg-slate-300 dark:bg-slate-200"></span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* app */}
          <div className="flex flex-col overflow-hidden flex-1 flex md:flex-row overflow-hidden">
            <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LEFT: Products */}
              <div className="flex flex-col overflow-hidden pt-3 pr-3 pl-3 rounded-xl gap-1">
                <div className="mb-2 flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <input
                      name="search"
                      type="text"
                      placeholder="Products"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex-1"
                    />
                    {/* Clear button (only visible if search has value) */}
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                        className="absolute border-none right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        ×
                      </button>
                    )}
                    <Search
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
                <div className={`flex-1 flex flex-col overflow-hidden`}>
                  <Products
                    itemsInCart={itemCount > 0}
                    products={products}
                    location={location}
                    loading={loading}
                    error={error}
                    onSelect={addToCart}
                    search={search}
                  />
                </div>
              </div>

              {/* RIGHT: Cart pane (hidden on mobile, visible on md+) */}
              <div className="scrollbar-none overflow-auto flex-1 overflow-y-auto hidden md:flex flex-col p-3 rounded-xl">
                <Cart
                  items={cart}
                  onInc={inc}
                  onDec={dec}
                  onRemove={removeItem}
                  onClear={clearCart}
                  subTotal={subTotal}
                  discountInput={discountInput}
                  onDiscountInput={setDiscountInput}
                  cashInput={cashInput}
                  onCashInput={setCashInput}
                />

                {/* CASH / CARD */}
                <div className="w-full flex rounded-xl border border-slate-300 dark:border-slate-700 mt-3">
                  <button
                    onClick={() => setPaymentType("cash")}
                    className={`px-4 py-2 flex-1 ${
                      paymentType === "cash"
                        ? "bg-emerald-400 text-emerald-950"
                        : "bg-slate-100 dark:bg-slate-900"
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => setPaymentType("card")}
                    className={`px-4 py-2 flex-1 ${
                      paymentType === "card"
                        ? "bg-sky-400 text-sky-950"
                        : "bg-slate-100 dark:bg-slate-900"
                    }`}
                  >
                    Card
                  </button>
                </div>
                {/* add for VITE_ENV == main */}
                {/* <input
                  name="note"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full mt-3"
                /> */}

                <div className="mt-2">
                  <Numpad onPress={press} />
                </div>

                <div className="mt-3 flex">
                  <button onClick={save} className="btn-primary flex-1 p-4">
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile pinned cart bar (stays as-is) */}
      {itemCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed inset-x-4 bottom-4 z-50 flex items-center justify-between rounded-2xl
               border border-emerald-500/30 bg-emerald-500/20 backdrop-blur px-4 py-3"
          aria-label="Open cart"
        >
          <span className="font-medium">
            Cart • {itemCount} item{itemCount > 1 ? "s" : ""}
          </span>
          <span className="rounded-xl bg-emerald-400 px-3 py-1 font-semibold text-emerald-950">
            {currency(total)}
          </span>
        </button>
      )}

      {/* Mobile bottom sheet via portal */}
      <MobileCartSheet open={cartOpen} onClose={() => setCartOpen(false)}>
        <Cart
          items={cart}
          onInc={inc}
          onDec={dec}
          onRemove={removeItem}
          onClear={clearCart}
          subTotal={subTotal}
          discountInput={discountInput}
          onDiscountInput={setDiscountInput}
          cashInput={cashInput}
          onCashInput={setCashInput}
        />

        <div className="w-full flex rounded-xl border border-slate-300 dark:border-slate-700 mt-3">
          <button
            onClick={() => setPaymentType("cash")}
            className={`px-4 py-2 flex-1 ${
              paymentType === "cash"
                ? "bg-emerald-400 text-emerald-950"
                : "bg-slate-100 dark:bg-slate-900"
            }`}
          >
            Cash
          </button>
          <button
            onClick={() => setPaymentType("card")}
            className={`px-4 py-2 flex-1 ${
              paymentType === "card"
                ? "bg-sky-400 text-sky-950"
                : "bg-slate-100 dark:bg-slate-900"
            }`}
          >
            Card
          </button>
        </div>
        {/* add for VITE_ENV == main */}
        {/* <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-3 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400
                 border-slate-300 bg-white text-slate-900
                 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        /> */}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => {
              save();
              setCartOpen(false);
            }}
            className="flex-1 rounded-xl bg-emerald-400 py-3 font-semibold text-emerald-950 hover:bg-emerald-300 active:scale-95"
          >
            Save
          </button>
        </div>
      </MobileCartSheet>
      <SaleExpenseModal
        open={saleExpenseOpen}
        onClose={() => setSaleExpenseOpen(false)}
        location={location}
        deviceId={devId}
        onSubmit={async ({ amount, note, kind, payment_type }) => {
          const evt = {
            kind: kind,
            payment_type,
            local_event_id: crypto.randomUUID?.() ?? String(Date.now()),
            ts: new Date().toISOString(),
            location_id: location,
            amount: amount,
            note,
            device_id: devId,
            synced: 0,
            attempts: 0,
            app_version: APP_VERSION,
            line_items: [],
            discount: 0,
            location,
          };
          await putEvent(evt);
          setSaleExpenseOpen(false);
          setUnsynced(await countUnsynced());
          requestSync();

          // Show success animation
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 2000);
        }}
      />
      <HistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
      {/* Right-side drawer menu */}
      <div
        className={`fixed inset-0 z-50 transition ${
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black/50 transition-opacity ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMenuOpen(false)}
        />

        {/* Drawer */}
        <div
          className={`scrollbar-none overflow-auto ml-auto flex flex-col absolute right-0 top-0 h-full w-64 bg-stone-100 dark:bg-slate-900 border-l border-slate-300 
            dark:border-slate-700 shadow-xl transform transition-transform ${
              menuOpen ? "translate-x-0" : "translate-x-full"
            }`}
        >
          <div className="p-4 flex justify-between items-center border-b border-slate-300 dark:border-slate-700">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              aria-label="Close"
              onClick={() => setMenuOpen(false)}
              className="bg-stone-100 dark:bg-slate-900 border-none text-slate-400 hover:text-slate-500 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          {/* Menu items */}
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={() => {
                setSaleExpenseOpen(true);
                setMenuOpen(false);
              }}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              Custom Sale / Expense
            </button>
          </div>
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={() => {
                setHistoryOpen(true);
                setMenuOpen(false);
              }}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              History
            </button>
          </div>
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={() => (window as any).kickSync?.()}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              Sync now
            </button>
          </div>
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={exportCSV}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              Export CSV
            </button>
          </div>
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={() => copyToClipboard(_activeSheetID())}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              {_activeSheetID() ? (
                <span>Active Sales Sheet: {_activeSheetID()}</span>
              ) : (
                <span>No sheet ID stored</span>
              )}
            </button>
            {copied && <span className="text-emerald-500">Copied!</span>}
          </div>
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={() => {
                if (_activeSheetID()) {
                  const url = `https://docs.google.com/spreadsheets/d/${_activeSheetID()}/edit`;
                  window.open(url, "_blank");
                }
              }}
              disabled={!_activeSheetID()}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              Open in Google Sheets
            </button>
          </div>
          {role && role.toLowerCase() === "admin" && (
            <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
              <button
                onClick={async () => {
                  const { activeSheetID = "" } = await callConfig(
                    API_ACTIONS.config.createNewSheet
                  );
                  await setMeta("activeSheetID", activeSheetID);
                  setSheetID(activeSheetID);
                }}
                className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
              >
                Create New Sheet
              </button>
            </div>
          )}
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <button
              onClick={() => {
                if (configSheetID) {
                  const url = `https://docs.google.com/spreadsheets/d/${configSheetID}/edit`;
                  window.open(url, "_blank");
                }
              }}
              disabled={!configSheetID}
              className="bg-stone-50 dark:bg-slate-900 hover:bg-stone-200 w-full border-none rounded-none px-3 py-3 text-left dark:hover:bg-slate-800"
            >
              Open Config in Google Sheets
            </button>
          </div>
          <div className="space-y-3 border-b border-slate-300 dark:border-slate-700">
            <label className="text-sm text-fg-3 block mb-1">Access Key</label>
            <input
              type="text"
              defaultValue={localStorage.getItem("api_key") || ""}
              onBlur={(e) => {
                const api_key = e.target.value.trim();
                localStorage.setItem("api_key", api_key);
                callConfig(API_ACTIONS.config.registerDevice, {
                  device_id: deviceId(),
                  api_key,
                });
                refresh();
              }}
              className="w-full"
            />
          </div>

          <div className="mt-auto pb-5 pl-5 text-xs text-slate-400 border-t border-slate-300 dark:border-slate-700 pt-2">
            v{APP_VERSION}
          </div>
        </div>
      </div>

      {/* Success toast notification */}
      <SuccessToast show={showSuccessToast} />
    </div>
  );
}
