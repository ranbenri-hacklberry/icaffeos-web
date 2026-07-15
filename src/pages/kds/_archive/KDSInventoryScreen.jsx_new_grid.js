function renderItemsGrid() {
    return (
        <div className="h-full min-h-0 overflow-y-auto p-2 pb-24 relative">
            {/* FAB for Report */}
            <div className="fixed bottom-6 left-6 z-50">
                <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-full shadow-xl shadow-slate-900/30 hover:bg-slate-800 active:scale-95 transition-all font-bold"
                >
                    <ClipboardList size={20} />
                    <span>דוח חוסרים</span>
                </button>
            </div>

            {!selectedSupplierId ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                    <ArrowRight size={64} className="mb-6 animate-pulse" />
                    <h3 className="text-2xl font-bold">בחר ספק או "מלאי מנות" מהרשימה</h3>
                    <p>כדי לצפות ולעדכן פריטי מלאי</p>
                </div>
            ) : selectedSupplierId === 'prepared' ? (
                /* DEDICATED PREPARED ITEMS GRID VIEW (Integrated into main grid area) */
                <div className="h-full flex flex-col overflow-hidden">
                    {/* Improved Top Bar */}
                    <div className="flex flex-col md:flex-row items-center justify-between mb-6 bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl shadow-inner flex items-center justify-center text-indigo-600">
                                <ChefHat size={32} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">הכנות ומשימות</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                        <Package size={14} />
                                        {preparedItems.length} פריטים במעקב
                                    </span>
                                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                    {lastFetched && (
                                        <span className="text-[10px] font-bold text-slate-400">
                                            סונכרן לאחרונה: {lastFetched.toLocaleTimeString('he-IL')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-2 self-stretch md:self-auto">
                            <div className="flex flex-col items-center px-5 py-2 bg-white rounded-xl shadow-sm border border-slate-200/50">
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">הכנות וייצור</span>
                                <span className="text-xl font-black text-slate-700">{preparedItems.filter(i => (i.inventory_settings?.prepType || 'production') !== 'defrost').length}</span>
                            </div>
                            <div className="flex flex-col items-center px-5 py-2 bg-white rounded-xl shadow-sm border border-slate-200/50">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">הפשרה</span>
                                <span className="text-xl font-black text-slate-700">{preparedItems.filter(i => i.inventory_settings?.prepType === 'defrost').length}</span>
                            </div>
                        </div>
                    </div>

                    {preparedItems.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border-2 border-dashed border-slate-100 mt-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                <Package size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-400">אין מנות למעקב מלאי</h3>
                            <p className="text-slate-400 max-w-xs mx-auto mt-2">
                                רק מנות שהוגדרו עם ניהול מלאי (Hybrid) או שיש להן רשומת מלאי קיימת מופיעות כאן.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col gap-6 overflow-y-auto pb-24">
                            {(() => {
                                const prepItems = preparedItems.filter(i => (i.inventory_settings?.prepType || 'production') !== 'defrost');
                                const defrostItems = preparedItems.filter(i => i.inventory_settings?.prepType === 'defrost');

                                const showPrep = prepItems.length > 0;
                                const showDefrost = defrostItems.length > 0;

                                return (
                                    <>
                                        {/* Section: Prep & Production */}
                                        {(showPrep || (!showPrep && !showDefrost)) && (
                                            <div className="w-full flex flex-col bg-indigo-50/30 rounded-3xl p-4 border border-indigo-100/50">
                                                <div className="flex items-center justify-between mb-4 px-1">
                                                    <h4 className="flex items-center gap-2 font-black text-indigo-900 text-lg">
                                                        <ChefHat size={20} className="text-indigo-600" />
                                                        הכנות וייצור
                                                    </h4>
                                                    <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-sm">
                                                        {prepItems.length}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {prepItems.length === 0 ? (
                                                        <div className="col-span-full flex flex-col items-center justify-center py-10 text-slate-300 opacity-50 italic text-xs">
                                                            <span>אין פריטים להכנה</span>
                                                        </div>
                                                    ) : (
                                                        prepItems.map(item => renderPreparedItemCard(item))
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Section: Defrost */}
                                        {showDefrost && (
                                            <div className="w-full flex flex-col bg-blue-50/30 rounded-3xl p-4 border border-blue-100/50">
                                                <div className="flex items-center justify-between mb-4 px-1">
                                                    <h4 className="flex items-center gap-2 font-black text-blue-900 text-lg">
                                                        <Snowflake size={20} className="text-blue-500" />
                                                        הפשרה
                                                    </h4>
                                                    <span className="bg-blue-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-sm">
                                                        {defrostItems.length}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {defrostItems.map(item => renderPreparedItemCard(item))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            ) : (
                <div className="h-full flex flex-col">
                    {/* 🏷️ CATEGORY QUICK-FILTER */}
                    <div className="flex flex-wrap gap-2 px-1 mb-6 shrink-0">
                        {['ירקות', 'חלב', 'מאפים', 'יבש', 'מקפיא'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all uppercase tracking-widest flex items-center gap-2
                                        ${selectedCategory === cat
                                        ? 'bg-slate-800 text-white shadow-xl scale-105'
                                        : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400 hover:bg-slate-50'}`}
                            >
                                {cat === 'מקפיא' && <Snowflake size={14} />}
                                {cat}
                            </button>
                        ))}
                    </div>

                    {!selectedCategory ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border-2 border-dashed border-slate-100 mb-20">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4">
                                <Filter size={40} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-400">יש לבחור קטגוריה למעלה</h3>
                            <p className="text-slate-400 max-w-xs mx-auto mt-2">
                                בחר מחלקה כדי לראות ולעדכן את פריטי המלאי שלה.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-max pb-24 overflow-y-auto pr-1">
                            {filteredItems.map(item => {
                                const currentStock = stockUpdates[item.id] !== undefined ? stockUpdates[item.id] : item.current_stock;
                                const isChanged = stockUpdates[item.id] !== undefined && stockUpdates[item.id] !== item.current_stock;

                                // Basic Data Extraction
                                const rawWpu = parseFloat(item.weight_per_unit) || 0;
                                const dbStep = parseFloat(item.count_step) || 1;

                                // 🚨 AGGRESSIVE OVERRIDE for items that must be displayed as packages/units
                                const forcePackageList = ['קפוא', 'לימונדה', 'מארז', 'שקית', 'חסה', 'מנגו', 'בננה', 'תות', 'אננס'];
                                const isForcedPackage = forcePackageList.some(k => item.name.includes(k));

                                // Determine effective WPU (Weight Per Unit)
                                let effectiveWpu = rawWpu;
                                if (effectiveWpu === 0 && isForcedPackage) {
                                    // Fallback defaults if data is missing (Magic numbers)
                                    if (item.name.includes('לימונדה')) effectiveWpu = 2000;
                                    else if (item.name.includes('חסה')) effectiveWpu = 1;
                                    else effectiveWpu = 1000;
                                }

                                // Calculation Logic
                                let stepToApply;
                                let displayStock;
                                let displayUnit = item.unit; // Default to DB unit

                                if (effectiveWpu > 0) {
                                    // Item is a Package/Unit (Explicit WPU or Forced by Name)
                                    const safeStep = isForcedPackage ? 1 : dbStep;
                                    stepToApply = safeStep * effectiveWpu;
                                    displayStock = (currentStock || 0) / effectiveWpu;
                                    displayUnit = 'יח׳'; // 📦 ALWAYS show Units for these items
                                } else {
                                    // Standard Item
                                    stepToApply = dbStep;
                                    displayStock = currentStock || 0;
                                }

                                // 🧹 Clean numbers
                                displayStock = parseFloat(displayStock.toFixed(2));

                                const isCountedToday = (() => {
                                    if (!item.last_counted_at) return false;
                                    const lastDate = new Date(item.last_counted_at).toLocaleDateString();
                                    const today = new Date().toLocaleDateString();
                                    return lastDate === today;
                                })();

                                return (
                                    <div key={item.id} className={`px-4 py-2 rounded-xl shadow-sm border transition-colors group flex items-center justify-between
                                    ${isChanged ? 'bg-blue-50 border-blue-300' :
                                            isCountedToday ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-gray-100 hover:border-blue-300'}`}>
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-slate-800 text-sm leading-tight break-words">{item.name}</h4>
                                                </div>

                                                <div className="flex items-center gap-3 mt-1">
                                                    {isForcedPackage ? (
                                                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                                            📦 מארז ({effectiveWpu > 1000 ? effectiveWpu / 1000 + ' ק"ג' : effectiveWpu + ' גרם'})
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-400 font-medium">{displayUnit}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {/* Location Badge (if exists) */}
                                            {item.location && (
                                                <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                                    <span>📍</span>
                                                    <span className="font-bold">{item.location}</span>
                                                </div>
                                            )}

                                            {/* Stock Controls */}
                                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                                                <button
                                                    onClick={() => handleStockChange(item.id, -stepToApply)}
                                                    className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition active:scale-95"
                                                >
                                                    <span className="text-xl font-bold leading-none mb-1">−</span>
                                                </button>

                                                <div className="w-12 text-center flex flex-col justify-center leading-none">
                                                    <span className={`font-mono text-lg font-black ${isChanged ? 'text-blue-600' : 'text-slate-700'}`}>
                                                        {displayStock}
                                                    </span>
                                                    {/* 🛡️ FINAL UNIT FIX: Force DisplayUnit */}
                                                    <span className="text-[10px] text-gray-400 font-bold">{displayUnit}</span>
                                                </div>

                                                <button
                                                    onClick={() => handleStockChange(item.id, stepToApply)}
                                                    className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition active:scale-95"
                                                >
                                                    <Plus size={16} strokeWidth={3} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => isChanged && saveStockUpdate(item.id)}
                                                disabled={!isChanged || saving}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm
                                                ${isChanged
                                                        ? 'bg-blue-600 text-white shadow-blue-200 scale-110 active:scale-95'
                                                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                                            >
                                                <Save size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredItems.length === 0 && (
                                <div className="col-span-full text-center py-20 text-gray-400">
                                    <p>לא נמצאו פריטים</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Low Stock Report Modal */}
            <LowStockReportModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                items={items}
                currentStocks={stockUpdates}
                onUpdateStock={handleStockChange}
            />
        </div>
    );
}
