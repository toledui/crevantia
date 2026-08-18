import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface ReceiptOrderData {
  orderNumber: string;
  createdAt: Date;
  paidAt?: Date | null;
  status: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxName: string;
  taxRatePercent: number | string;
  taxCents: number;
  totalCents: number;
  customerName: string;
  customerEmail: string;
  product: {
    name: string;
    code: string;
    shortDescription?: string | null;
  };
  coupon?: {
    code: string;
    description?: string | null;
  } | null;
  transactions?: Array<{
    gateway: string;
    gatewayTransactionId?: string | null;
    status: string;
    createdAt: Date;
  }>;
}

@Injectable()
export class ReceiptService {
  async generateReceiptPdf(order: ReceiptOrderData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margin: 40,
        info: {
          Title: `Comprobante de Compra ${order.orderNumber} - Crevantia`,
          Author: 'Crevantia Psicométrica',
          Subject: `Recibo de pago orden ${order.orderNumber}`,
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#302b78'; // Indigo Crevantia
      const textColor = '#1e293b';
      const mutedColor = '#64748b';
      const lineColor = '#e2e8f0';
      const accentColor = '#00c2e8';

      // Header: Brand & Document Title
      doc.fontSize(24).fillColor(primaryColor).font('Helvetica-Bold').text('CREVANTIA', 40, 45);
      doc.fontSize(9).fillColor(mutedColor).font('Helvetica').text('Plataforma Psicométrica y Diagnóstico Profesional', 40, 75);

      // Receipt Badge / Folio
      doc.fontSize(16).fillColor(textColor).font('Helvetica-Bold').text('COMPROBANTE DE COMPRA', 320, 45, { align: 'right' });
      doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold').text(`Folio: ${order.orderNumber}`, 320, 68, { align: 'right' });

      const issueDate = new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Mexico_City',
      }).format(order.paidAt || order.createdAt);

      doc.fontSize(9).fillColor(mutedColor).font('Helvetica').text(`Fecha de emisión: ${issueDate}`, 320, 85, { align: 'right' });

      // Horizontal Divider
      doc.moveTo(40, 110).lineTo(572, 110).lineWidth(1).strokeColor(lineColor).stroke();

      // Customer Info Box & Payment Status Box
      const topInfoY = 125;

      // Left column: Cliente
      doc.fontSize(10).fillColor(mutedColor).font('Helvetica-Bold').text('DATOS DEL CLIENTE', 40, topInfoY);
      doc.fontSize(11).fillColor(textColor).font('Helvetica-Bold').text(order.customerName || 'Cliente Crevantia', 40, topInfoY + 16);
      doc.fontSize(10).fillColor(mutedColor).font('Helvetica').text(order.customerEmail, 40, topInfoY + 32);

      // Right column: Estado y Pasarela
      const tx = order.transactions?.[0];
      const isPaid = order.status === 'PAID';
      
      doc.fontSize(10).fillColor(mutedColor).font('Helvetica-Bold').text('ESTADO DEL PAGO', 360, topInfoY);
      doc.fontSize(11).fillColor(isPaid ? '#15803d' : '#b45309').font('Helvetica-Bold').text(isPaid ? '✓ PAGADO / CONFIRMADO' : 'PENDIENTE DE PAGO', 360, topInfoY + 16);
      
      if (tx) {
        doc.fontSize(9).fillColor(mutedColor).font('Helvetica').text(`Pasarela: ${tx.gateway} | Ref: ${tx.gatewayTransactionId || 'N/A'}`, 360, topInfoY + 32);
      }

      // Line items table
      const tableTopY = 200;

      // Table Header Background
      doc.rect(40, tableTopY, 532, 24).fillColor('#f8fafc').fill();
      doc.rect(40, tableTopY, 532, 24).lineWidth(1).strokeColor(lineColor).stroke();

      doc.fontSize(9).fillColor(mutedColor).font('Helvetica-Bold');
      doc.text('CONCEPTO / EVALUACIÓN', 50, tableTopY + 7);
      doc.text('CANT.', 360, tableTopY + 7, { width: 40, align: 'center' });
      doc.text('PRECIO UNIT.', 410, tableTopY + 7, { width: 70, align: 'right' });
      doc.text('IMPORTE', 490, tableTopY + 7, { width: 72, align: 'right' });

