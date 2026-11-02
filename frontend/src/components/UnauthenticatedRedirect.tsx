import { useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { loginPath, onUnauthenticated } from '@/lib/auth'

// Sends the user to the login page, with a way back, when the server rejects the session
const UnauthenticatedRedirect: React.FC = () => {
  const history = useHistory()

  useEffect(
    () => onUnauthenticated(() => history.replace(loginPath(history.location))),
    [history]
  )

  return null
}

export default UnauthenticatedRedirect
