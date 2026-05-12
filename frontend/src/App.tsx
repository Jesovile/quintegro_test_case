import React from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OrderPage from './pages/OrderPage'
import CheckoutDeliveryPage from './pages/CheckoutDeliveryPage'
import CheckoutPaymentPage from './pages/CheckoutPaymentPage'
import CheckoutProcessingPage from './pages/CheckoutProcessingPage'

const App: React.FC = () => {
  return (
    <Router basename="/runtime">
      <MainLayout>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/order" component={OrderPage} />
          <Route path="/checkout/:orderId/delivery" component={CheckoutDeliveryPage} />
          <Route path="/checkout/:orderId/payment" component={CheckoutPaymentPage} />
          <Route path="/checkout/:orderId/processing" component={CheckoutProcessingPage} />
          <Route path='/hui' component={() => <h1>HUI 888123</h1>}/>
        </Switch>
      </MainLayout>
    </Router>
  )
}

export default App
