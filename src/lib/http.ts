import { NextResponse } from "next/server";
import { PayPalError } from "./paypal";

export function fail(e: unknown) {
  if (e instanceof PayPalError) {
    return NextResponse.json({ error: e.message, paypal: e.body }, { status: 502 });
  }
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}
