"use client";

import { useState, type FormEvent } from "react";
import { PAYMENTS } from "@/lib/payments";

export default function PaidScanRequest({ website }: { website: string }) {
  const [notice, setNotice] = useState("");

  function requestReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const website = String(form.get("website")).trim();
    try {
      const url = new URL(website);
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    } catch {
      setNotice("Enter a full website address starting with https:// or http://.");
      return;
    }
    const whatsapp = String(form.get("whatsapp")).trim();
    if (!/^\+[1-9][\d\s()-]{6,23}$/.test(whatsapp) || whatsapp.replace(/\D/g, "").length > 15 || whatsapp.replace(/\D/g, "").length < 7) {
      setNotice("Enter your WhatsApp number with country code, for example +92 300 1234567.");
      return;
    }
    const body = [
      "Hello, I would like a $10 USD AEO and GEO scan.",
      "",
      `Name: ${String(form.get("name")).trim()}`,
      `Email: ${String(form.get("email")).trim()}`,
      `Website: ${website}`,
      `WhatsApp: ${whatsapp}`,
      `Wise recipient: ${PAYMENTS.wiseTag}`,
      `Transfer reference: ${String(form.get("reference")).trim()}`,
      "",
      "Please verify my payment and send my report to the WhatsApp number above.",
      "I consent to being contacted on WhatsApp about this report.",
    ].join("\n");
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value === "whatsapp") {
      window.open(`${PAYMENTS.whatsappUrl}?text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
      setNotice(`Continue in WhatsApp to send your request to ${PAYMENTS.whatsappNumber}. Attach your Wise receipt or payment screenshot and press Send. Payment is verified before your report is delivered.`);
    } else {
      window.location.href = `mailto:${PAYMENTS.email}?subject=${encodeURIComponent("Paid AEO / GEO scan request")}&body=${encodeURIComponent(body)}`;
      setNotice(`Your email draft is ready in your email app. Attach your Wise receipt and press Send to submit your request to ${PAYMENTS.email}. Payment is verified before your report is delivered.`);
    }
  }

  const inputClass = "mt-2 w-full rounded-lg border border-rule-strong bg-paper px-4 py-3 text-sm text-ink focus:border-ink focus:outline-none";

  return (
    <section id="paid-scan" className="mt-12 rounded-xl border border-rule-strong bg-paper-raised p-6 sm:p-8" aria-labelledby="paid-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-ink-soft">AEO + GEO REPORT · WHATSAPP DELIVERY</p>
          <h2 id="paid-title" className="mt-3 text-2xl font-semibold text-ink">Your next scan, with a personal report.</h2>
        </div>
        <p className="text-4xl font-semibold text-ink">$10 <span className="text-sm font-normal text-ink-soft">USD / scan</span></p>
      </div>
      <ol className="mt-6 grid gap-4 text-sm leading-relaxed text-ink-soft sm:grid-cols-3">
        <li><strong className="block text-ink">1. Pay with Wise</strong>Send $10 USD to {PAYMENTS.wiseTag}. Confirm the recipient and amount in Wise before paying.</li>
        <li><strong className="block text-ink">2. Send your request</strong>Email or WhatsApp us your website, WhatsApp number, transfer reference, and payment proof.</li>
        <li><strong className="block text-ink">3. Receive your report</strong>We verify payment, scan your page, and send the report directly to your WhatsApp.</li>
      </ol>
      <a href={PAYMENTS.wiseUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block rounded-lg bg-mark px-6 py-3 text-sm font-medium text-ink">Pay $10 USD with Wise ↗</a>
      <p className="mt-3 text-xs text-ink-soft">Opening Wise does not confirm payment. Each verified $10 USD payment covers one page scan.</p>
      <form onSubmit={requestReport} className="mt-8 grid gap-5 sm:grid-cols-2">
        <label className="text-sm text-ink">Your name<input className={inputClass} name="name" autoComplete="name" required maxLength={100} /></label>
        <label className="text-sm text-ink">Your email<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label className="text-sm text-ink">Website to scan<input key={website} className={inputClass} name="website" type="url" defaultValue={website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : ""} placeholder="https://example.com" required maxLength={2048} /></label>
        <label className="text-sm text-ink">WhatsApp number<input className={inputClass} name="whatsapp" type="tel" autoComplete="tel" placeholder="+92 300 1234567" required maxLength={25} /></label>
        <label className="text-sm text-ink sm:col-span-2">Wise transfer reference<input className={inputClass} name="reference" placeholder="Reference from your Wise payment receipt" required maxLength={150} /></label>
        <label className="flex items-start gap-3 text-sm text-ink-soft sm:col-span-2"><input className="mt-1" type="checkbox" required />I have paid $10 USD and agree to receive this report on WhatsApp after payment verification.</label>
        <button type="submit" name="channel" value="email" className="rounded-lg bg-ink px-6 py-3 text-sm font-medium text-paper">Prepare email request</button>
        <button type="submit" name="channel" value="whatsapp" className="rounded-lg border border-rule-strong px-6 py-3 text-sm font-medium text-ink">Prepare WhatsApp request ↗</button>
      </form>
      <p className="mt-4 text-xs leading-relaxed text-ink-soft">Choose email or WhatsApp to prepare your request, then attach your payment proof and press Send in that app.</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">You can also send your request or payment proof directly to <a className="underline" href={`mailto:${PAYMENTS.email}`}>{PAYMENTS.email}</a> or WhatsApp <a className="font-medium text-ink underline" href={`${PAYMENTS.whatsappUrl}?text=${encodeURIComponent(`Hello, I would like to request a $10 USD AEO and GEO scan${website ? ` for ${website}` : ""}. I will send my payment proof here.`)}`} target="_blank" rel="noopener noreferrer">{PAYMENTS.whatsappNumber} ↗</a>.</p>
      {notice && <p role="status" className="mt-5 rounded-lg border border-rule-strong p-4 text-sm text-ink">{notice}</p>}
    </section>
  );
}
