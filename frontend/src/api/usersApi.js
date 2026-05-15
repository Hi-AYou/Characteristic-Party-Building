import api from './axios'

export const getUsers = () => api.get('/users/')
export const createUser = (data) => api.post('/users/', data)
export const updateUser = (id, data) => api.put(`/users/${id}`, data)
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const resetPassword = (id, data) => api.post(`/users/${id}/reset-password`, data)
export const getDashboardStats = () => api.get('/dashboard/stats')
