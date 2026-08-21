import * as React from "react";
import {
  getCachedProducts,
  replaceProducts,
  Product,
  getMeta,
  setMeta,
} from "./db";
import { computelocations } from "./catalogLocations";
import { ENDPOINT_PRODUCTS_URL, deviceId } from "./config";

type State = {
  products: Product[];
  activeSheetID: string;
  configSheetID: string;
  locations: string[];
  role: string;
  user_name: string;
  loading: boolean;
  error: string | null;
  ready: boolean;
};

export function useCatalog() {
  const [state, setState] = React.useState<State>({
    products: [],
    activeSheetID: "",
    configSheetID: "",
    locations: [],
    role: "",
    user_name: "",
    loading: true,
    error: null,
    ready: false,
  });

  // Track an in-flight fetch so refresh() can cancel the previous one
  const inFlight = React.useRef<AbortController | null>(null);

  const fetchProducts = React.useCallback(async () => {
    // cancel any previous run
    inFlight.current?.abort();
    const ac = new AbortController();
    inFlight.current = ac;
    const { signal } = ac;

    try {
      // show cache immediately
      const cached = await getCachedProducts();
      const activeSheetID = await getMeta("activeSheetID");
      const configSheetID = await getMeta("activeSheetID");
      const role = await getMeta("role");
      const user_name = await getMeta("user_name");

      if (!signal.aborted) {
        setState((s) => ({
          ...s,
          products: cached,
          activeSheetID,
          configSheetID,
          locations: computelocations(cached, role),
          role,
          user_name,
          loading: true,
          error: null,
          ready: false,
        }));
      }

      // fetch fresh from network
      const apiKey = localStorage.getItem("api_key") || "";
      const devId = deviceId();

      const res = await fetch(ENDPOINT_PRODUCTS_URL, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Device-ID": devId,
        },
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const {
        products = [],
        role: newRole,
        user_name: newUser,
        activeSheetID: newSheet,
        configSheetID: newConfig,
      } = await res.json();

      await replaceProducts(products);
      await setMeta("activeSheetID", newSheet);
      await setMeta("configSheetID", newConfig);
      await setMeta("role", newRole);
      await setMeta("user_name", newUser);

      const updatedProducts = await getCachedProducts();

      if (!signal.aborted) {
        setState({
          products: updatedProducts,
          activeSheetID: newSheet,
          configSheetID: newConfig,
          locations: computelocations(updatedProducts, newRole),
          role: newRole,
          user_name: newUser,
          loading: false,
          error: null,
          ready: true,
        });
      }
    } catch (e: any) {
      if (!signal.aborted) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e?.message || "Fetch failed",
          ready: true,
        }));
      }
    }
  }, []);

  // initial load
  React.useEffect(() => {
    fetchProducts();
    return () => {
      inFlight.current?.abort();
    };
  }, [fetchProducts]);

  const refresh = React.useCallback(() => fetchProducts(), [fetchProducts]);

  return { ...state, refresh };
}
