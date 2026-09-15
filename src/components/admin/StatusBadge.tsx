import { Badge } from "@/components/ui";
import { CHANNEL_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, STATUS_LABELS } from "@/lib/admin/constants";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning" | "brass";

const ORDER_TONES: Record<string, Tone> = {
  pending: "warning",
  confirmed: "accent",
  processing: "brass",
  shipped: "brass",
  delivered: "success",
  cancelled: "danger",
  refunded: "danger",
};

const PAYMENT_TONES: Record<string, Tone> = {
  unpaid: "neutral",
  pending_verification: "warning",
  paid: "success",
  failed: "danger",
  refunded: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_TONES[status] ?? "neutral"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function PaymentBadge({ status, method }: { status: string; method?: string }) {
  const label = PAYMENT_STATUS_LABELS[status] ?? status;
  return (
    <Badge tone={PAYMENT_TONES[status] ?? "neutral"}>
      {method ? `${PAYMENT_METHOD_LABELS[method] ?? method} · ${label}` : label}
    </Badge>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const tone: Tone = channel === "whatsapp" ? "success" : channel === "messenger" ? "accent" : channel === "manual" ? "brass" : "neutral";
  return <Badge tone={tone}>{CHANNEL_LABELS[channel] ?? channel}</Badge>;
}

export function ProductStatusBadge({ status }: { status: string }) {
  const tone: Tone = status === "published" ? "success" : status === "archived" ? "danger" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export default StatusBadge;
