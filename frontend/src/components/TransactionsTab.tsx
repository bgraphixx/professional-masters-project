import { useEffect, useState } from 'react';
import {
  Plus, Upload, Trash2, Filter, FileSpreadsheet, X, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '../api';
import { formatNaira, exportTransactionsCSV } from '../utils';
import type { Transaction, Category } from '../types';

const ITEMS_PER_PAGE = 20;

interface TransactionsTabProps {
  onCategoryCorrected: () => void;
}

export default function TransactionsTab({ onCategoryCorrected }: TransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Manual Transaction Form state
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txCategoryId, setTxCategoryId] = useState('');

  // Statement import state
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [pdfPassword, setPdfPassword] = useState('');
  const [pdfBank, setPdfBank] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [importSummary, setImportSummary] = useState('');

  const fetchCategories = async () => {
    const { ok, data } = await apiGet<Category[]>('/transactions/categories');
    if (ok) setCategories(data);
  };

  const fetchTransactions = async () => {
    const params = new URLSearchParams();
    if (filterType) params.append('type', filterType);
    if (filterCategoryId) params.append('category_id', filterCategoryId);
    const qs = params.toString();
    const { ok, data } = await apiGet<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`);
    if (ok) setTransactions(data);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterCategoryId]);

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        description: txDesc,
        amount: parseFloat(txAmount),
        type: txType,
        transaction_date: txDate,
        source: 'manual',
      };
      if (txCategoryId) payload.category_id = txCategoryId;

      const { ok, data } = await apiPost('/transactions', payload);
      if (!ok) throw new Error(data?.detail || 'Error adding transaction');

      setTxDesc('');
      setTxAmount('');
      setTxType('expense');
      setTxDate(new Date().toISOString().split('T')[0]);
      setTxCategoryId('');
      setIsAddModalOpen(false);
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (txId: string, categoryId: string) => {
    const { ok, data } = await apiPut(`/transactions/${txId}`, { category_id: categoryId || null });
    if (ok) {
      onCategoryCorrected();
      fetchTransactions();
    } else {
      alert(data?.detail || 'Failed to update category');
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    const { ok } = await apiDelete(`/transactions/${txId}`);
    if (ok) fetchTransactions();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.pdf')) {
        setStatementFile(file);
      } else {
        alert('Please drop a valid CSV or PDF statement file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setStatementFile(e.target.files[0]);
  };

  const handleImportStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementFile) return;

    setLoading(true);
    setImportSummary('');
    const formData = new FormData();
    formData.append('file', statementFile);

    let endpoint = '/transactions/import-csv';
    if (statementFile.name.toLowerCase().endsWith('.pdf')) {
      endpoint = '/transactions/import-pdf';
      if (pdfPassword) formData.append('password', pdfPassword);
      if (pdfBank) formData.append('bank', pdfBank);
    }

    try {
      const { ok, data } = await apiUpload(endpoint, formData);
      if (!ok) throw new Error(data?.detail || 'Importing failed');

      setImportSummary(data.message);
      setStatementFile(null);
      setPdfPassword('');
      setPdfBank('');
      fetchTransactions();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSummary('');
      }, 2500);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface-lowest border border-outline-variant/70 rounded-lg p-6 shadow-[0_4px_12px_rgba(0,0,0,0.01)] space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-surface-container pb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Transaction Management</h3>
          <p className="text-xs text-slate-500 mt-0.5">Filter records and track automated classifications.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-surface-lowest border border-outline-variant text-slate-700 text-xs rounded-default py-2 pl-3 pr-8 outline-none appearance-none cursor-pointer focus:border-secondary"
            >
              <option value="">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="bg-surface-lowest border border-outline-variant text-slate-700 text-xs rounded-default py-2 pl-3 pr-8 outline-none appearance-none cursor-pointer focus:border-secondary"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-primary hover:bg-[#00522b] text-white px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-[0_2px_4px_rgba(0,106,57,0.1)] ml-auto md:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-surface-lowest hover:bg-slate-50 border border-outline-variant text-slate-700 px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import Statement</span>
          </button>

          <button
            onClick={() => exportTransactionsCSV(transactions)}
            disabled={transactions.length === 0}
            className="bg-surface-lowest hover:bg-slate-50 border border-outline-variant text-slate-700 px-3.5 py-2 rounded-default text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No transactions found.</p>
            <p className="text-xs">Click "Add Manual" or "Import Statement" to seed details.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-outline-variant text-slate-400 text-[10px] font-mono uppercase tracking-wider">
                <th className="pb-3 font-semibold">Date</th>
                <th className="pb-3 font-semibold">Description</th>
                <th className="pb-3 font-semibold">Source</th>
                <th className="pb-3 font-semibold">Category</th>
                <th className="pb-3 font-semibold text-right">Amount</th>
                <th className="pb-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-surface-container/60 hover:bg-slate-50/40 transition-colors">
                  <td className="py-4 text-sm font-mono text-slate-600">{tx.transaction_date}</td>
                  <td className="py-4 text-sm font-medium text-on-background max-w-sm whitespace-normal break-words">{tx.description}</td>
                  <td className="py-4">
                    <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                      tx.source === 'csv'
                        ? 'bg-secondary-container/10 text-secondary border border-secondary/10'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {tx.source}
                    </span>
                  </td>
                  <td className="py-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <select
                        value={tx.category_id || ''}
                        onChange={(e) => handleUpdateCategory(tx.id, e.target.value)}
                        className="bg-transparent hover:bg-surface-low border border-transparent hover:border-outline-variant text-xs text-slate-800 font-semibold rounded py-1 px-1.5 outline-none transition-all cursor-pointer focus:bg-surface-lowest focus:border-secondary"
                      >
                        <option value="">Uncategorised</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      {tx.is_flagged && (
                        <div className="group relative">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 leading-relaxed font-sans">
                            Low Confidence prediction ({(tx.confidence_score * 100).toFixed(0)}%). Review category.
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`py-4 text-right font-mono font-medium text-sm ${
                    tx.type === 'income' ? 'text-primary' : 'text-slate-800'
                  }`}>{tx.type === 'income' ? '+' : '-'}{formatNaira(tx.amount)}</td>
                  <td className="py-4 text-center">
                    <button onClick={() => handleDeleteTransaction(tx.id)} className="text-slate-400 hover:text-error p-1 rounded transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-container pt-4 mt-4">
          <span className="text-xs text-slate-500">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, transactions.length)} of {transactions.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-outline-variant rounded-default text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-outline-variant rounded-default text-xs font-medium hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-lowest border border-outline-variant rounded-lg max-w-md w-full p-6 shadow-xl animate-fadeIn relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-on-background mb-4">Add Manual Transaction</h3>

            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div className="space-y-1">
                <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bus fare to Ikeja"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Amount (₦)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="2500"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Type</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as 'income' | 'expense')}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all cursor-pointer"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Date</label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-mono text-label-sm uppercase tracking-wider text-slate-500">Override Category</label>
                  <select
                    value={txCategoryId}
                    onChange={(e) => setTxCategoryId(e.target.value)}
                    className="w-full bg-surface-lowest border border-outline-variant focus:border-secondary focus:ring-1 focus:ring-secondary rounded-default py-2.5 px-3 text-on-background text-sm outline-none transition-all cursor-pointer"
                  >
                    <option value="">Auto-categorize (ML)</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary hover:bg-[#00522b] text-white font-bold text-sm rounded-default cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-[0_2px_4px_rgba(0,106,57,0.1)]"
              >
                {loading ? (
                  <span className="border-2 border-white border-t-transparent w-4 h-4 rounded-full animate-spin" />
                ) : (
                  'Create Transaction'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-lowest border border-outline-variant rounded-lg max-w-md w-full p-6 shadow-xl animate-fadeIn relative">
            <button
              onClick={() => setIsImportModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-on-background mb-1">Import Bank Statement</h3>
            <p className="text-xs text-slate-500 mb-4">Support CSV and PDF statements (GTBank, Opay, Access, etc.).</p>

            {importSummary ? (
              <div className="p-4 rounded-default bg-primary-container/10 border border-primary-container text-primary text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-medium">{importSummary}</span>
              </div>
            ) : (
              <form onSubmit={handleImportStatement} className="space-y-4">
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`w-full min-h-[160px] border-2 border-dashed rounded-default flex flex-col items-center justify-center p-4 transition-all cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary-container/5'
                      : statementFile
                      ? 'border-secondary bg-surface-low'
                      : 'border-outline-variant hover:border-slate-400 bg-surface-lowest'
                  }`}
                >
                  <input
                    type="file"
                    id="statement-file-input"
                    accept=".csv, .pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="statement-file-input" className="w-full h-full flex flex-col items-center justify-center cursor-pointer space-y-2">
                    <FileSpreadsheet className={`w-10 h-10 ${statementFile ? 'text-secondary' : 'text-slate-400'}`} />
                    <div className="text-center">
                      {statementFile ? (
                        <p className="text-xs font-bold text-slate-800">{statementFile.name}</p>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-slate-700">Drag & Drop bank statement CSV or PDF here</p>
                          <p className="text-[10px] text-slate-400 mt-1">or click to browse local files</p>
                        </>
                      )}
                    </div>
                  </label>
                </div>

                {statementFile && statementFile.name.toLowerCase().endsWith('.pdf') && (
                  <div className="space-y-3 mt-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Bank (Optional)</label>
                      <select
                        value={pdfBank}
                        onChange={(e) => setPdfBank(e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary bg-surface-lowest text-on-background transition-all"
                      >
                        <option value="">Auto-detect / Other</option>
                        <option value="opay">OPay</option>
                        <option value="providus">Providus Bank</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">PDF Password (if protected)</label>
                      <input
                        type="password"
                        placeholder="Leave blank if none"
                        value={pdfPassword}
                        onChange={(e) => setPdfPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-default text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="p-3 bg-surface-low rounded border border-outline-variant/60">
                  <h4 className="text-[10px] font-bold text-slate-700 uppercase font-mono mb-1">Expected Format:</h4>
                  <p className="text-[9px] text-slate-500 leading-relaxed font-mono">
                    Tables should contain: Date, Description (or Narration), and Amount (or separate Debit/Credit columns).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !statementFile}
                  className="w-full py-3 bg-primary hover:bg-[#00522b] text-white font-bold text-sm rounded-default cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_2px_4px_rgba(0,106,57,0.1)]"
                >
                  {loading ? (
                    <span className="border-2 border-white border-t-transparent w-4 h-4 rounded-full animate-spin" />
                  ) : (
                    'Upload & Auto-Categorize'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
