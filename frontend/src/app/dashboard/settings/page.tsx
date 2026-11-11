"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Copy, KeyRound, Link2 } from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk, useRestaurant } from "@/lib/queries";
import type { PaymentConfiguration, Restaurant } from "@/lib/types";
import { dateTime } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardHeader, Skeleton } from "@/components/ui/misc";

type Form = Pick<Restaurant, "name" | "description" | "cuisine" | "brandColor" | "addressLine" | "city" | "state" | "postalCode" | "phone" | "email" | "taxLabel"> & { taxRatePercent: string };

export default function SettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const restaurant = useRestaurant();
  return (
    <>
      <PageHeader title="Settings" description="Restaurant profile, account and payment integration." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        {restaurant.data ? <ProfileCard restaurant={restaurant.data} editable={isOwner} /> : <Skeleton className="h-[560px]" />}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Your account" />
            <dl className="divide-y divide-border text-[13px]">
              <Row label="Name" value={user?.fullName} />
              <Row label="Email" value={user?.email} />
              <Row label="Role" value={user?.role === "OWNER" ? "Owner — full access" : "Staff — orders, tables, availability"} />
              <Row label="Restaurant URL slug" value={<code className="text-xs">{restaurant.data?.slug}</code>} />
            </dl>
          </Card>
          {isOwner && <PaymentCard />}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{label}</dt><dd className="truncate text-right font-medium">{value ?? "—"}</dd></div>;
}

function toForm(r: Restaurant): Form {
  return {
    name: r.name, description: r.description ?? "", cuisine: r.cuisine ?? "", brandColor: r.brandColor, addressLine: r.addressLine ?? "",
    city: r.city ?? "", state: r.state ?? "", postalCode: r.postalCode ?? "", phone: r.phone ?? "", email: r.email ?? "",
    taxLabel: r.taxLabel, taxRatePercent: String(r.taxRatePercent),
  };
}

function ProfileCard({ restaurant, editable }: { restaurant: Restaurant; editable: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState<Form>(() => toForm(restaurant));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  React.useEffect(() => setForm(toForm(restaurant)), [restaurant]);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(restaurant));
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const save = useMutation({
    mutationFn: () => api<Restaurant>("/restaurant/profile", {
      method: "PUT", body: { ...form, logoUrl: restaurant.logoUrl, taxRatePercent: Number(form.taxRatePercent) },
    }),
    onSuccess: (r) => { qc.setQueryData(qk.restaurant, r); toast.success("Restaurant details saved"); setErrors({}); },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors.length) setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message])));
      toast.error(errorMessage(e));
    },
  });

  return (
    <Card>
      <CardHeader title="Restaurant details" description={editable ? "Shown to guests on your ordering page." : "Only owners can edit these details."} />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <fieldset disabled={!editable} className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Restaurant name" error={errors.name} className="sm:col-span-2"><Input value={form.name} onChange={set("name")} required maxLength={120} /></Field>
          <Field label="Description" className="sm:col-span-2"><Textarea value={form.description ?? ""} onChange={set("description")} maxLength={500} rows={2} /></Field>
          <Field label="Cuisine"><Input value={form.cuisine ?? ""} onChange={set("cuisine")} placeholder="North Indian · Mughlai" /></Field>
          <Field label="Brand colour" error={errors.brandColor} hint="Used on your ordering page">
            <div className="flex gap-2">
              <input type="color" value={form.brandColor} onChange={set("brandColor")} className="h-9 w-10 cursor-pointer rounded-md border border-border bg-surface p-1" aria-label="Pick brand colour" />
              <Input value={form.brandColor} onChange={set("brandColor")} className="font-mono uppercase" maxLength={7} />
            </div>
          </Field>
          <Field label="Address" className="sm:col-span-2"><Input value={form.addressLine ?? ""} onChange={set("addressLine")} /></Field>
          <Field label="City"><Input value={form.city ?? ""} onChange={set("city")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State"><Input value={form.state ?? ""} onChange={set("state")} /></Field>
            <Field label="PIN code"><Input value={form.postalCode ?? ""} onChange={set("postalCode")} inputMode="numeric" maxLength={12} /></Field>
          </div>
          <Field label="Phone"><Input value={form.phone ?? ""} onChange={set("phone")} type="tel" /></Field>
          <Field label="Email" error={errors.email}><Input value={form.email ?? ""} onChange={set("email")} type="email" /></Field>
          <Field label="Tax label"><Input value={form.taxLabel} onChange={set("taxLabel")} maxLength={20} /></Field>
          <Field label="Tax rate (%)" error={errors.taxRatePercent} hint="Added on top of menu prices at checkout">
            <Input value={form.taxRatePercent} onChange={set("taxRatePercent")} inputMode="decimal" />
          </Field>
          <Field label="Currency" hint="Fixed per restaurant"><Input value={restaurant.currency} disabled /></Field>
        </fieldset>
        {editable && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            {dirty && <Button type="button" variant="ghost" onClick={() => setForm(toForm(restaurant))}>Reset</Button>}
            <Button type="submit" variant="primary" disabled={!dirty} loading={save.isPending}>Save changes</Button>
          </div>
        )}
      </form>
    </Card>
  );
}

