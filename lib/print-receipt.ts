type PrintReceiptOptions = {
    orderNumber: string | number;
    createdAt: string;
    userName: string;
    shippingAddress: string;
    currencySymbol?: string;
    items: {
      name: string;
      quantity: number;
      price: number;
    }[];
    subtotal: number;
    shippingCost: number;
    totalAmount: number;
    siteName?: string;
    logoUrl?: string;
    siteDescription?: string;
  };

export function printReceipt({
    orderNumber,
    createdAt,
    userName,
    shippingAddress,
    currencySymbol = "$",
    items,
    subtotal,
    shippingCost,
    totalAmount,
    siteName = "LUXSTORE",
    logoUrl,
    siteDescription = "Premium Fashion & Accessories",
  }: PrintReceiptOptions) {
    let iframe = document.getElementById("receipt-print-iframe") as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "receipt-print-iframe";
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
    }

    const receiptContent = `
    <html>
      <head>
        <title>Order Receipt - ${siteName}</title>
        <style>
          @page {
            size: A4;
            margin: 0.15in;
          }

          :root {
            --primary: #2c3e50;
            --accent: #e74c3c;
            --text: #333;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            padding: 0.15in;
            color: var(--text);
            background: white;
            font-size: 9px;
            line-height: 1.3;
            max-width: 5.5in; /* Keep receipt narrow on A4 paper */
            margin: 0; /* Left aligned */
          }

          .header {
            text-align: center;
            margin-bottom: 0.15in;
            padding-bottom: 0.1in;
            border-bottom: 2px solid var(--primary);
          }

          .header h1 {
            font-size: 16px;
            color: var(--primary);
            letter-spacing: 1px;
            text-transform: uppercase;
            font-weight: 800;
          }

          .header img {
            max-height: 24px;
            object-fit: contain;
          }

          .header p {
            font-size: 7px;
            opacity: 0.7;
          }

          .order-meta {
            display: flex;
            flex-wrap: wrap;
            margin: 0.12in 0;
            padding: 0.1in;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 8px;
          }

          .order-meta > div {
            width: 50%;
            margin-bottom: 0.06in;
          }

          .order-meta p {
            margin: 0;
            line-height: 1.4;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.12in 0;
            font-size: 8px;
            table-layout: fixed;
          }

          th {
            background: var(--primary);
            color: white;
            padding: 0.06in 0.08in;
            font-weight: 600;
            text-align: left;
            font-size: 8px;
          }
          
          th:nth-child(1), td:nth-child(1) { width: 45%; }
          th:nth-child(2), td:nth-child(2) { width: 15%; }
          th:nth-child(3), td:nth-child(3) { width: 20%; }
          th:nth-child(4), td:nth-child(4) { width: 20%; text-align: right; }

          td {
            padding: 0.05in 0.08in;
            border-bottom: 1px solid #eee;
            word-wrap: break-word;
          }

          tr:last-child td {
            border-bottom: none;
          }

          .totals {
            margin-top: 0.12in;
            margin-left: auto;
            width: 2.5in;
            padding: 0.1in;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 8px;
          }

          .totals div {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.04in;
          }

          .totals div:last-child {
            margin-bottom: 0;
          }

          .total-amount {
            color: var(--accent);
            font-weight: 800;
            font-size: 10px;
          }

          .thank-you {
            text-align: center;
            margin-top: 0.15in;
            color: var(--primary);
            font-weight: 500;
            font-size: 8px;
            opacity: 0.8;
          }

          @media print {
            body {
              padding: 0.15in;
              background: white;
            }
            .order-meta, .totals {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoUrl ? `<img src="${logoUrl}" alt="${siteName}" />` : `<h1>${siteName}</h1>`}
          ${siteDescription ? `<p>${siteDescription}</p>` : ""}
        </div>

        <div class="order-meta">
          <div>
            <p><strong>Order #</strong></p>
            <p>${orderNumber}</p>
          </div>
          <div>
            <p><strong>Date</strong></p>
            <p>${createdAt}</p>
          </div>
          <div>
            <p><strong>Customer</strong></p>
            <p>${userName}</p>
          </div>
          <div>
            <p><strong>Shipping to</strong></p>
            <p>${shippingAddress}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${currencySymbol}${item.price.toFixed(2)}</td>
                <td>${currencySymbol}${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div>
            <span>Subtotal:</span>
            <span>${currencySymbol}${subtotal.toFixed(2)}</span>
          </div>
          <div>
            <span>Shipping:</span>
            <span>${currencySymbol}${shippingCost.toFixed(2)}</span>
          </div>
          <div>
            <span>Total:</span>
            <span class="total-amount">${currencySymbol}${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        <div class="thank-you">
          Thank you for shopping with ${siteName}!<br>
          We value your business ❤️
        </div>
      </body>
    </html>
  `;

    const iframeWindow = iframe.contentWindow || iframe.contentDocument?.defaultView;
    if (iframeWindow) {
      const doc = iframeWindow.document;
      doc.open();
      doc.write(receiptContent);
      doc.close();
      
      setTimeout(() => {
        iframeWindow.focus();
        iframeWindow.print();
      }, 500);
    } else {
      console.error("Unable to access print iframe.");
    }
  }
