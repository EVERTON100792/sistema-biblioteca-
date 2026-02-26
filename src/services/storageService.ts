import { LibraryData } from '../types';

const STORAGE_KEY = 'biblio_manager_data';

export const storageService = {
  saveData: (data: LibraryData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  loadData: (): LibraryData => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return {
          books: data.books || [],
          loans: data.loans || [],
          students: data.students || []
        };
      } catch (e) {
        console.error('Error parsing saved data', e);
      }
    }
    return { books: [], loans: [], students: [] };
  },

  exportBackup: (data: LibraryData) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `backup_biblioteca_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importBackup: (file: File): Promise<LibraryData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.books && data.loans) {
            resolve({
              books: data.books,
              loans: data.loans,
              students: data.students || []
            });
          } else {
            reject(new Error('Formato de backup inválido'));
          }
        } catch (e) {
          reject(new Error('Erro ao ler arquivo de backup'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao carregar arquivo'));
      reader.readAsText(file);
    });
  }
};
