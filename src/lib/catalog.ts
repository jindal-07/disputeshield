// The demo seller's storefront ("Loom & Thread", a small apparel shop).
// Listings are written the way real small-shop listings are: some details are easy to miss.

export type Product = {
  sku: string;
  name: string;
  price: string; // USD
  description: string;
  attributes: Record<string, string>;
  returnPolicy: string;
};

export const SHOP_NAME = "Loom & Thread";

export const CATALOG: Product[] = [
  {
    sku: "HD-BLU-M",
    name: "Organic Cotton Hoodie — Ocean Blue, Size M",
    price: "38.00",
    description:
      "Heavyweight organic cotton hoodie. Relaxed fit. Note: this style runs one size small — we recommend sizing up.",
    attributes: { colour: "Ocean Blue", size: "M", fit: "runs small", material: "100% organic cotton" },
    returnPolicy: "Returns accepted within 30 days, buyer pays return shipping.",
  },
  {
    sku: "HD-BLU-L",
    name: "Organic Cotton Hoodie — Ocean Blue, Size L",
    price: "38.00",
    description:
      "Heavyweight organic cotton hoodie. Relaxed fit. Note: this style runs one size small — we recommend sizing up.",
    attributes: { colour: "Ocean Blue", size: "L", fit: "runs small", material: "100% organic cotton" },
    returnPolicy: "Returns accepted within 30 days, buyer pays return shipping.",
  },
  {
    sku: "HD-NVY-M",
    name: "Classic Hoodie — Navy, Size M",
    price: "29.00",
    description: "Midweight cotton-poly blend hoodie. True to size.",
    attributes: { colour: "Navy", size: "M", fit: "true to size", material: "60% cotton / 40% polyester" },
    returnPolicy: "Returns accepted within 30 days, buyer pays return shipping.",
  },
  {
    sku: "TS-WHT-M",
    name: "Essential Tee — White, Size M",
    price: "18.00",
    description: "Everyday crew-neck tee. True to size.",
    attributes: { colour: "White", size: "M", fit: "true to size", material: "100% cotton" },
    returnPolicy: "Returns accepted within 30 days, buyer pays return shipping.",
  },
  {
    sku: "JK-DEN-M",
    name: "Denim Jacket — Washed Indigo, Size M",
    price: "64.00",
    description: "Rigid denim jacket with a vintage wash. Colour may vary slightly from photos due to the wash process.",
    attributes: { colour: "Washed Indigo", size: "M", fit: "true to size", material: "100% cotton denim" },
    returnPolicy: "Returns accepted within 30 days, buyer pays return shipping.",
  },
];

export function getProduct(sku: string) {
  return CATALOG.find((p) => p.sku === sku);
}
