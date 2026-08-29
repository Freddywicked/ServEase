import Login from './screens/Login.jsx'
import Signup from './screens/Signup.jsx'
import VerifyOTP from './screens/VerifyOTP.jsx'

function App() {
  // TODO: introduce routing (e.g. React Router) as more screens are added.
  // For now, a minimal pathname switch so the Login <-> Signup <-> VerifyOTP
  // links/flow work.
  const { pathname } = window.location;
  const phone = new URLSearchParams(window.location.search).get('phone') || '';

  if (pathname === '/signup') {
    return <Signup />
  }
  if (pathname === '/verify-otp') {
    return <VerifyOTP phone={phone} />
  }
  return <Login />
}

export default App