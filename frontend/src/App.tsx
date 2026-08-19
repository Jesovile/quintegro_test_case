import React from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OrderPage from './pages/OrderPage'
import PrivateRoute from './components/PrivateRoute'
import { CheckoutProvider } from './pages/checkout/CheckoutContext'
import CheckoutAddressPage from './pages/checkout/CheckoutAddressPage'
import CheckoutReviewPage from './pages/checkout/CheckoutReviewPage'
import CheckoutPaymentPage from './pages/checkout/CheckoutPaymentPage'
import CheckoutResultPage from './pages/checkout/CheckoutResultPage'

const CheckoutRoutes: React.FC = () => (
  <CheckoutProvider>
    <Switch>
      <PrivateRoute exact path="/checkout/:orderId/address" component={CheckoutAddressPage} />
      <PrivateRoute exact path="/checkout/:orderId/review" component={CheckoutReviewPage} />
      <PrivateRoute exact path="/checkout/:orderId/payment" component={CheckoutPaymentPage} />
      <PrivateRoute exact path="/checkout/:orderId/result" component={CheckoutResultPage} />
    </Switch>
  </CheckoutProvider>
)

const App: React.FC = () => {
  return (
    <Router basename="/runtime">
      <MainLayout>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <PrivateRoute path="/order" component={OrderPage} />
          <Route path="/checkout/:orderId" component={CheckoutRoutes} />
          <Route path='/hui' component={() => <h1>HUI 888123</h1>}/>
        </Switch>
      </MainLayout>
    </Router>
  )
}

export default App
