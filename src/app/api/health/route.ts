import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.setting.findFirst({ select: { key: true } });
    return NextResponse.json({ status: "ok", brand: "ORYNVE", version: process.env.npm_package_version ?? "2.0.0", time: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ status: "degraded", error: "database" }, { status: 503 });
  }
}
