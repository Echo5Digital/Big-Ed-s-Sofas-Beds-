"use client";

// Demo-only client-side cart & wishlist state for this frontend phase.
// Nothing here is persisted to an account or backend — it exists purely to
// demonstrate the interaction pattern the future order/wishlist services
// will plug into.

import { createContext, useContext, useState, useCallback, useMemo } from "react";

const DemoCartContext = createContext(null);

export function DemoCartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [wishlistIds, setWishlistIds] = useState([]);

  const addToCart = useCallback((product, quantity = 1) => {
    setCartItems((items) => {
      const existing = items.find((item) => item.productId === product.id);
      if (existing) {
        return items.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [
        ...items,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image,
          price: product.price,
          quantity,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCartItems((items) => items.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId, quantity) => {
    setCartItems((items) => {
      if (quantity <= 0) {
        return items.filter((item) => item.productId !== productId);
      }
      return items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      );
    });
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
