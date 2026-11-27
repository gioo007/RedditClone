import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import HomePage from './pages/HomePage.jsx';

function AppRoutes() {
  const { pathname } = useLocation();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <div className={`${isAuthPage ? 'auth-app-shell' : 'min-h-screen'} bg-reddit-canvas`}>
      {!isAuthPage && <Navbar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