function PaymentCard() {
  const qc = useQueryClient();
  const config = useQuery({ queryKey: qk.paymentConfig, queryFn: () => api<PaymentConfiguration>("/restaurant/payments/configuration") });
  const [open, setOpen] = React.useState(false);
  const c = config.data;
  const webhook = c ? `${typeof window !== "undefined" ? window.location.origin : ""}${c.webhookUrl}` : "";
  return (
    <Card>
      <CardHeader title="Payment integration" description="Guests pay directly into your own Razorpay account."
        action={c && (c.status === "ACTIVE" ? <Badge tone="success" dot>Connected</Badge> : <Badge tone="warning" dot>Not connected</Badge>)} />
      {!c ? <div className="p-4"><Skeleton className="h-28" /></div> : (
        <>
          <dl className="divide-y divide-border text-[13px]">
            <Row label="Provider" value="Razorpay (simulated)" />
            <Row label="Mode" value={c.mode === "LIVE" ? <Badge tone="success">Live</Badge> : <Badge tone="warning">Test</Badge>} />
            <Row label="Key ID" value={c.keyId ? <code className="text-xs">{c.keyId}</code> : "—"} />
            <Row label="Key secret" value={c.keySecretSet ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" /> Stored securely</span> : "Not set"} />
            <Row label="Connected" value={c.connectedAt ? dateTime(c.connectedAt) : "—"} />
          </dl>
          <div className="border-t border-border p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted"><Link2 className="size-3.5" /> Webhook URL</p>
            <div className="mt-1.5 flex items-center gap-1 rounded-md border border-border bg-subtle px-2 py-1">
              <code className="min-w-0 flex-1 truncate text-[11px]">{webhook}</code>
              <Button size="icon" variant="ghost" className="size-7" aria-label="Copy webhook URL"
                onClick={() => navigator.clipboard.writeText(webhook).then(() => toast.success("Webhook URL copied"))}><Copy /></Button>
            </div>
            <Button className="mt-3 w-full" onClick={() => setOpen(true)}><KeyRound /> {c.status === "ACTIVE" ? "Update credentials" : "Connect account"}</Button>
          </div>
        </>
      )}
      <CredentialsDialog open={open} onClose={() => setOpen(false)} current={c}
        onSaved={(n) => { qc.setQueryData(qk.paymentConfig, n); setOpen(false); }} />
    </Card>
  );
}

function CredentialsDialog({ open, onClose, current, onSaved }: { open: boolean; onClose: () => void; current?: PaymentConfiguration; onSaved: (c: PaymentConfiguration) => void }) {
  const [mode, setMode] = React.useState<"TEST" | "LIVE">("TEST");
  const [keyId, setKeyId] = React.useState("");
  const [keySecret, setKeySecret] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) { setMode(current?.mode ?? "TEST"); setKeyId(current?.keyId ?? ""); setKeySecret(""); setWebhookSecret(""); setError(null); }
  }, [open, current]);
  const save = useMutation({
    mutationFn: () => api<PaymentConfiguration>("/restaurant/payments/configuration", { method: "PUT", body: { mode, keyId, keySecret, webhookSecret } }),
    onSuccess: (c) => { toast.success("Payment account connected"); onSaved(c); },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Razorpay credentials" description="Find these in your Razorpay dashboard under Settings → API keys. Secrets are never shown again.">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <DialogBody>
            <Field label="Mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value as "TEST" | "LIVE")}><option value="TEST">Test</option><option value="LIVE">Live</option></Select>
            </Field>
            <Field label="Key ID" hint={`Starts with rzp_${mode.toLowerCase()}_`}><Input value={keyId} onChange={(e) => setKeyId(e.target.value)} required className="font-mono" /></Field>
            <Field label="Key secret" hint={current?.keySecretSet ? "Leave blank to keep the current secret" : undefined}>
              <Input type="password" value={keySecret} onChange={(e) => setKeySecret(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Webhook secret" hint={current?.webhookSecretSet ? "Leave blank to keep the current secret" : undefined}>
              <Input type="password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} autoComplete="off" />
            </Field>
            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={save.isPending}>Verify & save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
