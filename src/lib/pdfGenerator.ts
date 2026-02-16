// JobHub/src/lib/pdfGenerator.ts

import * as Print from "expo-print";
import * as FileSystem from "expo-file-system";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export async function generateOrderPdf(args: {
  jobId: string;
  phase: string;
  supplierName: string;
  items: { name: string; code?: string; qty: number }[];
}) {
  const orderId = uuidv4(); // real UUID (required for Postgres uuid column)

  const rows = args.items
    .map(
      (i) => `
      <tr>
        <td>${i.name}</td>
        <td>${i.code ?? ""}</td>
        <td style="text-align:right;">${i.qty}</td>
      </tr>
    `
    )
    .join("");

  const html = `
  <html>
    <body style="font-family: Arial; padding: 24px;">
      <h1>Material Order</h1>
      <p><strong>Job:</strong> ${args.jobId}</p>
      <p><strong>Phase:</strong> ${args.phase}</p>
      <p><strong>Supplier:</strong> ${args.supplierName}</p>
      <hr />
      <table width="100%" border="1" cellspacing="0" cellpadding="6">
        <thead>
          <tr>
            <th align="left">Item</th>
            <th align="left">Code</th>
            <th align="right">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>
  `;

  const { uri } = await Print.printToFileAsync({
    html,
  });

  return {
    orderId,
    uri,
  };
}