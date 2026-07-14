import apiClient from './client';

export const tallyApi = {
  // ── Accounts (Groups & Ledgers) ───────────────────────────
  groups: {
    list: () => apiClient.get('/accounts/groups').then(r => r.data),
    create: (data) => apiClient.post('/accounts/groups', data).then(r => r.data),
    update: (id, data) => apiClient.put(`/accounts/groups/${id}`, data).then(r => r.data),
    delete: (id) => apiClient.delete(`/accounts/groups/${id}`).then(r => r.data)
  },
  ledgers: {
    list: (groupId) => apiClient.get('/accounts/ledgers', { params: { groupId } }).then(r => r.data),
    create: (data) => apiClient.post('/accounts/ledgers', data).then(r => r.data),
    update: (id, data) => apiClient.put(`/accounts/ledgers/${id}`, data).then(r => r.data),
    delete: (id) => apiClient.delete(`/accounts/ledgers/${id}`).then(r => r.data)
  },

  // ── Masters (Parties, Stock Items, Units, Cost Centres) ─────
  parties: {
    list: (type) => apiClient.get('/masters/parties', { params: { type } }).then(r => r.data),
    create: (data) => apiClient.post('/masters/parties', data).then(r => r.data),
    update: (id, data) => apiClient.put(`/masters/parties/${id}`, data).then(r => r.data),
    delete: (id) => apiClient.delete(`/masters/parties/${id}`).then(r => r.data)
  },
  stockGroups: {
    list: () => apiClient.get('/masters/stock-groups').then(r => r.data),
    create: (data) => apiClient.post('/masters/stock-groups', data).then(r => r.data),
    delete: (id) => apiClient.delete(`/masters/stock-groups/${id}`).then(r => r.data)
  },
  stockItems: {
    list: () => apiClient.get('/masters/stock-items').then(r => r.data),
    create: (data) => apiClient.post('/masters/stock-items', data).then(r => r.data),
    update: (id, data) => apiClient.put(`/masters/stock-items/${id}`, data).then(r => r.data),
    delete: (id) => apiClient.delete(`/masters/stock-items/${id}`).then(r => r.data)
  },
  units: {
    list: () => apiClient.get('/masters/units').then(r => r.data),
    create: (data) => apiClient.post('/masters/units', data).then(r => r.data),
    delete: (id) => apiClient.delete(`/masters/units/${id}`).then(r => r.data)
  },
  taxRates: {
    list: () => apiClient.get('/masters/tax-rates').then(r => r.data),
    create: (data) => apiClient.post('/masters/tax-rates', data).then(r => r.data),
    delete: (id) => apiClient.delete(`/masters/tax-rates/${id}`).then(r => r.data)
  },
  costCentres: {
    list: () => apiClient.get('/masters/cost-centres').then(r => r.data),
    create: (data) => apiClient.post('/masters/cost-centres', data).then(r => r.data),
    delete: (id) => apiClient.delete(`/masters/cost-centres/${id}`).then(r => r.data)
  },
  currencies: {
    list: () => apiClient.get('/masters/currencies').then(r => r.data),
    create: (data) => apiClient.post('/masters/currencies', data).then(r => r.data)
  },

  // ── Vouchers ──────────────────────────────────────────────
  vouchers: {
    list: (params) => apiClient.get('/vouchers', { params }).then(r => r.data),
    get: (id) => apiClient.get(`/vouchers/${id}`).then(r => r.data),
    create: (data) => apiClient.post('/vouchers', data).then(r => r.data),
    update: (id, data) => apiClient.put(`/vouchers/${id}`, data).then(r => r.data),
    delete: (id) => apiClient.delete(`/vouchers/${id}`).then(r => r.data)
  },

  // ── Banking ───────────────────────────────────────────────
  banking: {
    accounts: {
      list: () => apiClient.get('/banking/accounts').then(r => r.data),
      create: (data) => apiClient.post('/banking/accounts', data).then(r => r.data),
      statement: (id, params) => apiClient.get(`/banking/accounts/${id}/statement`, { params }).then(r => r.data),
      pending: (id) => apiClient.get(`/banking/accounts/${id}/reconciliation`).then(r => r.data),
      reconcile: (id, data) => apiClient.post(`/banking/accounts/${id}/reconciliation`, data).then(r => r.data)
    },
    cheques: (params) => apiClient.get('/banking/cheques', { params }).then(r => r.data)
  },

  // ── Reports ───────────────────────────────────────────────
  reports: {
    balanceSheet: (params) => apiClient.get('/reports/balance-sheet', { params }).then(r => r.data),
    profitLoss: (params) => apiClient.get('/reports/profit-loss', { params }).then(r => r.data),
    stockSummary: (params) => apiClient.get('/reports/stock-summary', { params }).then(r => r.data),
    dayBook: (params) => apiClient.get('/reports/day-book', { params }).then(r => r.data),
    trialBalance: (params) => apiClient.get('/reports/trial-balance', { params }).then(r => r.data),
    receivables: (params) => apiClient.get('/reports/outstanding/receivables', { params }).then(r => r.data),
    payables: (params) => apiClient.get('/reports/outstanding/payables', { params }).then(r => r.data),
    cashFlow: (params) => apiClient.get('/reports/cash-flow', { params }).then(r => r.data),
    ledgerStatement: (ledgerId, params) => apiClient.get(`/reports/ledger/${ledgerId}`, { params }).then(r => r.data),
    gstSummary: (params) => apiClient.get('/reports/gst/summary', { params }).then(r => r.data),
    gstr1: (params) => apiClient.get('/reports/gst/gstr1', { params }).then(r => r.data),
    gstr3b: (params) => apiClient.get('/reports/gst/gstr3b', { params }).then(r => r.data)
  },

  // ── Utilities ─────────────────────────────────────────────
  utilities: {
    financialYears: {
      list: () => apiClient.get('/utilities/financial-years').then(r => r.data),
      create: (data) => apiClient.post('/utilities/financial-years', data).then(r => r.data),
      activate: (id) => apiClient.put(`/utilities/financial-years/${id}/activate`).then(r => r.data),
      delete: (id) => apiClient.delete(`/utilities/financial-years/${id}`).then(r => r.data)
    },
    company: {
      get: () => apiClient.get('/utilities/company').then(r => r.data),
      update: (data) => apiClient.put('/utilities/company', data).then(r => r.data)
    },
    auditTrail: (params) => apiClient.get('/utilities/audit-trail', { params }).then(r => r.data),
    stats: () => apiClient.get('/utilities/stats').then(r => r.data),
    exportData: () => apiClient.get('/utilities/export/data', { responseType: 'blob' }).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tally-export-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    })
  }
};
