import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Sale, Expense } from '../db/db';

interface ReportData {
    startDate: Date;
    endDate: Date;
    sales: Sale[];
    expenses: Expense[];
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
}

export class ReportService {

    private static formatDate(date: Date): string {
        return new Date(date).toLocaleDateString('es-HN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    private static formatCurrency(amount: number): string {
        return `L ${amount.toFixed(2)}`;
    }

    static async generateBalancePDF(data: ReportData) {
        const doc = new jsPDF();
        const { startDate, endDate, sales, expenses, totalSales, totalExpenses, netProfit } = data;
        const pageWidth = doc.internal.pageSize.width;

        // --- HEADER ---
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Reporte de Balance', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('POS Offline - Sneaker Store', pageWidth / 2, 28, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generado el: ${this.formatDate(new Date())}`, pageWidth / 2, 34, { align: 'center' });
        doc.text(`Período: ${this.formatDate(startDate)} - ${this.formatDate(endDate)}`, pageWidth / 2, 39, { align: 'center' });
        doc.setTextColor(0);

        // --- FINANCIAL SUMMARY ---
        let yPos = 50;

        doc.setDrawColor(200);
        doc.setFillColor(245, 247, 250);
        doc.roundedRect(14, yPos, pageWidth - 28, 30, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text('VENTAS TOTALES', 30, yPos + 10);
        doc.text('GASTOS OPERATIVOS', pageWidth / 2, yPos + 10, { align: 'center' });
        doc.text('UTILIDAD NETA', pageWidth - 30, yPos + 10, { align: 'right' });

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);

        // Sales
        doc.setTextColor(22, 163, 74); // Green
        doc.text(this.formatCurrency(totalSales), 30, yPos + 22);

        // Expenses
        doc.setTextColor(220, 38, 38); // Red
        doc.text(this.formatCurrency(totalExpenses), pageWidth / 2, yPos + 22, { align: 'center' });

        // Profit
        doc.setTextColor(79, 70, 229); // Indigo
        doc.text(this.formatCurrency(netProfit), pageWidth - 30, yPos + 22, { align: 'right' });

        doc.setTextColor(0); // Reset

        yPos += 45;

        // --- SALES TABLE ---
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Desglose de Ventas', 14, yPos);
        yPos += 5;

        const salesBody = sales.map(s => [
            new Date(s.timestamp).toLocaleDateString() + ' ' + new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            `#${s.id}`,
            s.salespersonName || 'N/A',
            s.paymentMethod?.toUpperCase() || 'CASH',
            this.formatCurrency(s.total)
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Fecha', 'ID', 'Vendedor', 'Método', 'Monto']],
            body: salesBody,
            theme: 'grid',
            headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                4: { halign: 'right', fontStyle: 'bold' }
            }
        });

        // @ts-ignore
        yPos = doc.lastAutoTable.finalY + 15;

        // --- EXPENSES TABLE ---
        if (expenses.length > 0) {
            // Check if we need new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Desglose de Gastos', 14, yPos);
            yPos += 5;

            const expensesBody = expenses.map(e => [
                new Date(e.timestamp).toLocaleDateString(),
                e.description,
                this.formatCurrency(e.amount)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Fecha', 'Descripción', 'Monto']],
                body: expensesBody,
                theme: 'grid',
                headStyles: { fillColor: [153, 27, 27], textColor: 255 }, // Red header
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: {
                    2: { halign: 'right', fontStyle: 'bold' }
                }
            });
        }

        // SAVE
        const fileName = `Balance_${this.formatDate(startDate)}_file_${Date.now()}.pdf`;
        doc.save(fileName);
    }

    static async generateBalanceExcel(data: ReportData) {
        const { startDate, endDate, sales, expenses, totalSales, totalExpenses, netProfit } = data;
        const webbook = XLSX.utils.book_new();

        // --- SHEET 1: SUMMARY ---
        const summaryData = [
            ['REPORTE DE BALANCE POS OFFLINE'],
            ['Generado:', new Date().toLocaleString()],
            ['Período:', `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`],
            [],
            ['RESUMEN FINANCIERO'],
            ['Ventas Totales', totalSales],
            ['Gastos Operativos', totalExpenses],
            ['Utilidad Neta', netProfit]
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(webbook, summarySheet, 'Resumen');

        // --- SHEET 2: SALES ---
        const salesData = sales.map(s => ({
            ID: s.id,
            Fecha: new Date(s.timestamp).toLocaleDateString(),
            Hora: new Date(s.timestamp).toLocaleTimeString(),
            Vendedor: s.salespersonName,
            Metodo: s.paymentMethod,
            Envio: s.shippingCost || 0,
            Total: s.total,
            Items: s.items.length
        }));
        const salesSheet = XLSX.utils.json_to_sheet(salesData);
        XLSX.utils.book_append_sheet(webbook, salesSheet, 'Ventas');

        // --- SHEET 3: EXPENSES ---
        const expensesData = expenses.map(e => ({
            ID: e.id,
            Fecha: new Date(e.timestamp).toLocaleDateString(),
            Descripcion: e.description,
            Monto: e.amount
        }));
        const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
        XLSX.utils.book_append_sheet(webbook, expensesSheet, 'Gastos');

        // SAVE
        const fileName = `Balance_${this.formatDate(startDate)}.xlsx`;
        XLSX.writeFile(webbook, fileName);
    }
}
