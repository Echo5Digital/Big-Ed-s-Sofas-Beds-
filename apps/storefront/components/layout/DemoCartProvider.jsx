"use client";

// Demo-only client-side cart & wishlist state for this frontend phase.
// Nothing here is persisted to an account or backend — it exists purely to
// demonstrate the interaction pattern the future order/wishlist services
// will plug into.

import { createContext, useContext, useState, useCallback } from "react";

const DemoCartContext = createContext(null);

export function DemoCartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState([]);

  const addToCart = useCallback(() => {
    setCartCount((count) => count + 1);
  }, []);

  const toggleWishlist = useCallback((productId) => {
    setWishlistIds((ids) =>
      ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId]
    );
  }, []);

  const value = { cartCount, addToCart, wishlistIds, toggleWishlist };

  return <DemoCartContext.Provider value={value}>{children}</DemoCartContext.Provider>;
}

export function useDemoCart() {
  const context = useContext(DemoCartContext);
  if (!context) {
    throw new Error("useDemoCart must be used within a DemoCartProvider");
  }
  return context;
}
