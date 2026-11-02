import React from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OrderPage from './pages/OrderPage'
import CheckoutPage from './pages/CheckoutPage'
import RequireAuth from './components/RequireAuth'
import UnauthenticatedRedirect from './components/UnauthenticatedRedirect'

const App: React.FC = () => {
  return (
    <Router basename="/runtime">
      <UnauthenticatedRedirect />
      <MainLayout>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <RequireAuth path="/order" component={OrderPage} />
          <RequireAuth path="/checkout/:orderId/:step?" component={CheckoutPage} />
          <Route path='/hui' component={() => <h1>HUI 888123</h1>}/>
        </Switch>
      </MainLayout>
    </Router>
  )
}

export default App
