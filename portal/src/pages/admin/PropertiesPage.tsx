import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  MapPin,
  Bed,
  Bath,
  Square,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Users,
  Wrench,
  FileText,
} from 'lucide-react';
import { propertyService, leaseService, maintenanceService, userService } from '../../lib/firebase';
import type { Property, Lease, UserProfile } from '../../types';
import './Properties.css';

interface PropertyRow extends Property {
  tenantName?: string;
  tenantUid?: string;
  leaseId?: string;
  leaseStatus?: string;
  openTicketCount: number;
}

export function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const [rawProps, activeLeases, allTickets] = await Promise.all([
        propertyService.getAll(),
        leaseService.getActive(),
        maintenanceService.getAll(),
      ]);

      // Map from propertyId → active lease
      const leaseByProperty = new Map<string, Lease>();
      for (const l of activeLeases) {
        leaseByProperty.set(l.propertyId, l);
      }

      // Map from propertyId → open ticket count
      const ticketsByProperty = new Map<string, number>();
      for (const t of allTickets) {
        if (t.status === 'new' || t.status === 'in_progress' || t.status === 'waiting') {
          ticketsByProperty.set(t.propertyId, (ticketsByProperty.get(t.propertyId) || 0) + 1);
        }
      }

      // Fetch tenant names for properties with active leases
      const tenantUids = [...new Set(activeLeases.filter(l => l.tenantUid).map(l => l.tenantUid!))];
      const tenantProfiles = new Map<string, UserProfile>();
      await Promise.all(
        tenantUids.map(async uid => {
          try {
            const profile = await userService.get(uid);
            if (profile) tenantProfiles.set(uid, profile);
          } catch { /* ignore */ }
        })
      );

      const enriched: PropertyRow[] = rawProps.map(p => {
        const lease = leaseByProperty.get(p.id);
        const tenant = lease?.tenantUid ? tenantProfiles.get(lease.tenantUid) : null;
        return {
          ...p,
          tenantName: tenant?.displayName || undefined,
          tenantUid: lease?.tenantUid || undefined,
          leaseId: lease?.id || undefined,
          leaseStatus: lease?.status || undefined,
          openTicketCount: ticketsByProperty.get(p.id) || 0,
        };
      });

      setProperties(enriched);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMarketStatus = async (property: Property) => {
    try {
      const newStatus = property.marketStatus === 'on' ? 'off' : 'on';
      await propertyService.update(property.id, { marketStatus: newStatus });
      setProperties(prev => 
        prev.map(p => p.id === property.id ? { ...p, marketStatus: newStatus } : p)
      );
    } catch (error) {
      console.error('Error updating property:', error);
    }
    setActiveMenu(null);
  };

  const deleteProperty = async (propertyId: string) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    
    try {
      await propertyService.delete(propertyId);
      setProperties(prev => prev.filter(p => p.id !== propertyId));
    } catch (error) {
      console.error('Error deleting property:', error);
    }
    setActiveMenu(null);
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = 
      property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      property.city.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'on' && property.marketStatus === 'on') ||
      (statusFilter === 'off' && property.marketStatus === 'off') ||
      (statusFilter === 'vacant' && property.occupancyStatus === 'vacant') ||
      (statusFilter === 'occupied' && property.occupancyStatus === 'occupied');
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="properties-page">
        <div className="page-header">
          <h1>Properties</h1>
        </div>
        <div className="properties-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="property-card skeleton" style={{ height: 320 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="properties-page">
      <div className="page-header">
        <div>
          <h1>Properties</h1>
          <p>{properties.length} total properties</p>
        </div>
        <Link to="/admin/properties/new" className="btn btn-primary">
          <Plus size={18} />
          Add Property
        </Link>
      </div>

      {/* Filters */}
      <div className="properties-filters">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search properties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="on">On Market</option>
            <option value="off">Off Market</option>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
          </select>
        </div>
      </div>

      {/* Properties Grid */}
      {filteredProperties.length > 0 ? (
        <div className="properties-grid">
          {filteredProperties.map((property) => (
            <div key={property.id} className="property-card">
              <div className="property-image">
                {property.photos && property.photos.length > 0 ? (
                  <img 
                    src={property.photos[property.coverPhotoIndex || 0]} 
                    alt={property.address}
                  />
                ) : (
                  <div className="no-image">
                    <MapPin size={32} />
                    <span>No Image</span>
                  </div>
                )}
                <div className="property-badges">
                  <span className={`badge badge-${property.marketStatus === 'on' ? 'success' : 'gray'}`}>
                    {property.marketStatus === 'on' ? 'On Market' : 'Off Market'}
                  </span>
                  <span className={`badge badge-${getOccupancyColor(property.occupancyStatus)}`}>
                    {formatOccupancy(property.occupancyStatus)}
                  </span>
                </div>
                <button 
                  className="property-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenu(activeMenu === property.id ? null : property.id);
                  }}
                >
                  <MoreVertical size={18} />
                </button>
                {activeMenu === property.id && (
                  <div className="property-menu" onClick={(e) => e.stopPropagation()}>
                    <Link to={`/admin/properties/${property.id}`} className="menu-item">
                      <Eye size={16} />
                      View Details
                    </Link>
                    <Link to={`/admin/properties/${property.id}/edit`} className="menu-item">
                      <Edit size={16} />
                      Edit
                    </Link>
                    <button 
                      className="menu-item"
                      onClick={() => toggleMarketStatus(property)}
                    >
                      {property.marketStatus === 'on' ? (
                        <>
                          <ToggleLeft size={16} />
                          Take Off Market
                        </>
                      ) : (
                        <>
                          <ToggleRight size={16} />
                          Put On Market
                        </>
                      )}
                    </button>
                    <button 
                      className="menu-item danger"
                      onClick={() => deleteProperty(property.id)}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <Link to={`/admin/properties/${property.id}`} className="property-content">
                <div className="property-price">
                  {formatCurrency(property.monthlyRent)}<span>/month</span>
                </div>
                <h3 className="property-address">{property.address}</h3>
                <p className="property-location">
                  <MapPin size={14} />
                  {property.city}, {property.state} {property.zip}
                </p>
                <div className="property-details">
                  <span>
                    <Bed size={14} />
                    {property.bedrooms} beds
                  </span>
                  <span>
                    <Bath size={14} />
                    {property.bathrooms} baths
                  </span>
                  <span>
                    <Square size={14} />
                    {property.sqft.toLocaleString()} sqft
                  </span>
                </div>
                {(property.tenantName || property.openTicketCount > 0) && (
                  <div className="property-operational" style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary, #6b7280)' }}>
                    {property.tenantName && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Users size={12} />
                        {property.tenantName}
                      </span>
                    )}
                    {property.openTicketCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-warning, #f59e0b)' }}>
                        <Wrench size={12} />
                        {property.openTicketCount} open
                      </span>
                    )}
                    {property.leaseId && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <FileText size={12} />
                        Leased
                      </span>
                    )}
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">
            <MapPin size={32} />
          </div>
          <h3 className="empty-state-title">No properties found</h3>
          <p className="empty-state-description">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Add your first property to get started'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Link to="/admin/properties/new" className="btn btn-primary">
              <Plus size={18} />
              Add Property
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function getOccupancyColor(status: string): string {
  switch (status) {
    case 'vacant': return 'warning';
    case 'occupied': return 'success';
    case 'applications_in_progress': return 'info';
    default: return 'gray';
  }
}

function formatOccupancy(status: string): string {
  switch (status) {
    case 'vacant': return 'Vacant';
    case 'occupied': return 'Occupied';
    case 'applications_in_progress': return 'Apps in Progress';
    default: return status;
  }
}
