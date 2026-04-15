import React from 'react'
import { useLocation } from 'react-router-dom'
import HeaderComponent from './HeaderComponent'

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation()
  const isCheckout = location.pathname.startsWith('/checkout')

  return (
    <div className="flex flex-col h-screen">
      <HeaderComponent minimal={isCheckout} />
      <main className="flex-1 overflow-auto flex justify-center bg-gray-50">
        <div className="max-w-7xl w-full py-8 px-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export default MainLayout
