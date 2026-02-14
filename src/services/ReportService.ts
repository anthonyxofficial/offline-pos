import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Sale, Expense } from '../db/db';
import { formatTime, formatDate, formatDateTime } from '../utils/dateUtils';
import logo from '../assets/logo.png';

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
        return formatDate(new Date(date));
    }

    private static formatCurrency(amount: number): string {
        return `L ${amount.toFixed(2)}`;
    }

    private static async loadImage(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject("Canvas context error");
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = reject;
        });
    }

    static async generateBalancePDF(data: ReportData) {
        const doc = new jsPDF();
        const { startDate, endDate, sales, expenses, totalSales, totalExpenses, netProfit } = data;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // --- LOAD ASSETS ---
        let logoData = null;
        try {
            // Attempt to load logo from public assets or import
            // Assuming logo is available at /logo.png or similar. 
            // In Vite, we might need to pass the imported string.
            // For now, let's try a standard path or base64 placeholder if needed.
            // If the user has a logo file, we should use it. 
            logoData = await this.loadImage(logo).catch(() => null);
        } catch (e) {
            console.warn("Could not load logo for PDF", e);
        }

        // --- HEADER ---
        // Brand Color: #8b5cf6 (Violet-500) -> [139, 92, 246]
        // Background Header
        doc.setFillColor(15, 23, 42); // Slate-900
        doc.rect(0, 0, pageWidth, 40, 'F');

        // Logo
        if (logoData) {
            doc.addImage(logoData, 'PNG', 14, 8, 24, 24);
        }

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.text('REPORTE FINANCIERO', logoData ? 45 : 14, 20);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // Slate-400
        doc.text('POS Offline | Sneaker Store', logoData ? 45 : 14, 26);
        doc.text(`Generado: ${formatDateTime(new Date())}`, logoData ? 45 : 14, 32);

        // Date Range Badge
        doc.setFillColor(139, 92, 246); // Violet-500
        doc.roundedRect(pageWidth - 75, 12, 61, 16, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('courier', 'bold');
        doc.text(`${this.formatDate(startDate)}`, pageWidth - 45, 18, { align: 'center' });
        doc.text('AL', pageWidth - 45, 22, { align: 'center' });
        doc.text(`${this.formatDate(endDate)}`, pageWidth - 45, 26, { align: 'center' });


        // --- EXECUTIVE SUMMARY (CARDS) ---
        let yPos = 55;
        const cardWidth = (pageWidth - 28 - 10) / 3; // 3 Cards with gap
        const cardHeight = 25;

        // Function to draw card
        const drawCard = (x: number, title: string, value: string, color: [number, number, number]) => {
            // Bg
            doc.setDrawColor(226, 232, 240); // Slate-200
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, 'FD');

            // Border Left
            doc.setFillColor(...color);
            doc.rect(x, yPos, 2, cardHeight, 'F');

            // Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // Slate-500
            doc.text(title.toUpperCase(), x + 6, yPos + 8);

            // Value
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.setTextColor(15, 23, 42); // Slate-900
            doc.text(value, x + 6, yPos + 18);
        };

        drawCard(14, 'Ventas Totales', this.formatCurrency(totalSales), [34, 197, 94]); // Green
        drawCard(14 + cardWidth + 5, 'Gastos Operativos', this.formatCurrency(totalExpenses), [239, 68, 68]); // Red
        drawCard(14 + (cardWidth + 5) * 2, 'Utilidad Neta', this.formatCurrency(netProfit), [99, 102, 241]); // Indigo

        yPos += 35;


        // --- TABLES ---

        // 1. SALES
        if (sales.length > 0) {
            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42);
            doc.text('Detalle de Ventas', 14, yPos);
            yPos += 3;

            const salesBody = sales.map(s => [
                formatDateTime(new Date(s.timestamp)),
                `#${s.id || '-'}`,
                s.salespersonName || 'N/A',
                s.paymentMethod?.toUpperCase() || 'CASH',
                this.formatCurrency(s.total)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Fecha/Hora', 'ID', 'Vendedor', 'Método', 'Monto']],
                body: salesBody,
                theme: 'striped',
                headStyles: {
                    fillColor: [30, 41, 59], // Slate-800
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 45 },
                    4: { halign: 'right', fontStyle: 'bold', textColor: [34, 197, 94] }
                },
                styles: { fontSize: 8, cellPadding: 3 },
                alternateRowStyles: { fillColor: [248, 250, 252] }
            });

            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 15;
        }

        // 2. EXPENSES
        if (expenses.length > 0) {
            // Check page break
            if (yPos > pageHeight - 50) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(12);
            doc.setTextColor(15, 23, 42); // Slate-900
            doc.text('Gastos Registrados', 14, yPos);
            yPos += 3;

            const expensesBody = expenses.map(e => [
                formatDate(new Date(e.timestamp)),
                formatTime(new Date(e.timestamp)),
                e.description,
                this.formatCurrency(e.amount)
            ]);

            autoTable(doc, {
                startY: yPos,
                head: [['Fecha', 'Hora', 'Descripción', 'Monto']],
                body: expensesBody,
                theme: 'striped',
                headStyles: {
                    fillColor: [153, 27, 27], // Red-800
                    textColor: 255,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    3: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] }
                },
                styles: { fontSize: 8, cellPadding: 3 },
                alternateRowStyles: { fillColor: [254, 242, 242] }
            });

            // @ts-ignore
            yPos = doc.lastAutoTable.finalY + 10;
        }

        // --- FOOTER ---
        const totalPages = doc.internal.pages.length - 1;
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${i} de ${totalPages} - POS Offline System`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        // SAVE
        const fileName = `Reporte_${this.formatDate(startDate)}-${this.formatDate(endDate)}.pdf`;
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
            Fecha: formatDate(new Date(s.timestamp)),
            Hora: formatTime(new Date(s.timestamp)),
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
            Fecha: formatDate(new Date(e.timestamp)),
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
