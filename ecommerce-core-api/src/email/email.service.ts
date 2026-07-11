import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

interface OtpEmailInput {
  to: string;
  fullName: string;
  otpCode: string;
  expiresInMinutes: number;
  storeName: string;
}

interface BackInStockEmailInput {
  to: string;
  productTitle: string;
  productUrl: string;
}

interface StaffInviteEmailInput {
  to: string;
  fullName: string;
  storeName: string;
  inviteUrl: string;
  expiresAt: Date;
}

interface AbandonedCartRecoveryEmailInput {
  to: string;
  storeName: string;
  recoveryUrl: string;
  openTrackingUrl: string;
  cartTotal: number;
  currencyCode: string;
  itemsCount: number;
  expiresAt: Date;
  items: Array<{
    title: string;
    sku: string | null;
    quantity: number;
    unitPrice: number;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private smtpTransporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendOtpEmail(input: OtpEmailInput): Promise<void> {
    const mode = this.configService.get<string>('EMAIL_DELIVERY_MODE', 'log');
    const from = this.configService.get<string>('EMAIL_FROM', 'no-reply@ecommerce_core.store');
    const subject = 'رمز التحقق لتفعيل حسابك في النظام ستور';
    const text = [
      `مرحباً ${input.fullName},`,
      '',
      `رمز التحقق الخاص بك لمتجر "${input.storeName}" هو: ${input.otpCode}`,
      `صلاحية الرمز: ${input.expiresInMinutes} دقيقة.`,
      '',
      'إذا لم تطلب إنشاء حساب، تجاهل هذه الرسالة.',
    ].join('\n');

    if (mode === 'smtp') {
      await this.sendWithSmtp({
        to: input.to,
        from,
        subject,
        text,
      });
      return;
    }

    if (mode === 'resend') {
      await this.sendWithResend({
        to: input.to,
        from,
        subject,
        text,
      });
      return;
    }

    this.logger.log(
      `OTP email (mode=log) to ${input.to}. Code: ${input.otpCode}. Expires in ${input.expiresInMinutes} minutes.`,
    );
  }

  async sendBackInStockAlert(input: BackInStockEmailInput): Promise<void> {
    const mode = this.configService.get<string>('EMAIL_DELIVERY_MODE', 'log');
    const from = this.configService.get<string>('EMAIL_FROM', 'no-reply@ecommerce_core.store');
    const subject = 'Product back in stock';
    const text = [
      'A product you asked about is available again.',
      '',
      `Product: ${input.productTitle}`,
      `Open product: ${input.productUrl}`,
      '',
      'This link may expire after a limited time.',
    ].join('\n');

    if (mode === 'smtp') {
      await this.sendWithSmtp({
        to: input.to,
        from,
        subject,
        text,
      });
      return;
    }

    if (mode === 'resend') {
      await this.sendWithResend({
        to: input.to,
        from,
        subject,
        text,
      });
      return;
    }

    this.logger.log(
      `Back-in-stock email (mode=log) to ${input.to}. Product: ${input.productTitle}. Link: ${input.productUrl}`,
    );
  }

  async sendStaffInvite(input: StaffInviteEmailInput): Promise<void> {
    const mode = this.configService.get<string>('EMAIL_DELIVERY_MODE', 'log');
    const from = this.configService.get<string>('EMAIL_FROM', 'no-reply@ecommerce_core.store');
    const subject = `Invitation to join ${input.storeName}`;
    const text = [
      `Hello ${input.fullName},`,
      '',
      `You have been invited to join ${input.storeName} on Ecommerce Core Store.`,
      `Accept the invitation: ${input.inviteUrl}`,
      `This invitation expires at: ${input.expiresAt.toISOString()}`,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
        <p>Hello ${this.escapeHtml(input.fullName)},</p>
        <p>You have been invited to join <strong>${this.escapeHtml(input.storeName)}</strong> on Ecommerce Core Store.</p>
        <p><a href="${this.escapeHtml(input.inviteUrl)}">Accept invitation</a></p>
        <p style="font-size:12px;color:#666;">This invitation expires at: ${this.escapeHtml(input.expiresAt.toISOString())}</p>
        <p style="font-size:12px;color:#666;">If you were not expecting this invitation, you can ignore this email.</p>
      </div>
    `.trim();

    if (mode === 'smtp') {
      await this.sendWithSmtp({
        to: input.to,
        from,
        subject,
        text,
        html,
      });
      return;
    }

    if (mode === 'resend') {
      throw new Error('Staff invite emails require EMAIL_DELIVERY_MODE=smtp, not resend');
    }

    this.logger.log(`Staff invite email (mode=log) to ${input.to}. Invite URL: ${input.inviteUrl}`);
  }

  async sendAbandonedCartRecovery(input: AbandonedCartRecoveryEmailInput): Promise<void> {
    const mode = this.configService.get<string>('EMAIL_DELIVERY_MODE', 'log');
    const from = this.configService.get<string>('EMAIL_FROM', 'no-reply@ecommerce_core.store');
    const subject = `لا يزال هناك منتجات بانتظارك في ${input.storeName}`;
    const text = [
      'مرحباً،',
      '',
      `لقد لاحظنا أنك لم تكمل طلبك في ${input.storeName}.`,
      `عدد المنتجات في السلة: ${input.itemsCount}`,
      `إجمالي السلة: ${input.cartTotal.toFixed(2)} ${input.currencyCode}`,
      `استعد سلتك الآن: ${input.recoveryUrl}`,
      `صالح حتى: ${input.expiresAt.toISOString()}`,
      '',
      'إذا قمت بإتمام الشراء بالفعل، تجاهل هذه الرسالة.',
    ].join('\n');

    const itemsHtml =
      input.items.length > 0
        ? `<ul>${input.items
            .map(
              (item) =>
                `<li>${this.escapeHtml(item.title)} x ${item.quantity} - ${item.unitPrice.toFixed(2)} ${this.escapeHtml(input.currencyCode)}${item.sku ? ` (${this.escapeHtml(item.sku)})` : ''}</li>`,
            )
            .join('')}</ul>`
        : '';

    const html = `
      <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; color: #111;">
        <p>مرحباً،</p>
        <p>لا تزال هناك منتجات بانتظارك في <strong>${this.escapeHtml(input.storeName)}</strong>.</p>
        <p>عدد المنتجات: <strong>${input.itemsCount}</strong></p>
        <p>إجمالي السلة: <strong>${input.cartTotal.toFixed(2)} ${this.escapeHtml(input.currencyCode)}</strong></p>
        ${itemsHtml}
        <p><a href="${this.escapeHtml(input.recoveryUrl)}">العودة إلى السلة وإكمال الطلب</a></p>
        <p style="font-size:12px;color:#666;">ينتهي الرابط في: ${this.escapeHtml(input.expiresAt.toISOString())}</p>
        <img src="${this.escapeHtml(input.openTrackingUrl)}" alt="" width="1" height="1" style="display:block;border:0;" />
      </div>
    `.trim();

    if (mode === 'smtp') {
      await this.sendWithSmtp({
        to: input.to,
        from,
        subject,
        text,
        html,
      });
      return;
    }

    if (mode === 'resend') {
      await this.sendWithResend({
        to: input.to,
        from,
        subject,
        text,
        html,
      });
      return;
    }

    this.logger.log(
      `Abandoned-cart recovery email (mode=log) to ${input.to}. Recovery URL: ${input.recoveryUrl}. Open pixel: ${input.openTrackingUrl}`,
    );
  }

  private async sendWithResend(input: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    const baseUrl = this.configService.get<string>('RESEND_API_BASE_URL', 'https://api.resend.com');

    if (!apiKey) {
      throw new Error('المتغير RESEND_API_KEY مطلوب عند ضبط EMAIL_DELIVERY_MODE=resend');
    }

    const response = await fetch(`${baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new Error(`فشل إرسال البريد عبر Resend (${response.status}): ${raw}`);
    }
  }

  private async sendWithSmtp(input: {
    to: string;
    from: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const transporter = this.getSmtpTransporter();

    await transporter.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
  }

  private getSmtpTransporter(): Transporter {
    if (this.smtpTransporter) {
      return this.smtpTransporter;
    }

    const host = this.configService.get<string>('SMTP_HOST', '');
    const port = this.configService.get<number>('SMTP_PORT', 465);
    const secure = this.configService.get<boolean>('SMTP_SECURE', true);
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');

    if (!host || !user || !pass) {
      throw new Error('إعدادات SMTP غير مكتملة. تأكد من SMTP_HOST وSMTP_USER وSMTP_PASS');
    }

    this.smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return this.smtpTransporter;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
