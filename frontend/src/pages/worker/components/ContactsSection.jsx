// frontend/src/pages/worker/components/ContactsSection.jsx
import React, { useState, useEffect } from 'react';

const ContactsSection = ({ 
  contacts, 
  taxpayerId, 
  canEdit, 
  onAddContact,
  onEditContact,
  onDeleteContact
}) => {
  const [localContacts, setLocalContacts] = useState([]);

  // Синхронизируем локальное состояние с пропсами
  useEffect(() => {
    console.log('ContactsSection: Received new contacts:', contacts);
    setLocalContacts(contacts);
  }, [contacts]);

  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button 
            className="btn btn-primary"
            onClick={() => onAddContact()}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Добавить контакт
          </button>
        </div>
      )}

      {localContacts.length > 0 ? (
        <div className="row">
          {localContacts.map(contact => (
            <div key={contact.contact_id} className="col-md-6 mb-3">
              <div className="card border">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">
                    <i className={`bi ${
                      (contact.contact_type_name || '').toLowerCase() === 'email' ? 'bi-envelope' : 'bi-telephone'
                    } me-2`}></i>
                    {contact.contact_type_name || 'Контакт'}
                  </h6>
                  {canEdit && (
                    <div className="btn-group btn-group-sm">
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => onEditContact(contact)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-outline-danger"
                        onClick={() => onDeleteContact(contact.contact_id)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
                <div className="card-body">
                  <p className="card-text mb-0">{contact.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted py-4">
          <i className="bi bi-telephone-x display-4"></i>
          <p className="mt-2">Контактные данные не найдены</p>
        </div>
      )}
    </div>
  );
};

export default ContactsSection;