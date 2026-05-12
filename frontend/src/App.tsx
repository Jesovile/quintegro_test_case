import React from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OrderPage from './pages/OrderPage'
import CheckoutPage from './pages/CheckoutPage'

const App: React.FC = () => {
  return (
    <Router basename="/runtime">
      <MainLayout>
        <Switch>
          <Route exact path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/order" component={OrderPage} />
          <Route path="/checkout/:orderId" component={CheckoutPage} />
          <Route path='/hui' component={() => <h1>HUI 888123</h1>}/>
        </Switch>
      </MainLayout>
    </Router>
  )
}

export default App
