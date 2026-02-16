import { X, Download, Maximize2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PDFPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string | null;
    title?: string;
    fileName?: string;
}

export const PDFPreviewModal = ({ isOpen, onClose, pdfUrl, title = "Vista Previa", fileName = "documento.pdf" }: PDFPreviewModalProps) => {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    if (!isOpen || !pdfUrl) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-xl shadow-2xl flex flex-col transition-all duration-300 ${isMaximized ? 'w-full h-full' : 'w-full max-w-4xl h-[85vh]'}`}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800">{title}</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hidden md:block"
                            title={isMaximized ? "Restaurar" : "Maximizar"}
                        >
                            <Maximize2 size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 bg-slate-50 relative">
                    <iframe
                        src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full"
                        title="PDF Preview"
                    />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                    <a
                        href={pdfUrl}
                        download={fileName}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Download size={18} />
                        Descargar PDF
                    </a>
                </div>
            </div>
        </div>
    );
};
