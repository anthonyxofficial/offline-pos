import * as XLSX from 'xlsx';
import type { Sale, Expense } from '../db/db';
import { formatTime, formatDate } from '../utils/dateUtils';

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

    static async generateBalancePDF(data: ReportData) {
        // Instead of generating PDF manually, we open the "Print View"
        // Store data in localStorage to pass it to the new window
        try {
            localStorage.setItem('print_report_data', JSON.stringify(data));
            // Open in new tab
            const url = window.location.origin + '/print-report';
            window.open(url, '_blank');
        } catch (e) {
            console.error("Error opening print view", e);
            alert("Error al generar el reporte. Intente con menos datos.");
        }
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
