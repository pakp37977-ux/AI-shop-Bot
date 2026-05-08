import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';

export default function DashboardOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      if (!auth.currentUser) return;
      const q = query(
        collection(db, 'orders'), 
        where('shop_id', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      const ords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort manually since we might need a composite index for where+orderBy
      ords.sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime());
      setOrders(ords);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { 
        status,
        updatedAt: new Date().toISOString()
      });
      fetchOrders();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  if (loading) return <div className="p-8">Loading orders...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Orders</h1>
        <p className="text-gray-500">Manage incoming orders from the bot.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
              <th className="p-4">Time</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Items</th>
              <th className="p-4">Total</th>
              <th className="p-4">Screenshot</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-sm text-gray-600">
                  {new Date(o.createdAt).toLocaleString()}
                </td>
                <td className="p-4">
                  <p className="font-medium text-gray-900">{o.customer_name}</p>
                  <p className="text-sm text-gray-500">{o.phone}</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[200px] truncate">{o.address}</p>
                </td>
                <td className="p-4 text-sm text-gray-600 max-w-[200px] truncate" title={o.items_json}>
                  {o.items_json}
                </td>
                <td className="p-4 font-medium text-gray-900">
                  Rs. {o.total_amount}
                </td>
                <td className="p-4">
                  {o.payment_screenshot ? (
                    <a href={o.payment_screenshot} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-sm font-medium">View Receipt</a>
                  ) : (
                    <span className="text-sm text-gray-400">COD</span>
                  )}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                    ${o.status === 'completed' ? 'bg-green-100 text-green-800' : 
                      o.status === 'cancelled' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'}`}>
                    {o.status}
                  </span>
                </td>
                <td className="p-4">
                  <select 
                    value={o.status}
                    onChange={(e) => updateStatus(o.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-green-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">No orders yet. They will appear here.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