      // Table Row
      const rowY = tableTopY + 34;
      doc.fontSize(10).fillColor(textColor).font('Helvetica-Bold').text(order.product.name, 50, rowY);
      
      if (order.product.shortDescription) {
        doc.fontSize(8).fillColor(mutedColor).font('Helvetica').text(order.product.shortDescription.substring(0, 100), 50, rowY + 14, { width: 290 });
      }

      doc.fontSize(10).fillColor(textColor).font('Helvetica').text('1', 360, rowY, { width: 40, align: 'center' });
      
      const subtotalFormatted = (order.subtotalCents / 100).toFixed(2);
      doc.text(`$${subtotalFormatted}`, 410, rowY, { width: 70, align: 'right' });
      doc.text(`$${subtotalFormatted}`, 490, rowY, { width: 72, align: 'right' });

      doc.moveTo(40, rowY + 38).lineTo(572, rowY + 38).lineWidth(1).strokeColor(lineColor).stroke();

      // Summary Calculations Box
      let sumY = rowY + 52;
      const rightColLabelX = 340;
      const rightColValueX = 472;

      // Subtotal
      doc.fontSize(9).fillColor(mutedColor).font('Helvetica').text('Subtotal:', rightColLabelX, sumY, { width: 130, align: 'right' });
      doc.fontSize(9).fillColor(textColor).font('Helvetica').text(`$${subtotalFormatted} ${order.currency}`, rightColValueX, sumY, { width: 100, align: 'right' });

      // Discount
      if (order.discountCents > 0) {
        sumY += 16;
        const discountFormatted = (order.discountCents / 100).toFixed(2);
        doc.fontSize(9).fillColor('#15803d').font('Helvetica').text(`Descuento cupón (${order.coupon?.code || 'PROMO'}):`, rightColLabelX, sumY, { width: 130, align: 'right' });
        doc.fontSize(9).fillColor('#15803d').font('Helvetica-Bold').text(`-$${discountFormatted} ${order.currency}`, rightColValueX, sumY, { width: 100, align: 'right' });
      }

      // Taxes
      sumY += 16;
      const taxFormatted = (order.taxCents / 100).toFixed(2);
      doc.fontSize(9).fillColor(mutedColor).font('Helvetica').text(`${order.taxName} (${order.taxRatePercent}%):`, rightColLabelX, sumY, { width: 130, align: 'right' });
      doc.fontSize(9).fillColor(textColor).font('Helvetica').text(`$${taxFormatted} ${order.currency}`, rightColValueX, sumY, { width: 100, align: 'right' });

      // Total Box
      sumY += 20;
      doc.rect(330, sumY - 4, 242, 32).fillColor('#f1f5f9').fill();
      doc.rect(330, sumY - 4, 242, 32).lineWidth(1).strokeColor(lineColor).stroke();

      const totalFormatted = (order.totalCents / 100).toFixed(2);
      doc.fontSize(11).fillColor(primaryColor).font('Helvetica-Bold').text('TOTAL PAGADO:', 340, sumY + 6);
      doc.fontSize(13).fillColor(primaryColor).font('Helvetica-Bold').text(`$${totalFormatted} ${order.currency}`, rightColValueX, sumY + 5, { width: 100, align: 'right' });

      // Security / Digital Stamp Note
      const footerY = 640;
      doc.moveTo(40, footerY).lineTo(572, footerY).lineWidth(1).strokeColor(lineColor).stroke();

      doc.fontSize(8).fillColor(mutedColor).font('Helvetica-Bold').text('INFORMACIÓN DE SEGURIDAD Y ACCESO A LA EVALUACIÓN', 40, footerY + 12);
      doc.fontSize(8).fillColor(mutedColor).font('Helvetica').text(
        'Este comprobante digital avala la adquisición de una licencia psicométrica personal en Crevantia. Los resultados y el informe ejecutivo estarán disponibles en su panel una vez completada la prueba.',
        40,
        footerY + 24,
        { width: 532, lineGap: 2 },
      );

      doc.fontSize(7).fillColor('#94a3b8').font('Helvetica').text(
        `Crevantia · https://crevantia.com · Folio Digital ID: ${order.orderNumber} · Documento generado electrónicamente.`,
        40,
        footerY + 60,
        { align: 'center', width: 532 },
      );

      doc.end();
    });
  }
}
