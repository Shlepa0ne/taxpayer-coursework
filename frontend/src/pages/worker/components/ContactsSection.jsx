import React, { useState } from 'react';
import { deleteContact, updateContact } from '../../../api/workersApi';
import ContactModal from './ContactModal';

const ContactsSection = ({ contacts, taxpayerId, canEdit, onUpdate }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  const handleDeleteContact = async (contactId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот контакт?')) {
      try {
        await deleteContact(contactId);
        onUpdate(taxpayerId);
      } catch (error) {
        console.error('Ошибка при удалении контакта:', error);
      }
    }
  };

  return (
    <div>
      {canEdit && (
        <div className="mb-3">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <i className="bi bi-plus-circle me-2"></i>
            Добавить контакт
          </button>
        </div>
      )}

      {contacts.length > 0 ? (
        <div className="row">
          {contacts.map(contact => (
            <div key={contact.contact_id} className="col-md-6 mb-3">
              <div className="card border">
                <div className="card-header bg-light d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">
                    <i className={`bi ${
                      contact.contact_type_name === 'email' ? 'bi-envelope' : 'bi-telephone'
                    } me-2`}></i>
                    {contact.contact_type_name}
                  </h6>
                  {canEdit && (
                    <div className="btn-group btn-group-sm">
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => setEditingContact(contact)}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-outline-danger"
                        onClick={() => handleDeleteContact(contact.contact_id)}
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

      {/* Модальные окна для добавления/редактирования контактов */}
      {(showAddModal || editingContact) && (
        <ContactModal
          contact={editingContact}
          taxpayerId={taxpayerId}
          onClose={() => {
            setShowAddModal(false);
            setEditingContact(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingContact(null);
            onUpdate(taxpayerId);
          }}
        />
      )}
    </div>
  );
};

export default ContactsSection;