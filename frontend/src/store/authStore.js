import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: null,
  token: null,

  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null })
  },

  init: () => {
    const token = localStorage.getItem('token')
    const userStr = localStorage.getItem('user')
    if (token && userStr) {
      try {
        set({ token, user: JSON.parse(userStr) })
      } catch {
        localStorage.clear()
      }
    }
  },
}))

export default useAuthStore
