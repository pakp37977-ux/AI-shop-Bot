import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Store, LayoutDashboard, Utensils, ClipboardList, Settings, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Menu', path: '/dashboard/menu', icon: <Utensils className="w-5 h-5" /> },
    { name: 'Orders', path: '/dashboard/orders', icon: <ClipboardList className="w-5 h-5" /> },
    { name: 'Settings', path: '/dashboard/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b flex items-center gap-2">
          <Store className="w-6 h-6 text-green-600" />
          <span className="font-bold text-lg tracking-tight text-gray-900">DesiBot Shop</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto outline-none">
        <Outlet />
      </main>
    </div>
  );
}
