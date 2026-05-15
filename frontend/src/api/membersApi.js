import api from './axios'

export const getMembers = (params) => api.get('/members/', { params })
export const getMember = (id) => api.get(`/members/${id}`)
export const createMember = (data) => api.post('/members/', data)
export const updateMember = (id, data) => api.put(`/members/${id}`, data)
export const deleteMember = (id) => api.delete(`/members/${id}`)
export const batchUpdateMembers = (data) => api.patch('/members/batch-update', data)
export const importMembers = (formData) =>
  api.post('/members/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const exportMembers = (params) =>
  api.get('/members/export', { params, responseType: 'blob' })
export const downloadTemplate = () =>
  api.get('/members/template', { responseType: 'blob' })
export const getProgress = (params) => api.get('/members/progress', { params })
