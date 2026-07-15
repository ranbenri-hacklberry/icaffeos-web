import { useCallback, useState } from 'react';
import { useOnboardingStore } from '@/pages/onboarding/store/useOnboardingStore';
import { useTheme } from '@/context/ThemeContext';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, CheckCircle, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';

const MenuDataImporter = () => {
    const { processExcelData, setStep, items } = useOnboardingStore();
    const { isDarkMode } = useTheme();

    const initialUploadState = items.length > 0 ? 'exists' : 'idle';
    const [uploadState, setUploadState] = useState(initialUploadState); // idle, processing, success, error, exists
    const [progress, setProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploadState('processing');
        setProgress(10); // Start

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                setProgress(40); // Read complete
                if (!e.target?.result) throw new Error('Failed to read file');
                const data = new Uint8Array(e.target.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                setProgress(70); // Parse complete

                setTimeout(() => {
                    processExcelData(json);
                    setProgress(100);
                    setUploadState('success');
                }, 500); // Artificial delay to show progress
            } catch (err) {
                console.error(err);
                setUploadState('error');
                setErrorMsg('Failed to parse Excel file. Please ensure it matches the template.');
            }
        };
        reader.readAsArrayBuffer(file);
    }, [processExcelData]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1
    });

    // 🆕 AI Helper Prompt from MENU_HELPER_PROMPT.md
    const AI_PROMPT = `# עוזר הכנת תפריט ל-icaffeOS
אתה עוזר לבעלי עסקים להכין את קובץ ה-Excel לייבוא תפריט למערכת icaffeOS.
פרומט עמודות: | Item Name | Category | Price | Description | Production Area | Ingredients | Modifiers |
תחביר מודיפיירים: שם קבוצה [סוג|לוגיקה|מקסימום]:אופציה1[מחיר]{D},אופציה2;
דוגמאות:
- Milk [M|R|1]:Regular{D},Soy[3],Oat[3]
- Add-ons [O|A|3]:Onion[2],ExtraCheese[5]
עזור לי לסדר את הנתונים הבאים בפורמט זה...`;

    const copyPrompt = () => {
        navigator.clipboard.writeText(AI_PROMPT);
        alert('הפרומפט הועתק! הדבק אותו ב-ChatGPT או Claude לקבלת עזרה בסידור התפריט.');
    };

    // 🆕 Updated Template with New Syntax
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                "Category": "Coffee",
                "Item Name": "Cappuccino",
                "Description": "Rich espresso with steamed milk foam",
                "Price": 14,
                "Production Area": "Bar",
                "Ingredients": "Espresso, Milk",
                "Vibe Override": "",
                "Modifiers": "Milk [M|R|1]:Regular{D},Soy[3],Oat[3]; Sweetness [O|A|1]:Sugar,Honey[2]"
            },
            {
                "Category": "Bakery",
                "Item Name": "Croissant",
                "Description": "Buttery flakey pastry",
                "Price": 16,
                "Production Area": "Oven",
                "Ingredients": "Flour, Butter",
                "Vibe Override": "Rustic",
                "Modifiers": "Extras [O|A|2]:Jam[3],Butter[2]"
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Menu");
        XLSX.writeFile(wb, "icaffe_menu_template.xlsx");
    };

    return (
        <div className="flex flex-col gap-8 h-full items-center justify-center p-8">
            <div className="text-center space-y-4 max-w-lg">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Upload your Menu 📄
                </h2>
                <div className="flex flex-col gap-3">
                    <p className="text-slate-400">
                        We'll parse your Excel file to build your digital menu.
                        Don't have the file ready? <button onClick={handleDownloadTemplate} className="text-emerald-400 underline hover:text-emerald-300 font-bold">Download our template</button>.
                    </p>

                    <div className={`p-4 rounded-2xl border flex items-center gap-4 text-right transform transition-all hover:scale-[1.02]
                        ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}>
                        <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-500/20">
                            <Sparkles size={24} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">צריך עזרה בסידור הנתונים?</p>
                            <p className="text-xs text-slate-500">העתק את הפרומפט לעוזר ה-AI לסידור אוטומטי של התפריט</p>
                        </div>
                        <button
                            onClick={copyPrompt}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black rounded-lg transition-colors shadow-md active:scale-95"
                        >
                            העתק פרומפט
                        </button>
                    </div>
                </div>
            </div>

            <div
                {...getRootProps()}
                className={`w-full max-w-2xl aspect-[3/1] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all cursor-pointer relative overflow-hidden
                ${isDragActive ? 'border-indigo-500 bg-indigo-500/10 scale-105' :
                        isDarkMode ? 'border-slate-700 bg-slate-800/50 hover:border-slate-600' : 'border-slate-300 bg-white hover:border-slate-400'}
                ${uploadState === 'success' ? 'border-emerald-500/50 bg-emerald-500/10' : ''}
                `}
            >
                <input {...getInputProps()} />

                {uploadState === 'idle' && (
                    <>
                        <div className="p-4 rounded-full bg-slate-500/10 text-slate-400">
                            <FileSpreadsheet size={40} />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium">Drag & Drop your Excel file here</p>
                            <p className="text-sm text-slate-500">or click to browse</p>
                        </div>
                    </>
                )}

                {uploadState === 'processing' && (
                    <div className="w-full max-w-xs space-y-2 text-center">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                            <span>Processing...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {uploadState === 'success' && (
                    <div className="text-center space-y-2 animate-in fade-in zoom-in duration-300">
                        <CheckCircle size={48} className="text-emerald-500 mx-auto" />
                        <h3 className="text-xl font-bold text-emerald-400">Scan Complete!</h3>
                        <p className="text-slate-400">Successfully parsed {items.length} items.</p>
                    </div>
                )}

                {uploadState === 'exists' && (
                    <div className="text-center space-y-3 animate-in fade-in zoom-in duration-300">
                        <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto w-fit">
                            <FileSpreadsheet size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-emerald-400">תפריט קיים נמצא</h3>
                        <p className="text-slate-400">מצאנו את התפריט שהעלית קודם ({items.length} פריטים).</p>
                        <button
                            onClick={() => setUploadState('idle')}
                            className="text-xs text-indigo-400 underline hover:text-indigo-300"
                        >
                            העלה קובץ חדש במקום
                        </button>
                    </div>
                )}

                {uploadState === 'error' && (
                    <div className="text-center space-y-2">
                        <AlertTriangle size={48} className="text-red-500 mx-auto" />
                        <h3 className="text-xl font-bold text-red-400">Upload Failed</h3>
                        <p className="text-red-300/80 text-sm max-w-xs">{errorMsg}</p>
                    </div>
                )}
            </div>

            {(uploadState === 'success' || uploadState === 'exists') && (
                <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-500/20 transition-all animate-in slide-in-from-bottom-4 active:scale-95"
                >
                    המשך לבדיקת פריטים
                    <ArrowRight size={18} />
                </button>
            )}
        </div>
    );
};

export default MenuDataImporter;
