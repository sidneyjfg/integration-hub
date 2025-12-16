export const formatDateWithFixedTimezone = (daysAgo: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${year}-${month}-${day}T00:00:00-03:00`;
};
 export const formatDateForMysql = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

export const isFullByAnymarketField = (val: unknown): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
        const s = val.trim().toLowerCase();
        return s === '1' || s === 'true';
    }
    return false;
};

export const matchesMode = (fulfillmentValue: unknown, takeFull: boolean, takeConv: boolean): boolean => {
    const isFull = isFullByAnymarketField(fulfillmentValue);

    if (takeFull && takeConv) return true;      // ambos habilitados
    if (takeFull) return isFull;                // só full
    if (takeConv) return !isFull;               // só convencional
    return false;                               // nenhum habilitado
};

export const isIgnoredStatus = (status: string, ignoreList: string): boolean => {
    if (!ignoreList) return false;

    const list = ignoreList.split(',').map(s => s.trim().toUpperCase());
    return list.includes(status.toUpperCase());
};

