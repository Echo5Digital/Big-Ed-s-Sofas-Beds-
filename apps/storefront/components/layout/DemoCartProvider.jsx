"use client";

// Client-side cart & wishlist state. Cart contents are in-memory only (not
// persisted to an account or backend) — lines carry a real variantId so
// checkout can submit them directly to POST /api/checkout.

import { createContext, useContext, useState, useCallback, useMemo } from "react";

const DemoCartContext = createContext(null);

export function DemoCartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);

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

  const value = {
    cartItems,
    cartCount,
    cartSubtotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    wishlistIds,
    toggleWishlist,
  };

  return <DemoCartContext.Provider value={value}>{children}</DemoCartContext.Provider>;
}

export function useDemoCart() {
  const context = useContext(DemoCartContext);
  if (!context) {
    throw new Error("useDemoCart must be used within a DemoCartProvider");
  }
  return context;
}
