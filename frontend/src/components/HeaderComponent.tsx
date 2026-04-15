import React from 'react'
import UserProfile from './UserProfile'
import CurrentOrder from './CurrentOrder'

interface HeaderComponentProps {
  minimal?: boolean
}

const HeaderComponent: React.FC<HeaderComponentProps> = ({ minimal = false }) => {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Quintegro Frontend
        </h1>
        {!minimal && (
          <div className="flex items-center gap-6">
            <CurrentOrder />
            <UserProfile />
          </div>
        )}
      </div>
    </header>
  )
}

export default HeaderComponent
