/**
 * Transactional email templates. Inline CSS only — most email clients still
 * strip <style> tags. Keep them simple and dark-text-on-light so they render
 * reasonably in dark-mode clients without media-query support.
 */

type Rendered = { subject: string; html: string; text: string };

function wrap(content: string, preview: string): string {
  // The preview text after the closing </span> is shown in inbox lists.
  return `<!doctype html><html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#0f172a;">
  <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${preview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <tr><td style="padding:32px 32px 8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px;">
            <span style="display:inline-block;width:32px;height:32px;background:#16a34a;color:#ffffff;border-radius:8px;text-align:center;line-height:32px;font-weight:900;">S</span>
            <span style="font-weight:700;font-size:18px;color:#0f172a;">Japora</span>
          </div>
        </td></tr>
        <tr><td style="padding:0 32px 32px;color:#0f172a;font-size:15px;line-height:1.55;">
          ${content}
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">Japora — Sell on WhatsApp. Get paid. Grow your hustle.</p>
    </td></tr>
  </table>
</body></html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#16a34a;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:8px;">${label}</a>`;
}

export function welcomeEmail(opts: { shopName: string; catalogUrl: string }): Rendered {
  const subject = `Your shop is live — ${opts.shopName}`;
  const html = wrap(
    `<h1 style="font-size:22px;margin:0 0 12px;">Your shop is live.</h1>
     <p>Your catalog is ready to share. Drop the link in your WhatsApp status, bio, or a group.</p>
     <p style="background:#f1f5f9;padding:12px;border-radius:8px;word-break:break-all;"><a href="${opts.catalogUrl}" style="color:#15803d;">${opts.catalogUrl}</a></p>
     <p>${btn(opts.catalogUrl, "Open your catalog")}</p>
     <p style="color:#64748b;font-size:13px;">Add a product or two next — your catalog needs stock to sell.</p>`,
    `${opts.shopName} is live on Japora`,
  );
  const text = `Your shop is live, ${opts.shopName}.\n\nCatalog link: ${opts.catalogUrl}\n\nAdd a product or two next.`;
  return { subject, html, text };
}

export function verifyEmailTemplate(opts: { verifyUrl: string }): Rendered {
  const subject = `Confirm your email`;
  const html = wrap(
    `<h1 style="font-size:22px;margin:0 0 12px;">Confirm your email</h1>
     <p>One click and we're set. We need this so we can reach you about orders.</p>
     <p>${btn(opts.verifyUrl, "Confirm")}</p>
     <p style="color:#64748b;font-size:13px;">Button not working? Paste this into your browser:<br><a href="${opts.verifyUrl}" style="color:#15803d;word-break:break-all;">${opts.verifyUrl}</a></p>
     <p style="color:#94a3b8;font-size:12px;">The link expires in 24 hours.</p>`,
    `Confirm your Japora email`,
  );
  const text = `Confirm your email: ${opts.verifyUrl}\n\nThe link expires in 24 hours.`;
  return { subject, html, text };
}

export function passwordResetEmail(opts: { resetUrl: string; shopName: string }): Rendered {
  const subject = `Reset your password`;
  const html = wrap(
    `<h1 style="font-size:22px;margin:0 0 12px;">Reset your password</h1>
     <p>Someone (we hope it was you) asked to reset the password for ${opts.shopName}.</p>
     <p>${btn(opts.resetUrl, "Set a new one")}</p>
     <p style="color:#64748b;font-size:13px;">If it wasn't you, ignore this email. Your password stays as is.</p>
     <p style="color:#94a3b8;font-size:12px;">The link expires in 1 hour.</p>`,
    `Reset your Japora password`,
  );
  const text = `Reset your password: ${opts.resetUrl}\n\nIf it wasn't you, ignore this. The link expires in 1 hour.`;
  return { subject, html, text };
}

export function newOrderEmail(opts: {
  shopName: string;
  customerName: string;
  total: string;
  itemCount: number;
  ordersUrl: string;
}): Rendered {
  const subject = `New order — ${opts.total} from ${opts.customerName}`;
  const html = wrap(
    `<h1 style="font-size:22px;margin:0 0 12px;">New order. ${opts.total}.</h1>
     <p><strong>${opts.customerName}</strong> just ordered from ${opts.shopName}.</p>
     <p style="background:#f1f5f9;padding:12px;border-radius:8px;">
       <strong>Total:</strong> ${opts.total}<br>
       <strong>Items:</strong> ${opts.itemCount}
     </p>
     <p>${btn(opts.ordersUrl, "Open the board")}</p>`,
    `${opts.customerName} ordered ${opts.total}`,
  );
  const text = `New order. ${opts.total} from ${opts.customerName} (${opts.itemCount} item${opts.itemCount === 1 ? "" : "s"}).\n\nBoard: ${opts.ordersUrl}`;
  return { subject, html, text };
}

export function buyerOrderConfirmationEmail(opts: {
  orderId: string;
  shopName: string;
  customerName: string;
  items: { name: string; quantity: number; unitPrice: string; size?: string }[];
  total: string;
  payUrl: string;
  vendorWhatsApp?: string;
}): Rendered {
  const subject = `Confirmation de commande — ${opts.shopName} (${opts.total})`;
  const itemsHtml = opts.items
    .map(
      (it) =>
        `<tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #e2e8f0;">${it.name}${it.size ? ` (${it.size})` : ""} × ${it.quantity}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${it.unitPrice}</td>
        </tr>`,
    )
    .join("");

  const itemsText = opts.items
    .map((it) => `- ${it.name}${it.size ? ` (${it.size})` : ""} x ${it.quantity}: ${it.unitPrice}`)
    .join("\n");

  const html = wrap(
    `<h1 style="font-size:22px;margin:0 0 12px;">Merci pour votre commande, ${opts.customerName} !</h1>
     <p>Votre commande a été transmise à la boutique <strong>${opts.shopName}</strong>.</p>
     <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
       ${itemsHtml}
       <tr>
         <td style="padding: 10px 0; font-weight: 700;">Total :</td>
         <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #16a34a;">${opts.total}</td>
       </tr>
     </table>
     <p style="margin: 20px 0;">${btn(opts.payUrl, "Procéder au paiement")}</p>
     ${
       opts.vendorWhatsApp
         ? `<p style="color:#64748b;font-size:13px;">Une question ? Contactez le vendeur directement sur WhatsApp : <a href="https://wa.me/${opts.vendorWhatsApp}" style="color:#16a34a;font-weight:600;">Ouvrir la discussion</a></p>`
         : ""
     }`,
    `Confirmation de commande ${opts.shopName}`,
  );

  const text = `Merci pour votre commande, ${opts.customerName} !\n\nBoutique : ${opts.shopName}\n\nArticles :\n${itemsText}\nTotal : ${opts.total}\n\nLien de paiement : ${opts.payUrl}\n`;
  return { subject, html, text };
}

