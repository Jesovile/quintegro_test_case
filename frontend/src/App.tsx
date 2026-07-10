import React from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OrderPage from './pages/OrderPage'
import PrivateRoute from './components/PrivateRoute'
import { CheckoutProvider } from './context/CheckoutContext'
import CheckoutAddressPage from './pages/checkout/CheckoutAddressPage'
import CheckoutReviewPage from './pages/checkout/CheckoutReviewPage'
import CheckoutPaymentPage from './pages/checkout/CheckoutPaymentPage'
import CheckoutConfirmationPage from './pages/checkout/CheckoutConfirmationPage'

const App: React.FC = () => {
  return (
    <Router basename="/runtime">
      <MainLayout>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/order" component={OrderPage} />
          <Route path="/checkout">
            <PrivateRoute>
              <CheckoutProvider>
                <Switch>
                  <Route exact path="/checkout/address" component={CheckoutAddressPage} />
                  <Route exact path="/checkout/review" component={CheckoutReviewPage} />
                  <Route exact path="/checkout/payment" component={CheckoutPaymentPage} />
                  <Route exact path="/checkout/confirmation/:orderId" component={CheckoutConfirmationPage} />
                </Switch>
              </CheckoutProvider>
            </PrivateRoute>
          </Route>
          <Route path='/hui' component={() => <h1>HUI 888123</h1>}/>
        </Switch>
      </MainLayout>
    </Router>
  )
}

export default App
