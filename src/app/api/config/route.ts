import { NextResponse, connection } from "next/server";

// Public config for the browser (the PayPal client id is public by design).
export async function GET() {
  await connection();
  return NextResponse.json({ paypalClientId: process.env.PAYPAL_CLIENT_ID ?? "" });
}
