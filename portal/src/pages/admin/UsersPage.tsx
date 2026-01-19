import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import type { UserProfile, UserRole } from '../../types';
import './Users.css';

export default function UsersPage() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          uid: doc.id,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as UserProfile;
      });
      setUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Make sure you have admin permissions.');
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    if (uid === userProfile?.uid && newRole !== 'admin') {
      if (!confirm('Are you sure you want to remove your own admin access? You will lose access to this page.')) {
        return;
      }
    }

    try {
      setUpdatingUser(uid);
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date(),
      });
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.uid === uid ? { ...u, role: newRole, updatedAt: new Date() } : u
      ));
    } catch (err) {
      console.error('Error updating user role:', err);
      alert('Failed to update user role. Please try again.');
    } finally {
      setUpdatingUser(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'badge-admin';
      case 'tenant': return 'badge-tenant';
      case 'applicant': return 'badge-applicant';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="users-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="users-page">
        <div className="error-state">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchUsers} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <div className="header-content">
          <h1>User Management</h1>
          <p>Manage user accounts and roles</p>
        </div>
        <button onClick={fetchUsers} className="btn-secondary">
          <span className="icon">↻</span> Refresh
        </button>
      </div>

      <div className="users-stats">
        <div className="stat-card">
          <span className="stat-value">{users.length}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{users.filter(u => u.role === 'admin').length}</span>
          <span className="stat-label">Admins</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{users.filter(u => u.role === 'tenant').length}</span>
          <span className="stat-label">Tenants</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{users.filter(u => u.role === 'applicant').length}</span>
          <span className="stat-label">Applicants</span>
        </div>
      </div>

      <div className="users-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="role-filter">
          <select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value as UserRole | 'all')}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="tenant">Tenants</option>
            <option value="applicant">Applicants</option>
          </select>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-state">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.uid} className={user.uid === userProfile?.uid ? 'current-user' : ''}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="user-details">
                        <span className="user-name">
                          {user.displayName || 'No name'}
                          {user.uid === userProfile?.uid && <span className="you-badge">You</span>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.createdAt.toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.uid, e.target.value as UserRole)}
                        disabled={updatingUser === user.uid}
                        className="role-select"
                      >
                        <option value="admin">Admin</option>
                        <option value="tenant">Tenant</option>
                        <option value="applicant">Applicant</option>
                      </select>
                      {updatingUser === user.uid && (
                        <span className="updating-indicator">Saving...</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="users-help">
        <h3>Role Permissions</h3>
        <ul>
          <li><strong>Admin:</strong> Full access to all features, can manage users, properties, tenants, and settings</li>
          <li><strong>Tenant:</strong> Can view their lease, make payments, submit maintenance requests</li>
          <li><strong>Applicant:</strong> Can view available properties and submit rental applications</li>
        </ul>
      </div>
    </div>
  );
}
