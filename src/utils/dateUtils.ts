export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('es-HN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Tegucigalpa'
    });
};

export const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-HN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Tegucigalpa'
    });
};

export const formatDateTime = (date: Date): string => {
    return date.toLocaleString('es-HN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Tegucigalpa'
    });
};
