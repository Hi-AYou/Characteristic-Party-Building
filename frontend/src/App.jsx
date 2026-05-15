import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import useAuthStore from './store/authStore'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Members from './pages/Members'
import Progress from './pages/Progress'
import Branches from './pages/Branches'
import Users from './pages/Users'

dayjs.locale('zh-cn')

export default function App() {
  const { init } = useAuthStore()

  useEffect(() => { init() }, [])

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff' } }}>
      <BrowserRouter>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 需要登录的路由 */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/members"   element={<ProtectedRoute><Members /></ProtectedRoute>} />
          <Route path="/progress"  element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/branches"  element={<ProtectedRoute><Branches /></ProtectedRoute>} />

          {/* 用户管理：超管 + 支书均可访问 */}
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['super_admin', 'secretary']}>
                <Users />
              </ProtectedRoute>
            }
          />

          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
