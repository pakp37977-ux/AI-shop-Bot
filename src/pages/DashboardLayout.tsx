import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Store, LayoutDashboard, Utensils, ClipboardList, Settings, LogOut, Menu, X } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    if (!sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    document.body.classList.remove('sidebar-open');
  };

  const handleLogout = async () => {
    closeSidebar();
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
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden p-4 fixed z-[10000]">
        <button onClick={toggleSidebar} className="p-2 bg-white rounded-md shadow-sm border border-gray-200">
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-[9999] w-64 md:relative md:translate-x-0 bg-white border-r flex flex-col transition-transform duration-300 ease-in-out`}>
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
                onClick={closeSidebar}
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
      <main className="flex-1 overflow-y-auto outline-none main-content pt-16 md:pt-0">
        <Outlet />
      </main>
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-[9998] bg-black bg-opacity-50 md:hidden"
          onClick={closeSidebar}
        />
      )}
    </div>
  );
}
