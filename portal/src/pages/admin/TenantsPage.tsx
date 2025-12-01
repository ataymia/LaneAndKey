import { Link } from 'react-router-dom';
import { 
  Users,
  Search,
  Filter,
  Mail,
  Home,
  Calendar,
  DollarSign,
} from 'lucide-react';
import './Tenants.css';

export function TenantsPage() {
  // Placeholder data - would come from Firestore
  const tenants: {
    id: string;
    name: string;
    email: string;
    phone: string;
    property: string;
    unit?: string;
    leaseEnd: string;
    balance: number;
  }[] = [];

  return (
    <div className="tenants-page">
      <div className="page-header">
        <div>
          <h1>Tenants</h1>
          <p>{tenants.length} total tenants</p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input type="text" placeholder="Search tenants..." />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select>
            <option value="all">All Properties</option>
          </select>
        </div>
      </div>

      {tenants.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property</th>
                <th>Lease End</th>
                <th>Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(tenant => (
                <tr key={tenant.id}>
                  <td>
                    <div className="tenant-info">
                      <div className="avatar">{tenant.name.charAt(0)}</div>
                      <div>
                        <div className="tenant-name">{tenant.name}</div>
                        <div className="tenant-contact">
                          <Mail size={12} /> {tenant.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="property-info">
                      <Home size={14} />
                      {tenant.property}
                      {tenant.unit && ` #${tenant.unit}`}
                    </div>
                  </td>
                  <td>
                    <div className="lease-info">
                      <Calendar size={14} />
                      {tenant.leaseEnd}
                    </div>
                  </td>
                  <td>
                    <span className={`balance ${tenant.balance > 0 ? 'due' : ''}`}>
                      <DollarSign size={14} />
                      {Math.abs(tenant.balance).toFixed(2)}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/tenants/${tenant.id}`} className="btn btn-sm btn-outline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users size={32} />
          </div>
          <h3 className="empty-state-title">No tenants yet</h3>
          <p className="empty-state-description">
            Tenants are created when you approve applications.
          </p>
          <Link to="/admin/applications" className="btn btn-primary">
            View Applications
          </Link>
        </div>
      )}
    </div>
  );
}
