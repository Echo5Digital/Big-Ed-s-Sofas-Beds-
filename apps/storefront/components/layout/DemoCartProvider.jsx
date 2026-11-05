"use client";

// Client-side cart & wishlist state. Cart contents aren't persisted to an
// account or backend — lines carry a real variantId so checkout can submit
// them directly to POST /api/checkout. They ARE persisted to sessionStorage
// (tab-scoped, cleared when the tab closes) purely so a page reload doesn't
// wipe the cart out from under a shopper mid-checkout — e.g. while on the
// sign-in gate in app/checkout/page.jsx, a password manager or accidental
// refresh shouldn't lose what they were about to buy.

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useSyncExternalStore } from "react";

const DemoCartContext = createContext(null);
const CART_STORAGE_KEY = "big-eds-cart";

function readStoredCart() {
  try {
    const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt/foreign JSON in the slot — start fresh rather than crash the app.
    return [];
  }
}

// A stable sentinel, not just `[]` — reference equality against this exact
// array is how the provider below tells "haven't restored from storage yet"
// apart from "restored, and the stored cart happened to be empty."
const NOT_YET_RESTORED = [];

function subscribe() {
  // Nothing outside this tab writes to this sessionStorage key after mount,
  // so there's no external change to subscribe to — this store only ever
  // needs to be read once. useSyncExternalStore is used anyway because it's
  // the one hydration-safe way to read a client-only value during render:
  // getServerSnapshot keeps server and first-client-paint output identical
  // (no hydration mismatch), and getSnapshot's result is cached directly in
  // module scope, not React state, so reading it is a plain function call,
  // not a ref access.
  return () => {};
}

let cachedInitialCart = null;
function getSnapshot() {
  if (cachedInitialCart === null) cachedInitialCart = readStoredCart();
  return cachedInitialCart;
}

function getServerSnapshot() {
  return NOT_YET_RESTORED;
}

export function DemoCartProvider({ children }) {
  const initialCart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [cartItems, setCartItems] = useState(NOT_YET_RESTORED);
  const [wishlistIds, setWishlistIds] = useState([]);

  // True for exactly one render: the first client render after hydration,
  // where initialCart has already resolved to the real sessionStorage value
  // but cartItems hasn't picked it up yet. Setting state here (during render,
  // not an effect) means the restored cart appears in that same render pass
  // instead of flashing an empty cart for a frame first.
  if (cartItems === NOT_YET_RESTORED && initialCart !== NOT_YET_RESTORED) {
    setCartItems(initialCart);
  }

  useEffect(() => {
    if (cartItems === NOT_YET_RESTORED) return;
    window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  // `product` here is the normalized card shape (id, slug, name, image,
  // price) plus a `variantId` identifying which real Variant to check out —
  // from the product detail page's selected variant, or the product's sole/
  // first active variant when added from a card with no selector.
  const addToCart = useCallback((product, quantity = 1) => {
    setCartItems((items) => {
      const existing = items.find((item) => item.variantId === product.variantId);
      if (existing) {
        return items.map((item) =>
          item.variantId === product.variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...items,
        {
          productId: product.id,
          variantId: product.variantId,
          slug: product.slug,
          name: product.name,
          image: product.image,
          price: product.price,
          quantity,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((variantId) => {
    setCartItems((items) => items.filter((item) => item.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId, quantity) => {
    setCartItems((items) => {
      if (quantity <= 0) {
        return items.filter((item) => item.variantId !== variantId);
      }
      return items.map((item) =>
        item.variantId === variantId ? { ...item, quantity } : item
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const toggleWishlist = useCallback((productId) => {
    setWishlistIds((ids) =>
      ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]
    );
  }, []);

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems]
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems]
  );

  // Memoized so components that only read e.g. cartCount (like SiteHeader,
  // re-rendered on every navbar hover via its own local state) don't also
  // get a new context value — and therefore a forced re-render — on every
  // render of whatever triggered this provider to re-render.
  const value = useMemo(
    () => ({
      cartItems,
      cartCount,
      cartSubtotal,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      wishlistIds,
      toggleWishlist,
    }),
    [cartItems, cartCount, cartSubtotal, addToCart, removeFromCart, updateQuantity, clearCart, wishlistIds, toggleWishlist]
  );

  return <DemoCartContext.Provider value={value}>{children}</DemoCartContext.Provider>;
}

export function useDemoCart() {
  const context = useContext(DemoCartContext);
  if (!context) {
    throw new Error("useDemoCart must be used within a DemoCartProvider");
  }
  return context;
}
