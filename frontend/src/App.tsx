import React from 'react'
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import CurrentOrdersPage from './pages/CurrentOrdersPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import CheckoutPage from './pages/CheckoutPage'

const App: React.FC = () => {
  return (
    <Router basename="/runtime">
      <MainLayout>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route exact path="/order" render={() => <Redirect to="/order/current" />} />
          <Route path="/order/current" component={CurrentOrdersPage} />
          <Route path="/order/history" component={OrderHistoryPage} />
          <Route path="/checkout/:orderId" component={CheckoutPage} />
        </Switch>
      </MainLayout>
    </Router>
  )
}

export default App
